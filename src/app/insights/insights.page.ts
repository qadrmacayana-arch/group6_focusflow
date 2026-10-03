import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { formatTaskDueDate, Task, TaskService } from '../services/task.service';
import { TimerService, TimerSession } from '../services/timer.service';

@Component({
  selector: 'app-insights',
  templateUrl: './insights.page.html',
  styleUrls: ['./insights.page.scss'],
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent],
})
export class InsightsPage {
  readonly tasks$ = this.taskService.tasks$;
  readonly session$ = this.timerService.session$;

  constructor(
    private taskService: TaskService,
    private timerService: TimerService,
  ) {}

  completedCount(tasks: Task[]): number {
    return tasks.filter((task) => task.status === 'completed').length;
  }

  openCount(tasks: Task[]): number {
    return tasks.filter((task) => task.status !== 'completed').length;
  }

  focusMinutes(session: TimerSession): number {
    return Math.floor(session.totalFocusSeconds / 60);
  }

  completionPercent(tasks: Task[]): number {
    return tasks.length ? Math.round((this.completedCount(tasks) / tasks.length) * 100) : 0;
  }

  priorityTasks(tasks: Task[]): Task[] {
    return tasks
      .filter((task) => task.status !== 'completed' && task.priority === 'high')
      .slice(0, 3);
  }

  taskDeadline(task: Task): string {
    const date = formatTaskDueDate(task.dueDate);
    return [date, task.dueTime].filter(Boolean).join(' · ') || 'No due date';
  }
}
