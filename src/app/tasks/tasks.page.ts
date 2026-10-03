import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonCheckbox,
  IonContent,
  IonInput,
} from '@ionic/angular/standalone';
import {
  defaultTaskColor,
  formatTaskDueDate,
  Task,
  TaskCategory,
  TaskService,
} from '../services/task.service';
import { TimerService } from '../services/timer.service';
import { ProgressService } from '../services/progress.service';

type CategoryFilter = 'all' | TaskCategory;

@Component({
  selector: 'app-tasks',
  templateUrl: 'tasks.page.html',
  styleUrls: ['tasks.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonButton,
    IonCheckbox,
    IonInput,
  ],
})
export class TasksPage {
  readonly tasks$ = this.taskService.tasks$;
  readonly categories: { value: CategoryFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'academic', label: 'Academic' },
    { value: 'freelance', label: 'Freelance' },
    { value: 'household', label: 'Household' },
  ];
  readonly taskCategories: TaskCategory[] = ['academic', 'freelance', 'household'];
  readonly priorities: Task['priority'][] = ['high', 'medium', 'low'];
  readonly colorSwatches = [
    '#7138d4',
    '#e95e43',
    '#16875e',
    '#d94683',
    '#078ca0',
    '#b67a08',
    '#8c52d6',
    '#526d83',
  ];
  selectedCategory: CategoryFilter = 'all';
  showArchive = false;
  newTaskCategory: TaskCategory = 'academic';
  newTaskColor = defaultTaskColor(this.newTaskCategory);
  newTaskTitle = '';
  newTaskDueDate = '';
  newTaskDueTime = '';
  newTaskDuration = 25;
  newTaskPriority: Task['priority'] = 'medium';
  subtaskDrafts: Record<string, string> = {};

  constructor(
    private taskService: TaskService,
    private timerService: TimerService,
    private progressService: ProgressService,
    private router: Router,
  ) {}

  visibleTasks(tasks: Task[]): Task[] {
    return tasks.filter(
      (task) =>
        (this.showArchive ? task.status === 'completed' : task.status !== 'completed') &&
        (this.selectedCategory === 'all' || task.category === this.selectedCategory),
    );
  }

  openTaskCount(tasks: Task[]): number {
    return tasks.filter((task) => task.status !== 'completed').length;
  }

  archivedTaskCount(tasks: Task[]): number {
    return tasks.filter((task) => task.status === 'completed').length;
  }

  categoryChanged(category: TaskCategory): void {
    this.newTaskColor = defaultTaskColor(category);
  }

  addTask(): void {
    const title = this.newTaskTitle.trim();
    if (!title || !this.canAddTask) {
      return;
    }

    this.taskService.addTask({
      title,
      category: this.newTaskCategory,
      duration: Number(this.newTaskDuration),
      priority: this.newTaskPriority,
      color: this.newTaskColor,
      dueDate: this.newTaskDueDate || undefined,
      dueTime: this.newTaskDueTime || undefined,
      source: 'manual',
    });
    this.newTaskTitle = '';
    this.newTaskDueDate = '';
    this.newTaskDueTime = '';
    this.newTaskDuration = 25;
    this.newTaskPriority = 'medium';
    this.newTaskColor = defaultTaskColor(this.newTaskCategory);
  }

  get canAddTask(): boolean {
    return Number.isFinite(this.newTaskDuration) &&
      this.newTaskDuration >= 5 &&
      this.newTaskDuration <= 180 &&
      this.newTaskDuration % 5 === 0;
  }

  taskDeadline(task: Task): string {
    const date = formatTaskDueDate(task.dueDate);
    return [date, task.dueTime].filter(Boolean).join(' · ') || 'No date set';
  }

  taskColor(task: Task): string {
    return task.color || defaultTaskColor(task.category);
  }

  setTaskColor(taskId: string, color: string): void {
    this.taskService.setTaskColor(taskId, color);
  }

  get minimumDueDate(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  toggleTask(id: string): void {
    const task = this.taskService.getTasks().find((item) => item.id === id);
    if (task && task.status !== 'completed') {
      this.taskService.setTaskStatus(id, 'completed');
      this.progressService.awardTaskCompletion(
        id,
        50 + this.timerService.getSession().completedCycles * 10,
      );
      return;
    }
    this.taskService.setTaskStatus(id, 'pending');
  }

  toggleSubtask(taskId: string, subtaskId: string): void {
    this.taskService.toggleSubtask(taskId, subtaskId);
  }

  addSubtask(taskId: string): void {
    const title = this.subtaskDrafts[taskId] ?? '';
    if (!title.trim()) {
      return;
    }
    this.taskService.addSubtask(taskId, title);
    this.subtaskDrafts[taskId] = '';
  }

  startFocus(task: Task): void {
    this.timerService.selectTask(task.id, this.displayTitle(task.title, task.sourceCourse), task.duration);
    void this.router.navigate(['/tabs/focus']);
  }

  displayTitle(title: string, course?: string): string {
    return course ? title.replace(`[${course}] `, '') : title;
  }

  trackedTask(_index: number, task: Task): string {
    return task.id;
  }
}
