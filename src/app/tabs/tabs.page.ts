import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  IonBadge,
  IonContent,
  IonIcon,
  IonLabel,
  IonMenu,
  IonMenuToggle,
  ModalController,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  barChartOutline,
  calendarOutline,
  checkboxOutline,
  homeOutline,
  schoolOutline,
  timerOutline,
} from 'ionicons/icons';
import { Task, TaskService } from '../services/task.service';
import { TimerService, TimerSession } from '../services/timer.service';
import { UserService } from '../services/user.service';
import { ReminderService } from '../services/reminder.service';
import { filter, take } from 'rxjs';
import { OnboardingModalComponent } from '../onboarding/onboarding-modal.component';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    IonContent,
    IonMenu,
    IonMenuToggle,
    IonTabs,
    IonTabBar,
    IonTabButton,
    IonIcon,
    IonLabel,
    IonBadge,
  ],
})
export class TabsPage implements OnInit {
  tasks$ = this.taskService.tasks$;
  session$ = this.timerService.session$;
  user$ = this.userService.user$;
  readonly reminders$ = this.reminderService.reminders$;

  constructor(
    private taskService: TaskService,
    private timerService: TimerService,
    private userService: UserService,
    private reminderService: ReminderService,
    private modalController: ModalController,
  ) {
    addIcons({
      homeOutline,
      timerOutline,
      checkboxOutline,
      schoolOutline,
      calendarOutline,
      barChartOutline,
    });
  }

  ngOnInit(): void {
    this.user$
      .pipe(
        filter((user) => !!user && user.onboardingCompleted === false),
        take(1),
      )
      .subscribe(() => {
        void this.presentGettingStartedTour();
      });
  }

  async presentGettingStartedTour(): Promise<void> {
    const modal = await this.modalController.create({
      component: OnboardingModalComponent,
      cssClass: 'onboarding-modal',
      backdropDismiss: false,
      canDismiss: async (_data, role) => role === 'complete' || role === 'skip',
    });
    await modal.present();
  }

  openTasks(tasks: Task[]): number {
    return tasks.filter((task) => task.status !== 'completed').length;
  }

  focusLocked(session: TimerSession): boolean {
    return session.phase === 'engage' ||
      (session.phase === 'focus' && session.started) ||
      session.protectedRecovery;
  }

  profileMark(firstName: string, surname: string): string {
    return `${firstName.trim().charAt(0)}${surname.trim().charAt(0)}`.toUpperCase() || 'FF';
  }
}
