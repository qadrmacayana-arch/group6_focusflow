import { Injectable } from '@angular/core';
import { BehaviorSubject, interval, Observable, Subscription } from 'rxjs';
import { AppSettingsService } from './app-settings.service';

export type FocusPhase = 'idle' | 'engage' | 'focus' | 'recovery' | 'break';
export type FocusLaunchMode = 'deep' | 'micro';

export interface TimerSession {
  running: boolean;
  started: boolean;
  phase: FocusPhase;
  protectedRecovery: boolean;
  timeLeft: number;
  duration: number;
  focusDuration: number;
  currentTaskId: string | null;
  currentTaskTitle: string;
  commitment: string;
  completedCycles: number;
  totalFocusSeconds: number;
  lastFocusBlockSeconds: number;
}

const MICRO_DURATION_SECONDS = 2 * 60;
const RECOVERY_DURATION_SECONDS = 5 * 60;
const LONG_RECOVERY_DURATION_SECONDS = 15 * 60;
const BREAK_DURATION_SECONDS = 5 * 60;
const CYCLES_BEFORE_LONG_RECOVERY = 4;
const TIMER_STORAGE_KEY = 'focusflow.timer.v1';

@Injectable({
  providedIn: 'root',
})
export class TimerService {
  private configuredFocusSeconds = 25 * 60;
  private configuredBreakSeconds = 5 * 60;
  private sessionSubject = new BehaviorSubject<TimerSession>({
    running: false,
    started: false,
    phase: 'idle',
    protectedRecovery: false,
    timeLeft: 25 * 60,
    duration: 25 * 60,
    focusDuration: 25 * 60,
    currentTaskId: null,
    currentTaskTitle: 'Choose a task to begin',
    commitment: '',
    completedCycles: 0,
    totalFocusSeconds: 0,
    lastFocusBlockSeconds: 0,
  });

  readonly session$: Observable<TimerSession> = this.sessionSubject.asObservable();
  persistenceError: string | null = null;
  private timerSub?: Subscription;

  constructor(private settings: AppSettingsService) {
    const { focusDurationMinutes, breakDurationMinutes } = settings.getSettings();
    const restored = this.loadSession();
    if (restored) {
      this.sessionSubject.next({ ...restored, running: false });
    }
    this.updateDurations(focusDurationMinutes, breakDurationMinutes);
    this.saveSession(this.sessionSubject.value);
  }

  updateDurations(focusMinutes: number, breakMinutes: number): void {
    this.configuredFocusSeconds = this.toSeconds(focusMinutes);
    this.configuredBreakSeconds = this.toSeconds(breakMinutes);

    const current = this.sessionSubject.value;
    if (!current.currentTaskId && !current.started) {
      this.publish({
        ...current,
        timeLeft: this.configuredFocusSeconds,
        duration: this.configuredFocusSeconds,
        focusDuration: this.configuredFocusSeconds,
      });
    }
  }

  getSession(): TimerSession {
    return this.sessionSubject.value;
  }

  selectTask(taskId: string | null, taskTitle: string, durationMinutes: number): void {
    const current = this.sessionSubject.value;
    if ((current.phase === 'focus' && current.started) || current.protectedRecovery) {
      return;
    }
    this.stopTimer();
    const duration = taskId ? this.toSeconds(durationMinutes) : this.configuredFocusSeconds;
    this.publish({
      ...current,
      running: false,
      started: false,
      phase: taskId ? 'engage' : 'idle',
      protectedRecovery: false,
      timeLeft: duration,
      duration,
      focusDuration: duration,
      currentTaskId: taskId,
      currentTaskTitle: taskTitle,
      commitment: '',
    });
  }

  selectTimedFocus(title: string, durationMinutes: number): void {
    const current = this.sessionSubject.value;
    if ((current.phase === 'focus' && current.started) || current.protectedRecovery) {
      return;
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 180) {
      throw new Error('Focus timer duration must be between 5 and 180 minutes.');
    }
    this.stopTimer();
    const duration = this.toSeconds(durationMinutes);
    this.publish({
      ...current,
      running: false,
      started: false,
      phase: 'idle',
      protectedRecovery: false,
      timeLeft: duration,
      duration,
      focusDuration: duration,
      currentTaskId: null,
      currentTaskTitle: title,
      commitment: '',
    });
  }

  beginEngagement(): void {
    const current = this.sessionSubject.value;
    if (current.running || current.phase !== 'idle') {
      return;
    }
    this.publish({ ...current, phase: 'engage' });
  }

  start(commitment: string, mode: FocusLaunchMode = 'deep'): void {
    const current = this.sessionSubject.value;
    const cleanCommitment = commitment.trim();
    if (
      current.running ||
      (current.phase !== 'engage' && current.phase !== 'idle') ||
      cleanCommitment.length < 8
    ) {
      return;
    }

    const duration = mode === 'micro' ? MICRO_DURATION_SECONDS : current.focusDuration;
    this.publish({
      ...current,
      running: true,
      started: true,
      phase: 'focus',
      protectedRecovery: false,
      timeLeft: duration,
      duration,
      lastFocusBlockSeconds: 0,
      commitment: cleanCommitment,
    });
    this.runTimer();
  }

  setPhase(phase: Extract<FocusPhase, 'focus' | 'recovery' | 'break'>): void {
    const current = this.sessionSubject.value;
    if (
      current.running ||
      current.phase === 'engage' ||
      (current.phase === 'focus' && current.started) ||
      current.protectedRecovery
    ) {
      return;
    }

    if (phase === 'focus') {
      this.publish({
        ...current,
        running: false,
        started: false,
        phase: 'engage',
        protectedRecovery: false,
        timeLeft: current.focusDuration,
        duration: current.focusDuration,
        commitment: '',
      });
      return;
    }

    const duration =
      phase === 'recovery' ? RECOVERY_DURATION_SECONDS : this.configuredBreakSeconds;

    this.publish({
      ...current,
      phase,
      started: true,
      protectedRecovery: false,
      timeLeft: duration,
      duration,
    });
  }

  resume(): void {
    const current = this.sessionSubject.value;
    if (
      current.running ||
      current.timeLeft <= 0 ||
      current.phase === 'idle' ||
      current.phase === 'engage' ||
      (current.phase === 'focus' && current.commitment.trim().length < 8)
    ) {
      return;
    }

    this.publish({ ...current, running: true });
    this.runTimer();
  }

  resumeRecovery(): void {
    if (this.sessionSubject.value.phase === 'recovery') {
      this.resume();
    }
  }

  pause(): void {
    const current = this.sessionSubject.value;
    if (!current.running || current.protectedRecovery) {
      return;
    }

    this.stopTimer();
    this.publish({
      ...current,
      running: false,
    });
  }

  startRecovery(): void {
    const current = this.sessionSubject.value;
    if (current.phase !== 'recovery' || current.running) {
      return;
    }

    this.publish({
      ...current,
      running: true,
      started: true,
      timeLeft: RECOVERY_DURATION_SECONDS,
      duration: RECOVERY_DURATION_SECONDS,
    });
    this.runTimer();
  }

  finishTask(): string | null {
    const current = this.sessionSubject.value;
    if (current.protectedRecovery && current.running) {
      return null;
    }
    const taskId = current.currentTaskId;
    this.reset(true);
    return taskId;
  }

  emergencyExit(): string | null {
    const current = this.sessionSubject.value;
    this.stopTimer();
    this.publish({
      ...current,
      running: false,
      started: false,
      phase: 'idle',
      protectedRecovery: false,
      timeLeft: current.focusDuration,
      duration: current.focusDuration,
      commitment: '',
    });
    return current.currentTaskId;
  }

  reset(clearTask = false): void {
    const current = this.sessionSubject.value;
    if ((current.phase === 'focus' && current.started) || current.protectedRecovery) {
      return;
    }
    this.stopTimer();
    const currentTaskId = clearTask ? null : current.currentTaskId;
    const currentTaskTitle = clearTask
      ? 'Choose a task to begin'
      : current.currentTaskTitle;
    const focusDuration = clearTask ? this.configuredFocusSeconds : current.focusDuration;
    this.publish({
      ...current,
      running: false,
      started: false,
      phase: 'idle',
      protectedRecovery: false,
      timeLeft: focusDuration,
      duration: focusDuration,
      focusDuration,
      currentTaskId,
      currentTaskTitle,
      commitment: '',
    });
  }

  private runTimer(): void {
    this.stopTimer();
    this.timerSub = interval(1000).subscribe(() => {
      const current = this.sessionSubject.value;
      if (!current.running) {
        return;
      }

      if (current.timeLeft > 1) {
        this.publish({
          ...current,
          timeLeft: current.timeLeft - 1,
          totalFocusSeconds:
            current.phase === 'focus'
              ? current.totalFocusSeconds + 1
              : current.totalFocusSeconds,
        });
        return;
      }

      if (current.phase === 'focus') {
        const completedCycles = current.completedCycles + 1;
        const nextPhase = this.settings.getSettings().cascadeRecoveryBuffer
          ? 'recovery'
          : 'break';
        const recoveryDuration =
          completedCycles % CYCLES_BEFORE_LONG_RECOVERY === 0
            ? LONG_RECOVERY_DURATION_SECONDS
            : RECOVERY_DURATION_SECONDS;
        this.publish({
          ...current,
          phase: nextPhase,
          protectedRecovery: nextPhase === 'recovery',
          completedCycles,
          totalFocusSeconds: current.totalFocusSeconds + 1,
          lastFocusBlockSeconds: current.duration,
          timeLeft: nextPhase === 'recovery' ? recoveryDuration : this.configuredBreakSeconds,
          duration: nextPhase === 'recovery' ? recoveryDuration : this.configuredBreakSeconds,
        });
        return;
      }

      if (current.phase === 'recovery') {
        this.publish({
          ...current,
          phase: 'break',
          protectedRecovery: false,
          timeLeft: this.configuredBreakSeconds,
          duration: this.configuredBreakSeconds,
        });
        return;
      }

      this.stopTimer();
      this.publish({
        ...current,
        running: false,
        started: false,
        phase: 'idle',
        timeLeft: current.focusDuration,
        duration: current.focusDuration,
        commitment: '',
      });
    });
  }

  private stopTimer(): void {
    this.timerSub?.unsubscribe();
    this.timerSub = undefined;
  }

  private publish(session: TimerSession): void {
    this.sessionSubject.next(session);
    this.saveSession(session);
  }

  private loadSession(): TimerSession | null {
    let saved: string | null;
    try {
      saved = localStorage.getItem(TIMER_STORAGE_KEY);
    } catch (error) {
      console.error('Could not read the saved FocusFlow timer session.', error);
      this.persistenceError = 'This device could not read your saved focus session.';
      return null;
    }

    if (!saved) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(saved);
      if (!this.isTimerSession(parsed)) {
        throw new Error('Saved timer session has an invalid shape.');
      }
      return parsed;
    } catch (error) {
      console.error('Could not restore the saved FocusFlow timer session.', error);
      try {
        localStorage.removeItem(TIMER_STORAGE_KEY);
      } catch (storageError) {
        console.error('Could not clear the invalid FocusFlow timer session.', storageError);
      }
      return null;
    }
  }

  private saveSession(session: TimerSession): void {
    try {
      localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(session));
      this.persistenceError = null;
    } catch (error) {
      if (!this.persistenceError) {
        console.error('Could not save the FocusFlow timer session.', error);
      }
      this.persistenceError =
        'This session could not be saved on this device. Avoid refreshing until it is complete.';
    }
  }

  private isTimerSession(value: unknown): value is TimerSession {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const session = value as Record<string, unknown>;
    return (
      typeof session['running'] === 'boolean' &&
      typeof session['started'] === 'boolean' &&
      ['idle', 'engage', 'focus', 'recovery', 'break'].includes(
        session['phase'] as string,
      ) &&
      typeof session['protectedRecovery'] === 'boolean' &&
      typeof session['timeLeft'] === 'number' &&
      Number.isFinite(session['timeLeft']) &&
      session['timeLeft'] >= 0 &&
      typeof session['duration'] === 'number' &&
      Number.isFinite(session['duration']) &&
      session['duration'] > 0 &&
      typeof session['focusDuration'] === 'number' &&
      Number.isFinite(session['focusDuration']) &&
      session['focusDuration'] > 0 &&
      (typeof session['currentTaskId'] === 'string' || session['currentTaskId'] === null) &&
      typeof session['currentTaskTitle'] === 'string' &&
      typeof session['commitment'] === 'string' &&
      typeof session['completedCycles'] === 'number' &&
      Number.isInteger(session['completedCycles']) &&
      session['completedCycles'] >= 0 &&
      typeof session['totalFocusSeconds'] === 'number' &&
      Number.isFinite(session['totalFocusSeconds']) &&
      session['totalFocusSeconds'] >= 0 &&
      typeof session['lastFocusBlockSeconds'] === 'number' &&
      Number.isFinite(session['lastFocusBlockSeconds']) &&
      session['lastFocusBlockSeconds'] >= 0
    );
  }

  private toSeconds(minutes: number): number {
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return this.configuredFocusSeconds;
    }
    return Math.round(minutes * 60);
  }
}
