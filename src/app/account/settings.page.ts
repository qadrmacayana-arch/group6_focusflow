import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent } from '@ionic/angular/standalone';
import { AppSettings, AppSettingsService } from '../services/app-settings.service';
import { TimerService } from '../services/timer.service';

@Component({
  selector: 'app-settings',
  template: `
    <ion-content class="account-content">
      <main class="account-page" *ngIf="settings$ | async as settings">
        <span class="account-eyebrow">Make it work for you</span>
        <h1 class="account-title">Settings</h1>
        <p class="account-intro">Tune your study rhythm, reminders, and accessibility. Changes save automatically on this device.</p>

        <section class="account-card">
          <h2>Focus rhythm</h2>
          <label class="account-field">
            Default focus timer
            <span class="duration-setting">
              <input type="number" min="5" max="180" step="5" [ngModel]="focusDurationDraft" (ngModelChange)="focusDurationDraft = $event" (blur)="setFocusDuration(focusDurationDraft)" />
              <span>minutes</span>
            </span>
          </label>
          <label class="account-field">
            Short break
            <span class="duration-setting">
              <input type="number" min="5" max="60" step="5" [ngModel]="breakDurationDraft" (ngModelChange)="breakDurationDraft = $event" (blur)="setBreakDuration(breakDurationDraft)" />
              <span>minutes</span>
            </span>
          </label>
          <p class="account-note">Choose 5 to 180 minutes for focus and 5 to 60 minutes for breaks. Task timers can have their own duration.</p>
        </section>
        <p class="account-note" *ngIf="durationMessage" role="status">{{ durationMessage }}</p>

        <section class="account-card">
          <h2>Breaks</h2>
          <label class="setting-row">
            <span><strong>Automatic recovery breaks</strong><small>Start a 5-minute recovery after each focus timer. Every fourth recovery break lasts 15 minutes.</small></span>
            <input type="checkbox" [ngModel]="settings.cascadeRecoveryBuffer" (ngModelChange)="setPreference('cascadeRecoveryBuffer', $event)" />
          </label>
        </section>

        <section class="account-card">
          <h2>Notifications &amp; feedback</h2>
          <label class="setting-row">
            <span><strong>Task deadline alerts</strong><small>Show a browser alert at a task’s due time. Tasks without a due time use 9:00 AM.</small></span>
            <input type="checkbox" [ngModel]="settings.taskNotifications" (ngModelChange)="setPreference('taskNotifications', $event)" />
          </label>
          <label class="setting-row">
            <span><strong>Vibration feedback</strong><small>Use subtle device haptics when supported.</small></span>
            <input type="checkbox" [ngModel]="settings.vibrationFeedback" (ngModelChange)="setPreference('vibrationFeedback', $event)" />
          </label>
          <p class="account-note">Allow browser notifications on the Calendar screen. Scheduled alerts work while FocusFlow is open.</p>
        </section>

        <section class="account-card">
          <h2>Accessibility</h2>
          <label class="setting-row">
            <span><strong>Reduce motion</strong><small>Limit decorative movement and transitions.</small></span>
            <input type="checkbox" [ngModel]="settings.reduceMotion" (ngModelChange)="setPreference('reduceMotion', $event)" />
          </label>
        </section>
        <p class="account-status" role="status">Settings save automatically on this device.</p>
      </main>
    </ion-content>
  `,
  styleUrls: ['./account-shared.scss', './settings.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent],
})
export class SettingsPage {
  readonly settings$ = this.settingsService.settings$;
  focusDurationDraft: number | null;
  breakDurationDraft: number | null;
  durationMessage = '';

  constructor(
    private settingsService: AppSettingsService,
    private timerService: TimerService,
  ) {
    const settings = this.settingsService.getSettings();
    this.focusDurationDraft = settings.focusDurationMinutes;
    this.breakDurationDraft = settings.breakDurationMinutes;
  }

  setFocusDuration(value: number | null): void {
    const minutes = Number(value);
    if (this.validDuration(minutes, 5, 180)) {
      this.updateDurations({ focusDurationMinutes: minutes });
      this.durationMessage = '';
    } else {
      this.focusDurationDraft = this.settingsService.getSettings().focusDurationMinutes;
      this.durationMessage = 'Focus duration must be 5 to 180 minutes in 5-minute steps.';
    }
  }

  setBreakDuration(value: number | null): void {
    const minutes = Number(value);
    if (this.validDuration(minutes, 5, 60)) {
      this.updateDurations({ breakDurationMinutes: minutes });
      this.durationMessage = '';
    } else {
      this.breakDurationDraft = this.settingsService.getSettings().breakDurationMinutes;
      this.durationMessage = 'Break duration must be 5 to 60 minutes in 5-minute steps.';
    }
  }

  setPreference(
    key: 'cascadeRecoveryBuffer' | 'dailyReminder' | 'taskNotifications' | 'vibrationFeedback' | 'reduceMotion',
    value: boolean,
  ): void {
    this.settingsService.updateSettings({ [key]: value });
  }

  private updateDurations(
    patch: Partial<Pick<AppSettings, 'focusDurationMinutes' | 'breakDurationMinutes'>>,
  ): void {
    const current = this.settingsService.getSettings();
    const next = { ...current, ...patch };
    this.settingsService.updateSettings(patch);
    this.timerService.updateDurations(next.focusDurationMinutes, next.breakDurationMinutes);
  }

  private validDuration(value: number, minimum: number, maximum: number): boolean {
    return Number.isInteger(value) && value >= minimum && value <= maximum && value % 5 === 0;
  }
}
