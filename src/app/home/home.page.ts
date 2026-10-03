import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
} from '@ionic/angular/standalone';
import {
  defaultTaskColor,
  formatTaskDueDate,
  Task,
  TaskService,
} from '../services/task.service';
import { TimerService } from '../services/timer.service';
import { UserService } from '../services/user.service';
import { ProgressService } from '../services/progress.service';
import { AppSettingsService } from '../services/app-settings.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonButton,
    IonCard,
    IonCardContent,
    IonIcon,
  ],
})
export class HomePage {
  tasks$ = this.taskService.tasks$;
  user$ = this.userService.user$;
  xp$ = this.progressService.xp$;
  settings$ = this.settingsService.settings$;

  constructor(
    private taskService: TaskService,
    private timerService: TimerService,
    private userService: UserService,
    private progressService: ProgressService,
    private router: Router,
    private settingsService: AppSettingsService,
  ) {}

  startFocusSession(): void {
    const nextTask = this.openTasks(this.taskService.getTasks())[0];
    this.timerService.selectTask(
      nextTask?.id ?? null,
      nextTask ? this.displayTitle(nextTask.title, nextTask.sourceCourse) : 'Deep Study Sprint',
      nextTask?.duration ?? 25,
    );
    void this.router.navigate(['/tabs/focus']);
  }

  openProfile(): void {
    void this.router.navigateByUrl('/tabs/profile');
  }

  profileMark(firstName?: string, surname?: string): string {
    return `${firstName?.trim().charAt(0) ?? ''}${surname?.trim().charAt(0) ?? ''}`.toUpperCase() || 'FF';
  }

  pendingTasks(): number {
    return this.taskService.getTasks().filter((task) => task.status !== 'completed').length;
  }

  nextTasks(tasks: Task[]): Task[] {
    const priorityOrder: Record<Task['priority'], number> = {
      high: 0,
      medium: 1,
      low: 2,
    };
    return this.openTasks(tasks)
      .sort((left, right) => {
        const dueDifference = this.dueTimestamp(left) - this.dueTimestamp(right);
        return dueDifference ||
          priorityOrder[left.priority] - priorityOrder[right.priority] ||
          left.title.localeCompare(right.title);
      })
      .slice(0, 4);
  }

  get greeting(): string {
    const hour = new Date().getHours();
    return `Good ${hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening'}`;
  }

  get weekday(): string {
    return new Date().toLocaleDateString('en-US', { weekday: 'long' });
  }

  get authMessage(): string | null {
    return this.userService.getLastAuthMessage();
  }

  navigateTo(route: string): void {
    void this.router.navigate(['/tabs', route]);
  }

  startTaskFocus(task: Task): void {
    this.timerService.selectTask(task.id, this.displayTitle(task.title, task.sourceCourse), task.duration);
    void this.router.navigate(['/tabs/focus']);
  }

  level(): number {
    return Math.floor(this.progressService.getXp() / 100) + 1;
  }

  xpPercent(): number {
    return this.progressService.getXp() % 100;
  }

  displayTitle(title: string, course?: string): string {
    return course ? title.replace(`[${course}] `, '') : title;
  }

  taskDeadline(task: Task): string {
    const date = formatTaskDueDate(task.dueDate);
    return [date, task.dueTime].filter(Boolean).join(' · ') || 'No date set';
  }

  taskColor(task: Task): string {
    return task.color || defaultTaskColor(task.category);
  }

  openTasks(tasks: Task[]): Task[] {
    return tasks.filter((task) => task.status !== 'completed');
  }

  private dueTimestamp(task: Task): number {
    if (!task.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)) {
      return Number.MAX_SAFE_INTEGER;
    }
    const dueAt = new Date(`${task.dueDate}T${task.dueTime || '23:59'}:00`).getTime();
    return Number.isFinite(dueAt) ? dueAt : Number.MAX_SAFE_INTEGER;
  }
}
