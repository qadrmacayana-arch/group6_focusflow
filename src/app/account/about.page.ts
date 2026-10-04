import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { IonButton, IonContent, ModalController } from '@ionic/angular/standalone';
import { OnboardingModalComponent } from '../onboarding/onboarding-modal.component';

@Component({
  selector: 'app-about',
  template: `
    <ion-content class="account-content">
      <main class="account-page">
        <span class="account-eyebrow">A calmer way to get things done</span>
        <h1 class="account-title">Help &amp; About</h1>
        <p class="account-intro">
          FocusFlow helps you plan work, start with one small action, and take breaks between focus sessions.
        </p>
        <ion-button class="account-action tour-launch-button" (click)="openGettingStartedTour()">
          Take the interactive tour
        </ion-button>

        <section class="account-card">
          <h2>Getting started</h2>
          <ol class="tutorial-steps">
            <li><strong>Add your tasks.</strong> Open Tasks, enter a title, and optionally set a deadline and timer length.</li>
            <li><strong>Plan your month.</strong> Open Plan to browse task dates, choose a day, or write a timed reminder.</li>
            <li><strong>Allow alerts.</strong> In Plan, enable browser notifications. Keep FocusFlow open to receive scheduled alerts.</li>
            <li><strong>Start focusing.</strong> Choose a task or reminder, write the first small step, then start the timer.</li>
            <li><strong>Review finished work.</strong> Completed tasks stay in the Task archive on the Tasks screen. Archive individual tasks, restore them later, or permanently delete one after confirmation.</li>
            <li><strong>Make it yours.</strong> Open Settings to change focus and break lengths or notification preferences.</li>
          </ol>
        </section>

        <section class="account-card">
          <h2>Quick answers</h2>
          <details><summary>Does FocusFlow lock my phone or other apps?</summary><p>No. A focus session keeps you on the FocusFlow timer screen, but it cannot block other apps or tabs.</p></details>
          <details><summary>Do task and reminder alerts work when the app is closed?</summary><p>No. Browser alerts need permission and FocusFlow must remain open. If your browser suspends the app, a scheduled alert may be delayed.</p></details>
          <details><summary>Is my account connected to a real sign-in provider?</summary><p>No. Email and password sign-in is a local test account stored in this browser. Passwords are stored as salted hashes, but email ownership is not verified and there is no password reset or cloud account. Use a unique test password; do not enter sensitive information.</p></details>
          <details><summary>Will I be charged for a plan?</summary><p>No. Subscription prices are proposed previews only. Checkout, renewals, and student verification are not connected.</p></details>
          <details><summary>Are my tasks and progress saved?</summary><p>Yes, the current prototype stores them in this browser on this device. They are not backed up or synced to a server.</p></details>
        </section>

        <section class="account-card">
          <h2>What works today</h2>
          <ul class="account-list">
            <li>Tasks, monthly calendar, reminders, and completed-task archive saved on this device</li>
            <li>Focus timer, break settings, and optional ambient sounds</li>
            <li>Canvas course assignment import</li>
            <li>No payment processor, cloud account, or student verification provider</li>
          </ul>
        </section>
        <p class="account-note">Your feedback helps us decide what to build next. Contact and support channels can be added when the production service is ready.</p>
      </main>
    </ion-content>
  `,
  styleUrls: ['./account-shared.scss', './about.page.scss'],
  standalone: true,
  imports: [CommonModule, IonButton, IonContent],
})
export class AboutPage {
  constructor(private readonly modalController: ModalController) {}

  async openGettingStartedTour(): Promise<void> {
    const modal = await this.modalController.create({
      component: OnboardingModalComponent,
      cssClass: 'onboarding-modal',
      backdropDismiss: false,
      canDismiss: async (_data, role) => role === 'complete' || role === 'skip',
    });
    await modal.present();
  }
}
