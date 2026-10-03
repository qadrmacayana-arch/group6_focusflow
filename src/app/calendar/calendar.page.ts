import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { Task, TaskService, formatTaskDueDate } from '../services/task.service';
import { ReminderService, ScheduledReminder } from '../services/reminder.service';
import { TimerService } from '../services/timer.service';

interface CalendarDay {
  date: string;
  day: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  taskCount: number;
  reminderCount: number;
}

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.page.html',
  styleUrls: ['./calendar.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent],
})
export class CalendarPage {
  readonly tasks$ = this.taskService.tasks$;
  readonly reminders$ = this.reminderService.reminders$;
  readonly weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  displayedMonth = this.firstOfMonth(new Date());
  selectedDate = this.dateKey(new Date());
  readonly minimumDate = this.dateKey(new Date());
  reminderTitle = '';
  reminderTime = this.defaultReminderTime();
  reminderDuration = 25;
  reminderMessage = '';
  permissionMessage = '';

  constructor(
    private taskService: TaskService,
    public reminderService: ReminderService,
    private timerService: TimerService,
    private router: Router,
  ) {}

  monthLabel(): string {
    return this.displayedMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  calendarDays(tasks: Task[], reminders: ScheduledReminder[]): CalendarDay[] {
    const monthStart = this.firstOfMonth(this.displayedMonth);
    const mondayOffset = (monthStart.getDay() + 6) % 7;
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - mondayOffset);
    const today = this.dateKey(new Date());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const key = this.dateKey(date);
      return {
        date: key,
        day: date.getDate(),
        inCurrentMonth: date.getMonth() === monthStart.getMonth(),
        isToday: key === today,
        isSelected: key === this.selectedDate,
        taskCount: tasks.filter((task) => this.taskDate(task) === key).length,
        reminderCount: reminders.filter((reminder) => reminder.scheduledAt.slice(0, 10) === key).length,
      };
    });
  }

  tasksForSelectedDate(tasks: Task[]): Task[] {
    return tasks.filter((task) => this.taskDate(task) === this.selectedDate);
  }

  remindersForSelectedDate(reminders: ScheduledReminder[]): ScheduledReminder[] {
    return reminders
      .filter((reminder) => reminder.scheduledAt.slice(0, 10) === this.selectedDate)
      .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
  }

  selectedDateLabel(): string {
    return formatTaskDueDate(this.selectedDate, true);
  }

  selectDate(date: string): void {
    this.selectedDate = date;
    const parsed = this.parseDate(date);
    if (parsed) {
      this.displayedMonth = this.firstOfMonth(parsed);
    }
    this.reminderMessage = '';
  }

  changeMonth(offset: number): void {
    this.displayedMonth = new Date(
      this.displayedMonth.getFullYear(),
      this.displayedMonth.getMonth() + offset,
      1,
    );
  }

  goToToday(): void {
    const today = new Date();
    this.displayedMonth = this.firstOfMonth(today);
    this.selectedDate = this.dateKey(today);
  }

  addReminder(): void {
    try {
      this.reminderService.addReminder(
        this.reminderTitle,
        this.selectedDate,
        this.reminderTime,
        Number(this.reminderDuration),
      );
      this.reminderTitle = '';
      this.reminderMessage = 'Reminder saved.';
    } catch (error) {
      this.reminderMessage =
        error instanceof Error ? error.message : 'Could not save this reminder.';
    }
  }

  removeReminder(reminder: ScheduledReminder): void {
    this.reminderService.removeReminder(reminder.id);
  }

  async enableNotifications(): Promise<void> {
    try {
      const permission = await this.reminderService.requestNotificationPermission();
      this.permissionMessage =
        permission === 'granted'
          ? 'Notifications are enabled.'
          : permission === 'unsupported'
            ? 'This browser does not support notifications.'
            : 'Notifications are blocked. Change this site’s browser permissions to allow them.';
    } catch (error) {
      this.permissionMessage =
        error instanceof Error ? error.message : 'Could not enable notifications.';
    }
  }

  notificationPermission(): string {
    const permission = this.reminderService.getNotificationPermission();
    return permission === 'granted'
      ? 'Notifications enabled'
      : permission === 'denied'
        ? 'Notifications blocked in browser settings'
        : permission === 'unsupported'
          ? 'Notifications are not supported here'
          : 'Allow notifications for task and reminder alerts';
  }

  startReminderFocus(reminder: ScheduledReminder): void {
    this.timerService.selectTimedFocus(reminder.title, reminder.focusDurationMinutes);
    void this.router.navigate(['/tabs/focus']);
  }

  startTaskFocus(task: Task): void {
    this.timerService.selectTask(
      task.id,
      this.displayTitle(task),
      task.duration,
    );
    void this.router.navigate(['/tabs/focus']);
  }

  displayTitle(task: Task): string {
    return task.sourceCourse ? task.title.replace(`[${task.sourceCourse}] `, '') : task.title;
  }

  taskDate(task: Task): string | null {
    if (!task.dueDate) {
      return null;
    }
    const value = task.dueDate.toLowerCase();
    if (value === 'today' || value === 'tomorrow' || value === 'yesterday') {
      const date = new Date();
      date.setDate(date.getDate() + (value === 'tomorrow' ? 1 : value === 'yesterday' ? -1 : 0));
      return this.dateKey(date);
    }
    return this.parseDate(task.dueDate) ? task.dueDate : null;
  }

  private defaultReminderTime(): string {
    const now = new Date();
    now.setMinutes(Math.ceil((now.getMinutes() + 15) / 5) * 5, 0, 0);
    if (this.dateKey(now) !== this.selectedDate) {
      this.selectedDate = this.dateKey(now);
      this.displayedMonth = this.firstOfMonth(now);
    }
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  private firstOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private parseDate(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      return null;
    }
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return this.dateKey(date) === value ? date : null;
  }

  private dateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
