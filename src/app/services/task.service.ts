import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type TaskCategory = 'academic' | 'freelance' | 'household';

export function defaultTaskColor(category: TaskCategory): string {
  return {
    academic: '#7138d4',
    freelance: '#e95e43',
    household: '#16875e',
  }[category];
}

function isTaskColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  category: TaskCategory;
  status: 'pending' | 'in_progress' | 'completed';
  duration: number;
  priority: 'high' | 'medium' | 'low';
  color?: string;
  dueTime?: string;
  dueDate?: string;
  source?: 'canvas' | 'manual';
  sourceCourse?: string;
  ticketId?: string;
  subtasks: Subtask[];
}

export function formatTaskDueDate(value?: string, includeWeekday = false): string {
  if (!value) {
    return '';
  }

  const relativeLabel = ['Yesterday', 'Today', 'Tomorrow'].find(
    (label) => label.toLowerCase() === value.toLowerCase(),
  );
  if (relativeLabel) {
    return relativeLabel;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return value;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    ...(includeWeekday ? { weekday: 'long' as const } : {}),
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

@Injectable({
  providedIn: 'root',
})
export class TaskService {
  private readonly storageKey = 'focusflow.tasks.v1';
  private tasksSubject = new BehaviorSubject<Task[]>(this.loadTasks());
  public tasks$: Observable<Task[]> = this.tasksSubject.asObservable();

  getTasks(): Task[] {
    return this.tasksSubject.value;
  }

  addTask(task: Omit<Task, 'id' | 'status' | 'subtasks'>): Task {
    const created: Task = {
      ...task,
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: 'pending',
      subtasks: [],
    };
    this.publish([created, ...this.tasksSubject.value]);
    return created;
  }

  addBatch(tasks: Task[]): void {
    const current = this.tasksSubject.value;
    const existingIds = new Set(current.map((task) => task.id));
    const newItems = tasks.filter((task) => !existingIds.has(task.id));
    this.publish([...newItems, ...current]);
  }

  syncCanvasAssignments(assignments: Task[]): { added: number; updated: number } {
    const current = this.tasksSubject.value;
    const existingById = new Map(
      current.filter((task) => task.source === 'canvas').map((task) => [task.id, task]),
    );
    const existingByTicketId = new Map<string, Task>();
    for (const task of current) {
      if (task.source === 'canvas' && task.ticketId) {
        existingByTicketId.set(task.ticketId, task);
      }
    }
    let added = 0;
    let updated = 0;

    const uniqueAssignments = [
      ...new Map(
        assignments
          .filter((task) => task.source === 'canvas')
          .map((task) => [task.id, task]),
      ).values(),
    ];
    const synced = uniqueAssignments
      .map((assignment) => {
        const existing =
          existingById.get(assignment.id) ||
          (assignment.ticketId ? existingByTicketId.get(assignment.ticketId) : undefined);
        if (!existing) {
          added += 1;
          return assignment;
        }

        updated += 1;
        return {
          ...existing,
          ...assignment,
          id: existing.id,
          status: existing.status,
          color: existing.color,
          subtasks: existing.subtasks,
        };
      });

    const syncedIds = new Set(synced.map((task) => task.id));
    const untouched = current.filter(
      (task) => task.source !== 'canvas' || !syncedIds.has(task.id),
    );
    this.publish([...synced, ...untouched]);
    return { added, updated };
  }

  toggleTaskStatus(id: string): void {
    this.publish(
      this.tasksSubject.value.map((task) =>
        task.id === id
          ? { ...task, status: task.status === 'completed' ? 'pending' : 'completed' }
          : task,
      ),
    );
  }

  setTaskStatus(id: string, status: Task['status']): void {
    this.publish(
      this.tasksSubject.value.map((task) => (task.id === id ? { ...task, status } : task)),
    );
  }

  setTaskColor(id: string, color: string): void {
    if (!isTaskColor(color)) {
      throw new Error('Task color must be a six-digit hexadecimal color.');
    }

    this.publish(
      this.tasksSubject.value.map((task) => (task.id === id ? { ...task, color } : task)),
    );
  }

  toggleSubtask(taskId: string, subtaskId: string): void {
    this.publish(
      this.tasksSubject.value.map((task) =>
        task.id === taskId
          ? {
              ...task,
              subtasks: task.subtasks.map((subtask) =>
                subtask.id === subtaskId ? { ...subtask, done: !subtask.done } : subtask,
              ),
            }
          : task,
      ),
    );
  }

  addSubtask(taskId: string, title: string): void {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      return;
    }

    this.publish(
      this.tasksSubject.value.map((task) =>
        task.id === taskId
          ? {
              ...task,
              subtasks: [
                ...task.subtasks,
                {
                  id: `${taskId}-sub-${Date.now()}`,
                  title: cleanTitle,
                  done: false,
                },
              ],
            }
          : task,
      ),
    );
  }

  private publish(tasks: Task[]): void {
    this.tasksSubject.next(tasks);
    localStorage.setItem(this.storageKey, JSON.stringify(tasks));
  }

  private loadTasks(): Task[] {
    const saved = localStorage.getItem(this.storageKey);
    if (!saved) {
      return [];
    }

    try {
      const tasks: unknown = JSON.parse(saved);
      if (Array.isArray(tasks) && tasks.every((task) => this.isTask(task))) {
        return tasks;
      }
      throw new Error('Saved task list has an invalid shape.');
    } catch (error) {
      console.error('Could not load saved FocusFlow tasks.', error);
      localStorage.removeItem(this.storageKey);
      return [];
    }
  }

  private isTask(value: unknown): value is Task {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const task = value as Record<string, unknown>;
    const isOptionalString = (item: unknown): boolean =>
      item === undefined || typeof item === 'string';
    return (
      typeof task['id'] === 'string' &&
      typeof task['title'] === 'string' &&
      (task['category'] === 'academic' ||
        task['category'] === 'freelance' ||
        task['category'] === 'household') &&
      (task['status'] === 'pending' ||
        task['status'] === 'in_progress' ||
        task['status'] === 'completed') &&
      typeof task['duration'] === 'number' &&
      Number.isFinite(task['duration']) &&
      task['duration'] > 0 &&
      (task['color'] === undefined || isTaskColor(task['color'])) &&
      (task['priority'] === 'high' ||
        task['priority'] === 'medium' ||
        task['priority'] === 'low') &&
      isOptionalString(task['dueTime']) &&
      isOptionalString(task['dueDate']) &&
      (task['source'] === undefined ||
        task['source'] === 'canvas' ||
        task['source'] === 'manual') &&
      isOptionalString(task['sourceCourse']) &&
      isOptionalString(task['ticketId']) &&
      Array.isArray(task['subtasks']) &&
      task['subtasks'].every(
        (subtask) =>
          subtask &&
          typeof subtask === 'object' &&
          typeof subtask.id === 'string' &&
          typeof subtask.title === 'string' &&
          typeof subtask.done === 'boolean',
      )
    );
  }
}
