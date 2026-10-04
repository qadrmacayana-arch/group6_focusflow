import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonButton,
  IonContent,
  IonInput,
  IonLabel,
  IonIcon,
  IonSpinner,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { bookOutline } from 'ionicons/icons';
import { CanvasCourse, CanvasSyncService } from '../services/canvas-sync.service';
import { Task, TaskService } from '../services/task.service';
import { TimerService } from '../services/timer.service';

@Component({
  selector: 'app-canvas',
  templateUrl: 'canvas.page.html',
  styleUrls: ['canvas.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonLabel,
    IonInput,
    IonButton,
    IonIcon,
    IonSpinner,
  ],
})
export class CanvasPage {
  domain = 'canvas.tip.edu.ph';
  token = '';
  syncing = false;
  message = '';
  messageType: 'success' | 'error' | 'info' = 'info';
  studentName = '';
  courses: CanvasCourse[] = [];
  importedCount = 0;
  updatedCount = 0;
  syncWarning = '';
  lastSyncedAt: Date | null = null;
  readonly tasks$ = this.taskService.tasks$;

  constructor(
    private canvasSyncService: CanvasSyncService,
    private taskService: TaskService,
    private timerService: TimerService,
    private router: Router,
  ) {
    addIcons({ bookOutline });
  }

  syncCanvas(): void {
    if (!this.token.trim()) {
      this.message = 'Enter a valid Canvas access token.';
      this.messageType = 'error';
      return;
    }

    this.syncing = true;
    this.message = 'Syncing course assignments...';
    this.messageType = 'info';

    this.canvasSyncService.syncWithToken(this.domain, this.token).subscribe({
      next: (result) => {
        this.syncing = false;
        this.token = '';
        this.messageType = result.success ? 'success' : 'error';
        let syncCounts = { added: 0, updated: 0 };
        if (result.success) {
          syncCounts = this.taskService.syncCanvasAssignments(result.assignments);
          this.importedCount = syncCounts.added;
          this.updatedCount = syncCounts.updated;
          this.studentName = result.studentName || 'Canvas student';
          this.courses = result.courses;
          this.lastSyncedAt = new Date();
          this.syncWarning = result.warning || '';
        }
        this.message = result.success
          ? `Sync complete: ${syncCounts.added} new assignment(s) added and ${syncCounts.updated} existing assignment(s) updated across ${result.coursesCount} course(s).${result.warning ? ` ${result.warning}` : ''}`
          : result.error || 'Unable to sync Canvas data.';
      },
      error: (error: unknown) => {
        this.syncing = false;
        this.token = '';
        this.messageType = 'error';
        this.message =
          error instanceof Error
            ? error.message
            : 'Unable to connect to Canvas. Check your connection and try again.';
      },
    });
  }

  importedTasks(tasks: Task[]): Task[] {
    return tasks
      .filter((task) => task.source === 'canvas')
      .sort((left, right) => left.title.localeCompare(right.title));
  }

  displayTitle(task: Task): string {
    return task.sourceCourse ? task.title.replace(`[${task.sourceCourse}] `, '') : task.title;
  }

  startFocus(task: Task): void {
    if (task.status === 'completed') {
      return;
    }
    this.timerService.selectTask(task.id, this.displayTitle(task), task.duration);
    void this.router.navigate(['/tabs/focus']);
  }
}
