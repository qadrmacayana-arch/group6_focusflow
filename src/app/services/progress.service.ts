import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

interface ProgressState {
  totalXp: number;
  rewardedTaskIds: string[];
}

function isProgressState(value: unknown): value is ProgressState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const state = value as Record<string, unknown>;
  return (
    typeof state['totalXp'] === 'number' &&
    Number.isSafeInteger(state['totalXp']) &&
    state['totalXp'] >= 0 &&
    Array.isArray(state['rewardedTaskIds']) &&
    state['rewardedTaskIds'].every((taskId: unknown) => typeof taskId === 'string')
  );
}

@Injectable({
  providedIn: 'root',
})
export class ProgressService {
  private readonly storageKey = 'focusflow.xp.v2';
  private readonly legacyStorageKey = 'focusflow.xp.v1';
  private rewardedTaskIds = new Set<string>();
  private readonly xpSubject = new BehaviorSubject<number>(this.loadXp());
  readonly xp$: Observable<number> = this.xpSubject.asObservable();

  getXp(): number {
    return this.xpSubject.value;
  }

  earnXp(amount: number): number {
    if (!Number.isFinite(amount) || amount <= 0) {
      return this.xpSubject.value;
    }

    const total = this.xpSubject.value + Math.floor(amount);
    this.saveProgress(total, this.rewardedTaskIds);
    this.xpSubject.next(total);
    return total;
  }

  awardTaskCompletion(taskId: string, amount: number): boolean {
    if (!taskId || this.rewardedTaskIds.has(taskId) || !Number.isFinite(amount) || amount <= 0) {
      return false;
    }

    const rewardedTaskIds = new Set(this.rewardedTaskIds);
    rewardedTaskIds.add(taskId);
    this.saveProgress(this.xpSubject.value + Math.floor(amount), rewardedTaskIds);
    this.rewardedTaskIds = rewardedTaskIds;
    this.xpSubject.next(this.xpSubject.value + Math.floor(amount));
    return true;
  }

  private loadXp(): number {
    const saved = localStorage.getItem(this.storageKey);
    if (saved === null) {
      const legacy = localStorage.getItem(this.legacyStorageKey);
      if (legacy === null) {
        return 0;
      }
      const legacyXp = Number(legacy);
      if (!Number.isSafeInteger(legacyXp) || legacyXp < 0) {
        console.error('Saved FocusFlow XP is invalid; starting progress at zero.');
        localStorage.removeItem(this.legacyStorageKey);
        return 0;
      }
      return legacyXp;
    }

    try {
      const parsed: unknown = JSON.parse(saved);
      if (!isProgressState(parsed)) {
        throw new Error('Saved progress has an invalid shape.');
      }
      this.rewardedTaskIds = new Set(parsed.rewardedTaskIds);
      localStorage.removeItem(this.legacyStorageKey);
      return parsed.totalXp;
    } catch (error) {
      console.error('Could not load saved FocusFlow progress.', error);
      localStorage.removeItem(this.storageKey);
      localStorage.removeItem(this.legacyStorageKey);
      return 0;
    }
  }

  private saveProgress(totalXp: number, rewardedTaskIds: Set<string>): void {
    localStorage.setItem(
      this.storageKey,
      JSON.stringify({ totalXp, rewardedTaskIds: [...rewardedTaskIds] }),
    );
    localStorage.removeItem(this.legacyStorageKey);
  }
}
