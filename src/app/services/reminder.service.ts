import { Injectable } from '@angular/core';
import { BehaviorSubject, interval, Observable } from 'rxjs';
import { AppSettingsService } from './app-settings.service';
import { Task, TaskService } from './task.service';

export interface ScheduledReminder {
  id: string;
  title: string;
  scheduledAt: string;
  focusDurationMinutes: number;
  notified: boolean;
}

export type NotificationPermissionState = NotificationPermission | 'unsupported';

const REMINDERS_STORAGE_KEY = 'focusflow.reminders.v1';
const NOTIFIED_TASKS_STORAGE_KEY = 'focusflow.notifiedTasks.v1';
const NOTIFICATION_WINDOW_MS = 5 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class ReminderService {
  private readonly remindersSubject = new BehaviorSubject<ScheduledReminder[]>(this.loadReminders());
  readonly reminders$: Observable<ScheduledReminder[]> = this.remindersSubject.asObservable();

  constructor(
    private taskService: TaskService,
    private settings: AppSettingsService,
  ) {
    this.checkSchedules();
    interval(15_000).subscribe(() => this.checkSchedules());
  }

  getReminders(): ScheduledReminder[] {
    return this.remindersSubject.value;
  }

  addReminder(
    title: string,
    date: string,
    time: string,
    focusDurationMinutes: number,
  ): ScheduledReminder {
    const cleanTitle = title.trim();
    const scheduledDate = this.parseLocalDateTime(date, time);
    if (!cleanTitle || cleanTitle.length > 120) {
      throw new Error('Enter a reminder between 1 and 120 characters.');
    }
    if (!scheduledDate || scheduledDate.getTime() <= Date.now()) {
      throw new Error('Choose a future date and time for this reminder.');
    }
    if (
      !Number.isInteger(focusDurationMinutes) ||
      focusDurationMinutes < 5 ||
      focusDurationMinutes > 180 ||
      focusDurationMinutes % 5 !== 0
    ) {
      throw new Error('Choose a timer duration from 5 to 180 minutes in 5-minute steps.');
    }

    const reminder: ScheduledReminder = {
      id: `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: cleanTitle,
      scheduledAt: `${date}T${time}`,
      focusDurationMinutes,
      notified: false,
    };
    this.publishReminders([reminder, ...this.remindersSubject.value]);
    return reminder;
  }

  removeReminder(id: string): void {
    this.publishReminders(this.remindersSubject.value.filter((reminder) => reminder.id !== id));
  }

  getNotificationPermission(): NotificationPermissionState {
    return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
  }

  async requestNotificationPermission(): Promise<NotificationPermissionState> {
    if (typeof Notification === 'undefined' || !('Notification' in globalThis)) {
      return 'unsupported';
    }
    return Notification.requestPermission();
  }

  private checkSchedules(): void {
    const now = Date.now();
    const permission = this.getNotificationPermission();
    const reminders = this.remindersSubject.value;
    let remindersChanged = false;
    const updatedReminders = reminders.map((reminder) => {
      if (reminder.notified) {
        return reminder;
      }
      const scheduledAt = new Date(reminder.scheduledAt).getTime();
      if (!Number.isFinite(scheduledAt) || scheduledAt > now) {
        return reminder;
      }
      if (now - scheduledAt > NOTIFICATION_WINDOW_MS) {
        remindersChanged = true;
        return { ...reminder, notified: true };
      }
      if (permission !== 'granted') {
        return reminder;
      }
      this.showNotification('Reminder', reminder.title, reminder.id);
      remindersChanged = true;
      return { ...reminder, notified: true };
    });
    if (remindersChanged) {
      this.publishReminders(updatedReminders);
    }

    if (permission !== 'granted' || !this.settings.getSettings().taskNotifications) {
      return;
    }
    const notifiedTasks = this.loadNotifiedTasks();
    for (const task of this.taskService.getTasks()) {
      if (task.status === 'completed') {
        continue;
      }
      const dueAt = this.taskDueTime(task);
      if (!dueAt || dueAt > now || now - dueAt > NOTIFICATION_WINDOW_MS) {
        continue;
      }
      const key = `${task.id}:${dueAt}`;
      if (notifiedTasks.includes(key)) {
        continue;
      }
      this.showNotification('Task due', task.title, key);
      notifiedTasks.push(key);
      this.saveNotifiedTasks(notifiedTasks);
    }
  }

  private taskDueTime(task: Task): number | null {
    if (!task.dueDate) {
      return null;
    }
    const date = this.normalizeDate(task.dueDate);
    if (!date) {
      return null;
    }
    const time = task.dueTime || '09:00';
    const parsed = this.parseLocalDateTime(date, time);
    return parsed?.getTime() ?? null;
  }

  private normalizeDate(value: string): string | null {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    const offset = value.toLowerCase() === 'yesterday' ? -1 : value.toLowerCase() === 'tomorrow' ? 1 : 0;
    if (value.toLowerCase() !== 'today' && value.toLowerCase() !== 'yesterday' && value.toLowerCase() !== 'tomorrow') {
      return null;
    }
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return this.dateKey(date);
  }

  private parseLocalDateTime(date: string, time: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      return null;
    }
    const parsed = new Date(`${date}T${time}:00`);
    return Number.isFinite(parsed.getTime()) &&
      this.dateKey(parsed) === date &&
      `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}` === time
      ? parsed
      : null;
  }

  private showNotification(title: string, body: string, tag: string): void {
    try {
      const notification = new Notification(title, { body, tag });
      notification.onclick = () => globalThis.focus();
    } catch (error) {
      console.error('Could not show a FocusFlow notification.', error);
    }
  }

  private loadReminders(): ScheduledReminder[] {
    const saved = localStorage.getItem(REMINDERS_STORAGE_KEY);
    if (!saved) {
      return [];
    }
    try {
      const parsed: unknown = JSON.parse(saved);
      if (
        Array.isArray(parsed) &&
        parsed.every(
          (value) =>
            value &&
            typeof value === 'object' &&
            typeof value.id === 'string' &&
            typeof value.title === 'string' &&
            typeof value.scheduledAt === 'string' &&
            typeof value.focusDurationMinutes === 'number' &&
            typeof value.notified === 'boolean',
        )
      ) {
        return parsed;
      }
      throw new Error('Saved reminders have an invalid shape.');
    } catch (error) {
      console.error('Could not load saved FocusFlow reminders.', error);
      localStorage.removeItem(REMINDERS_STORAGE_KEY);
      return [];
    }
  }

  private loadNotifiedTasks(): string[] {
    const saved = localStorage.getItem(NOTIFIED_TASKS_STORAGE_KEY);
    if (!saved) {
      return [];
    }
    try {
      const parsed: unknown = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.every((key) => typeof key === 'string')) {
        return parsed;
      }
      throw new Error('Saved task notifications have an invalid shape.');
    } catch (error) {
      console.error('Could not load sent task notifications.', error);
      localStorage.removeItem(NOTIFIED_TASKS_STORAGE_KEY);
      return [];
    }
  }

  private saveNotifiedTasks(keys: string[]): void {
    localStorage.setItem(NOTIFIED_TASKS_STORAGE_KEY, JSON.stringify(keys));
  }

  private publishReminders(reminders: ScheduledReminder[]): void {
    this.remindersSubject.next(reminders);
    localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(reminders));
  }

  private dateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
