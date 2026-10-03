import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface AppSettings {
  focusDurationMinutes: number;
  breakDurationMinutes: number;
  cascadeRecoveryBuffer: boolean;
  dailyReminder: boolean;
  taskNotifications: boolean;
  reduceMotion: boolean;
  vibrationFeedback: boolean;
  ambientVolume: number;
}

const SETTINGS_KEY = 'focusflow.settings.v1';
const DEFAULT_SETTINGS: AppSettings = {
  focusDurationMinutes: 25,
  breakDurationMinutes: 5,
  cascadeRecoveryBuffer: true,
  dailyReminder: false,
  taskNotifications: true,
  reduceMotion: false,
  vibrationFeedback: true,
  ambientVolume: 0.45,
};

@Injectable({
  providedIn: 'root',
})
export class AppSettingsService {
  private readonly settingsSubject = new BehaviorSubject<AppSettings>(this.load());
  readonly settings$: Observable<AppSettings> = this.settingsSubject.asObservable();

  constructor() {
    document.documentElement.classList.toggle(
      'focusflow-reduce-motion',
      this.settingsSubject.value.reduceMotion,
    );
  }

  getSettings(): AppSettings {
    return this.settingsSubject.value;
  }

  updateSettings(patch: Partial<AppSettings>): void {
    const next = { ...this.settingsSubject.value, ...patch };
    this.settingsSubject.next(next);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    document.documentElement.classList.toggle('focusflow-reduce-motion', next.reduceMotion);
  }

  private load(): AppSettings {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (!saved) {
      return { ...DEFAULT_SETTINGS };
    }

    try {
      const parsed: unknown = JSON.parse(saved);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Settings must be an object.');
      }

      const value = parsed as Record<string, unknown>;
      return {
        focusDurationMinutes: this.validDuration(value['focusDurationMinutes'], 5, 180, 25),
        breakDurationMinutes: this.validDuration(value['breakDurationMinutes'], 5, 60, 5),
        cascadeRecoveryBuffer: value['cascadeRecoveryBuffer'] !== false,
        dailyReminder: value['dailyReminder'] === true,
        taskNotifications: value['taskNotifications'] !== false,
        reduceMotion: value['reduceMotion'] === true,
        vibrationFeedback: value['vibrationFeedback'] !== false,
        ambientVolume:
          typeof value['ambientVolume'] === 'number' &&
          Number.isFinite(value['ambientVolume']) &&
          value['ambientVolume'] >= 0 &&
          value['ambientVolume'] <= 1
            ? value['ambientVolume']
            : 0.45,
      };
    } catch (error) {
      console.error('Could not load saved FocusFlow settings.', error);
      return { ...DEFAULT_SETTINGS };
    }
  }

  private validDuration(value: unknown, minimum: number, maximum: number, fallback: number): number {
    return typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= minimum &&
      value <= maximum &&
      value % 5 === 0
      ? value
      : fallback;
  }
}
