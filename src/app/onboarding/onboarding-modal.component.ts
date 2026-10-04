import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { AlertController, IonIcon, ModalController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  bulbOutline,
  calendarOutline,
  checkboxOutline,
  schoolOutline,
  sparklesOutline,
  timerOutline,
} from 'ionicons/icons';
import { UserService } from '../services/user.service';

interface TourStep {
  icon: string;
  label: string;
  title: string;
  description: string;
  details: string[];
}

@Component({
  selector: 'app-onboarding-modal',
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
    <main class="tour-shell" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <header class="tour-header">
        <span class="tour-brand"><span class="tour-brand-mark">F</span> FocusFlow</span>
        <button class="tour-skip" type="button" [disabled]="saving" (click)="confirmSkip()">Skip tour</button>
      </header>

      <div class="tour-progress" aria-label="Tutorial progress">
        <span
          *ngFor="let step of steps; let index = index"
          [class.is-current]="index === currentStep"
          [class.is-complete]="index < currentStep"
        ></span>
      </div>

      <section class="tour-step" aria-live="polite">
        <span class="tour-icon"><ion-icon [name]="step.icon" aria-hidden="true"></ion-icon></span>
        <p class="tour-eyebrow">{{ step.label }} · {{ currentStep + 1 }} of {{ steps.length }}</p>
        <h1 id="tour-title">{{ step.title }}</h1>
        <p class="tour-description">{{ step.description }}</p>
        <ul>
          <li *ngFor="let detail of step.details">{{ detail }}</li>
        </ul>
        <p class="tour-error" *ngIf="errorMessage" role="alert">{{ errorMessage }}</p>
      </section>

      <footer class="tour-footer">
        <button
          class="tour-back"
          type="button"
          [disabled]="saving || currentStep === 0"
          (click)="previousStep()"
        >
          Back
        </button>
        <button class="tour-next" type="button" [disabled]="saving" (click)="nextStep()">
          {{ currentStep === steps.length - 1 ? 'Let’s get started' : 'Next' }}
        </button>
      </footer>
    </main>
  `,
  styleUrls: ['./onboarding-modal.component.scss'],
})
export class OnboardingModalComponent {
  currentStep = 0;
  saving = false;
  errorMessage = '';

  readonly steps: TourStep[] = [
    {
      icon: 'sparkles-outline',
      label: 'A gentle start',
      title: 'Make room for what matters.',
      description: 'FocusFlow helps you turn a busy day into one doable next step.',
      details: [
        'Your tasks and progress are saved in this browser on this device.',
        'Take this at your own pace—there is no perfect routine to keep up with.',
      ],
    },
    {
      icon: 'checkbox-outline',
      label: 'Your tasks',
      title: 'Get it out of your head.',
      description: 'Add a task, then give it just enough structure to make starting easier.',
      details: [
        'Set a due date, category, and estimated time when they’re useful.',
        'Archive individual tasks, restore them later, or permanently delete one after confirmation.',
      ],
    },
    {
      icon: 'timer-outline',
      label: 'Focus sessions',
      title: 'Start smaller than you think.',
      description: 'Choose what you want to work on and let the timer hold the space.',
      details: [
        'The First-Move Coach can suggest a tiny, task-aware way to begin.',
        'FocusFlow guides your focus and recovery breaks; it does not block other apps.',
      ],
    },
    {
      icon: 'calendar-outline',
      label: 'Your plan',
      title: 'Give important things a place.',
      description: 'Use Plan to see task dates, pick a day, or add a timed reminder.',
      details: [
        'Browser notifications need your permission and the app open.',
        'Alerts may be delayed if your browser suspends the app.',
      ],
    },
    {
      icon: 'school-outline',
      label: 'Courses & progress',
      title: 'Notice the progress you make.',
      description: 'Courses can import Canvas assignments, and Progress summarizes your work.',
      details: [
        'Canvas setup is optional; you can use FocusFlow without connecting a course.',
        'Your current prototype data stays on this device and is not cloud-synced.',
      ],
    },
    {
      icon: 'bulb-outline',
      label: 'One last thing',
      title: 'You’re in control.',
      description: 'Settings lets you adjust your focus rhythm and notification preferences.',
      details: [
        'This demo uses local accounts and has no password reset or email verification.',
        'Plus is not purchasable yet—this build has no payment or purchase verification.',
      ],
    },
  ];

  constructor(
    private readonly alertController: AlertController,
    private readonly modalController: ModalController,
    private readonly userService: UserService,
  ) {
    addIcons({
      bulbOutline,
      calendarOutline,
      checkboxOutline,
      schoolOutline,
      sparklesOutline,
      timerOutline,
    });
  }

  get step(): TourStep {
    return this.steps[this.currentStep];
  }

  previousStep(): void {
    this.currentStep = Math.max(0, this.currentStep - 1);
  }

  async nextStep(): Promise<void> {
    if (this.saving) {
      return;
    }

    if (this.currentStep < this.steps.length - 1) {
      this.currentStep += 1;
      return;
    }

    await this.finishTour('complete');
  }

  async confirmSkip(): Promise<void> {
    if (this.saving) {
      return;
    }

    const alert = await this.alertController.create({
      header: 'Skip the getting-started tour?',
      message:
        'You can revisit it from More → Getting started. Skipping will not delete your account or progress.',
      buttons: [
        { text: 'Keep touring', role: 'cancel' },
        { text: 'Skip tour', role: 'confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role === 'confirm') {
      await this.finishTour('skip');
    }
  }

  private async finishTour(role: 'complete' | 'skip'): Promise<void> {
    this.saving = true;
    try {
      this.userService.completeOnboarding();
      await this.modalController.dismiss(undefined, role);
    } catch (error) {
      this.saving = false;
      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'Could not save your tutorial progress. Please try again.';
    }
  }
}
