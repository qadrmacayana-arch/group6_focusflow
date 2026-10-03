import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, Inject, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonContent,
  IonTextarea,
  AlertController,
  ToastController,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Subtask, Task, TaskService } from '../services/task.service';
import {
  FocusLaunchMode,
  FocusPhase,
  TimerService,
  TimerSession,
} from '../services/timer.service';
import { ProgressService } from '../services/progress.service';
import { AmbientMode, FocusAudioService } from '../services/focus-audio.service';
import { AppSettingsService } from '../services/app-settings.service';

type ResearchTab = 'focus' | 'buffer' | 'canvas';
type BreathPhase = 'Inhale' | 'Hold' | 'Exhale' | 'Pause';

interface ResearchFeature {
  id: ResearchTab;
  title: string;
  badge: string;
  persona: string;
  problem: string;
  rationale: string;
  solution: string;
}

const DEFAULT_FOCUS_SECONDS = 25 * 60;
const MICRO_FOCUS_SECONDS = 2 * 60;
const MIN_COMMITMENT_LENGTH = 8;

const MOTIVATIONS = [
  'Deep work is not a habit of discipline, but an architecture of attention.',
  'Your commitment is locked in. Let momentum carry you forward.',
  'One concrete sentence written beats an hour of conceptual staring.',
  'The urge to switch tasks is just temporary friction. Breathe through it.',
  'Guard your cognitive space like your most precious resource.',
  'Distraction is just an impulse looking for an exit. Stay right here.',
  'Progress happens when the brain accepts this exact moment is the task.',
  'Five minutes of flow unlocks the next thirty. Keep your focus pure.',
];

const SOUND_OPTIONS: {
  id: AmbientMode;
  label: string;
  icon: string;
  description: string;
}[] = [
  { id: 'off', label: 'Off', icon: '🔇', description: 'Quiet focus, no background sound' },
  { id: 'lofi', label: 'Lo-fi', icon: '🎹', description: 'A mellow, original lo-fi loop' },
  { id: 'rain', label: 'Rain', icon: '🌧️', description: 'Soft, steady rainfall' },
  { id: 'ocean', label: 'Ocean', icon: '🌊', description: 'Slow, gentle ocean swells' },
  { id: 'forest', label: 'Forest', icon: '🌿', description: 'Soft, filtered forest ambience' },
  { id: 'cafe', label: 'Cafe', icon: '☕', description: 'Warm cafe room tone' },
  { id: 'vinyl', label: 'Vinyl', icon: '📻', description: 'A soft, dusty analog texture' },
  { id: 'binaural', label: 'Binaural', icon: '🎧', description: 'Gentle binaural tones' },
  { id: 'whitenoise', label: 'White noise', icon: '〰️', description: 'Soft filtered noise' },
];

const VOLUME_STEPS = [0.15, 0.3, 0.45, 0.7, 1];

const RESEARCH_FEATURES: ResearchFeature[] = [
  {
    id: 'focus',
    title: 'Focus Timer',
    badge: 'FEATURE 1',
    persona: 'Antonio & Perez',
    problem:
      "Users have a hard time actually getting tasks started, not just staying focused once underway. Antonio just stares at tasks without starting them, and Perez's manual timer method gets overridden by distractions.",
    rationale:
      'Directly addresses starting friction surfaced in user interviews. A concrete first-action commitment is required before the focus timer starts.',
    solution:
      'Requires typing the first concrete action or launching a 2-minute micro-burst before the flow cycle begins. FocusFlow navigation stays locked during the engagement gate and focus session; it does not lock other phone apps.',
  },
  {
    id: 'buffer',
    title: 'Timed Recovery Breaks',
    badge: 'FEATURE 2',
    persona: 'Empeño',
    problem:
      'Empeño described the overrun-then-exhaustion cascade: falling behind on one task leads to exhaustion and rushed, lower-quality work on the next.',
    rationale:
      'A protected recovery period helps prevent fatigue from stacking across focus blocks.',
    solution:
      'Starts a protected timed recovery phase after focus: 5 minutes, or 15 minutes every fourth completed focus block. It does not currently reschedule calendar blocks.',
  },
  {
    id: 'canvas',
    title: 'Course Assignments',
    badge: 'FEATURE 3',
    persona: 'Students using Canvas',
    problem:
      'Students manage coursework in Canvas separately from the place they plan and focus, making it easy to miss or postpone assignments.',
    rationale:
      'Canvas assignments become actionable FocusFlow tasks, so students can move directly from seeing coursework to choosing a concrete first action and starting a focus session.',
    solution:
      'Connect with a Canvas access token in the Canvas tab, sync available assignments, then use Start focus on an assignment to open its first-action gate.',
  },
];

@Component({
  selector: 'app-focus',
  templateUrl: 'focus.page.html',
  styleUrls: ['focus.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonButton, IonTextarea],
})
export class FocusPage implements OnDestroy {
  readonly session$ = this.timerService.session$;
  readonly tasks$ = this.taskService.tasks$;
  readonly settings$ = this.settings.settings$;
  readonly phases: { id: Extract<FocusPhase, 'focus' | 'recovery' | 'break'>; label: string }[] = [
    { id: 'focus', label: 'Focus' },
    { id: 'recovery', label: 'Long break' },
    { id: 'break', label: 'Break' },
  ];
  readonly cycleDots = [0, 1, 2, 3];
  readonly microPrompts = [
    'Open slide 1 & write summary bullet',
    'Write function header & initial return',
    'Review 1st feedback note in Figma',
    'Read first 2 pages of literature review',
  ];
  readonly soundOptions = SOUND_OPTIONS;
  readonly volumeSteps = VOLUME_STEPS;
  readonly researchFeatures = RESEARCH_FEATURES;
  readonly motivations = MOTIVATIONS;

  commitment = '';
  focusStepDraft = '';
  validationMessage = '';
  showTaskPicker = false;
  launchMode: FocusLaunchMode = 'deep';
  ambientMode: AmbientMode = 'off';
  ambientVolume = 0.45;
  audioError = '';
  researchModalOpen = false;
  researchTab: ResearchTab = 'focus';
  focusNudgeOpen = false;
  focusPausedForLeaving = false;
  breathingOpen = false;
  breathPhase: BreathPhase = 'Inhale';
  breathPhaseSeconds = 4;
  breathingSecondsLeft = 5 * 60;
  quoteIndex = 0;
  burstActive = false;

  private quoteInterval?: ReturnType<typeof setInterval>;
  private breathingInterval?: ReturnType<typeof setInterval>;
  private breathPhaseInterval?: ReturnType<typeof setInterval>;
  private burstTimeout?: ReturnType<typeof setTimeout>;
  private sessionSubscription?: Subscription;
  private previousPhase: FocusPhase = this.timerService.getSession().phase;
  private readonly visibilityChangeHandler = (): void => {
    const session = this.timerService.getSession();
    if (
      this.document.visibilityState === 'hidden' &&
      session.phase === 'focus' &&
      session.running
    ) {
      this.focusPausedForLeaving = true;
      this.timerService.pause();
    }
  };

  constructor(
    public timerService: TimerService,
    private taskService: TaskService,
    private progressService: ProgressService,
    private router: Router,
    private toastController: ToastController,
    private focusAudio: FocusAudioService,
    private settings: AppSettingsService,
    private alertController: AlertController,
    @Inject(DOCUMENT) private document: Document,
  ) {
    this.ambientVolume = settings.getSettings().ambientVolume ?? 0.45;
    this.document.addEventListener('visibilitychange', this.visibilityChangeHandler);
    this.sessionSubscription = this.timerService.session$.subscribe((session) => {
      this.syncQuoteRotation(session);
      if (
        session.phase !== this.previousPhase &&
        (session.phase === 'recovery' || session.phase === 'break')
      ) {
        this.focusAudio.playFeedback('bell');
      }
      this.previousPhase = session.phase;
    });
  }

  get currentResearchFeature(): ResearchFeature {
    return this.researchFeatures.find((feature) => feature.id === this.researchTab) ??
      this.researchFeatures[0];
  }

  activeTarget(session: TimerSession): string {
    if (session.currentTaskId) {
      return session.currentTaskTitle;
    }
    return session.currentTaskTitle === 'Choose a task to begin'
      ? 'Focus session'
      : session.currentTaskTitle;
  }

  activeTaskDetails(session: TimerSession): string {
    const task = this.activeTask(session);
    if (!task) {
      return `No task selected · ${this.recoveryEstimate(session)}`;
    }
    const course = task.sourceCourse ? `${task.sourceCourse} · ` : '';
    return `${course}${task.duration} min estimated · ${task.category} · ${this.recoveryEstimate(session)}`;
  }

  activeTask(session: TimerSession): Task | undefined {
    return session.currentTaskId
      ? this.taskService.getTasks().find((task) => task.id === session.currentTaskId)
      : undefined;
  }

  focusStepProgress(task: Task): number {
    if (!task.subtasks.length) {
      return 0;
    }
    return Math.round(
      (task.subtasks.filter((subtask) => subtask.done).length / task.subtasks.length) * 100,
    );
  }

  toggleFocusStep(task: Task, subtask: Subtask): void {
    this.focusAudio.playFeedback(subtask.done ? 'tap' : 'done');
    this.taskService.toggleSubtask(task.id, subtask.id);
  }

  addFocusStep(task: Task): void {
    const title = this.focusStepDraft.trim();
    if (!title) {
      return;
    }
    this.taskService.addSubtask(task.id, title);
    this.focusStepDraft = '';
    this.focusAudio.playFeedback('tap');
  }

  toggleFocusNudge(): void {
    this.focusNudgeOpen = !this.focusNudgeOpen;
    this.focusAudio.playFeedback('tap');
  }

  recoveryEstimate(session: TimerSession): string {
    if (!this.settings.getSettings().cascadeRecoveryBuffer) {
      return 'no automatic break';
    }
    const nextCycle = session.completedCycles + 1;
    return nextCycle % 4 === 0 ? '+15m break' : '+5m break';
  }

  openTasks(tasks: Task[]): Task[] {
    return tasks.filter((task) => task.status !== 'completed');
  }

  selectTask(task: Task): void {
    this.focusAudio.playFeedback('tap');
    this.timerService.selectTask(task.id, this.displayTitle(task.title, task.sourceCourse), task.duration);
    this.commitment = '';
    this.focusStepDraft = '';
    this.focusNudgeOpen = false;
    this.validationMessage = '';
    this.launchMode = 'deep';
    this.showTaskPicker = false;
  }

  selectFreeSprint(): void {
    this.focusAudio.playFeedback('tap');
    this.timerService.selectTask(null, 'Focus session', DEFAULT_FOCUS_SECONDS / 60);
    this.commitment = '';
    this.focusStepDraft = '';
    this.focusNudgeOpen = false;
    this.validationMessage = '';
    this.launchMode = 'deep';
    this.showTaskPicker = false;
  }

  toggleTaskPicker(): void {
    this.focusAudio.playFeedback('tap');
    this.showTaskPicker = !this.showTaskPicker;
  }

  openTasksPage(): void {
    this.showTaskPicker = false;
    void this.router.navigate(['/tabs/tasks']);
  }

  beginEngagement(): void {
    this.focusAudio.playFeedback('tap');
    this.validationMessage = '';
    this.timerService.beginEngagement();
  }

  startSession(): void {
    const cleanCommitment = this.commitment.trim();
    if (cleanCommitment.length < MIN_COMMITMENT_LENGTH) {
      this.focusAudio.playFeedback('lock');
      this.validationMessage = `Write at least ${MIN_COMMITMENT_LENGTH} characters describing your first step.`;
      return;
    }

    this.validationMessage = '';
    this.timerService.start(cleanCommitment, this.launchMode);
    const taskId = this.timerService.getSession().currentTaskId;
    if (taskId) {
      this.taskService.setTaskStatus(taskId, 'in_progress');
    }
    this.focusAudio.playFeedback('start');
    this.triggerBurst();
  }

  mainAction(session: TimerSession): void {
    this.focusAudio.playFeedback(session.running ? 'tap' : 'start');
    if (session.running) {
      this.timerService.pause();
    } else if (session.phase === 'idle') {
      this.beginEngagement();
    } else if (session.phase === 'focus' || session.phase === 'recovery' || session.phase === 'break') {
      this.timerService.resume();
      if (this.timerService.getSession().running) {
        this.focusPausedForLeaving = false;
      }
    }
  }

  resumeProtectedRecovery(): void {
    this.timerService.resumeRecovery();
  }

  setPhase(phase: Extract<FocusPhase, 'focus' | 'recovery' | 'break'>): void {
    this.focusAudio.playFeedback('tap');
    this.commitment = '';
    this.validationMessage = '';
    this.timerService.setPhase(phase);
  }

  chooseLaunchMode(mode: FocusLaunchMode): void {
    this.focusAudio.playFeedback('tap');
    this.launchMode = mode;
  }

  useMicroPrompt(prompt: string): void {
    this.focusAudio.playFeedback('tap');
    this.commitment = prompt;
    this.validationMessage = '';
  }

  resetSession(): void {
    this.focusAudio.playFeedback('tap');
    const taskId = this.timerService.getSession().currentTaskId;
    this.timerService.reset();
    if (taskId) {
      this.taskService.setTaskStatus(taskId, 'pending');
    }
    this.commitment = '';
    this.focusStepDraft = '';
    this.validationMessage = '';
    this.launchMode = 'deep';
  }

  cancelEngagement(): void {
    if (this.timerService.getSession().phase !== 'engage') {
      return;
    }
    this.timerService.reset();
    this.commitment = '';
    this.focusStepDraft = '';
    this.validationMessage = '';
    this.launchMode = 'deep';
  }

  async confirmEmergencyExit(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'End this focus session?',
      message: 'Your timer will stop and your task will stay open. Use this whenever you need to leave urgently.',
      buttons: [
        { text: 'Stay in Focus', role: 'cancel' },
        {
          text: 'End session',
          role: 'destructive',
          handler: () => {
            const taskId = this.timerService.emergencyExit();
            if (taskId) {
              this.taskService.setTaskStatus(taskId, 'pending');
            }
            this.commitment = '';
            this.focusStepDraft = '';
            this.focusPausedForLeaving = false;
            this.focusAudio.playFeedback('tap');
          },
        },
      ],
    });
    await alert.present();
  }

  async completeTask(): Promise<void> {
    const session = this.timerService.getSession();
    if (
      session.phase !== 'break' ||
      session.protectedRecovery ||
      session.commitment.trim().length < MIN_COMMITMENT_LENGTH
    ) {
      return;
    }
    const taskId = this.timerService.finishTask();
    const xpEarned = 50 + session.completedCycles * 10;
    let earnedXp = true;
    if (taskId) {
      this.taskService.setTaskStatus(taskId, 'completed');
      earnedXp = this.progressService.awardTaskCompletion(taskId, xpEarned);
    } else {
      this.progressService.earnXp(xpEarned);
    }
    this.commitment = '';
    this.validationMessage = '';
    this.focusAudio.playFeedback('done');
    this.triggerBurst();
    const toast = await this.toastController.create({
      message: earnedXp
        ? `Focus session completed. You earned ${xpEarned} points.`
        : 'Focus session completed. This task has already earned its completion points.',
      duration: 2400,
      position: 'bottom',
      color: 'success',
    });
    await toast.present();
  }

  phaseName(phase: FocusPhase): string {
    return {
      idle: 'Ready',
      engage: 'Ready to start',
      focus: 'In Focus',
      recovery: 'Long break',
      break: 'Break',
    }[phase];
  }

  timerDisplay(session: TimerSession): string {
    return session.phase === 'idle' || session.phase === 'engage'
      ? 'READY'
      : this.formatTime(session.timeLeft);
  }

  timerDescription(session: TimerSession): string {
    if (session.phase === 'idle') {
      return `${Math.ceil(session.focusDuration / 60)}-minute session · set up to begin`;
    }
    if (session.phase === 'engage') {
      return `${Math.ceil(session.focusDuration / 60)}-minute session · starts after Unlock & Start`;
    }
    return `${this.phaseName(session.phase)} · ${this.formatTime(session.timeLeft)} remaining`;
  }

  phaseColor(phase: FocusPhase): string {
    if (phase === 'recovery') {
      return '#e58a72';
    }
    if (phase === 'break') {
      return '#55a89c';
    }
    return '#8068d8';
  }

  recoveryDurationLabel(session: TimerSession): string {
    return `${Math.ceil(session.duration / 60)}-minute`;
  }

  completedBlockMinutes(session: TimerSession): number {
    return Math.max(1, Math.round(session.lastFocusBlockSeconds / 60));
  }

  completedStepsLabel(task: Task): string {
    const completed = task.subtasks.filter((subtask) => subtask.done).length;
    return `${completed} of ${task.subtasks.length} task steps marked complete`;
  }

  phaseTrail(phase: FocusPhase): string {
    if (phase === 'recovery') {
      return '#f8e8e2';
    }
    return phase === 'break' ? '#e3f3ef' : '#eee9fb';
  }

  cycleComplete(index: number, completedCycles: number): boolean {
    return completedCycles > 0 && (completedCycles % 4 === 0 || index < completedCycles % 4);
  }

  formatTime(seconds: number): string {
    const safeSeconds = Math.max(0, seconds);
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  progressPercent(session: TimerSession): number {
    if (session.phase === 'idle' || session.phase === 'engage' || session.duration <= 0) {
      return 0;
    }
    return Math.min(
      100,
      Math.max(0, ((session.duration - session.timeLeft) / session.duration) * 100),
    );
  }

  get commitmentLength(): number {
    return this.commitment.trim().length;
  }

  get commitmentReady(): boolean {
    return this.commitmentLength >= MIN_COMMITMENT_LENGTH;
  }

  get cascadeBufferEnabled(): boolean {
    return this.settings.getSettings().cascadeRecoveryBuffer;
  }

  toggleCascadeBuffer(): void {
    const enabled = !this.cascadeBufferEnabled;
    this.settings.updateSettings({ cascadeRecoveryBuffer: enabled });
    void this.toastController
      .create({
        message: enabled
          ? 'Automatic breaks are on. A five-minute break will follow your next focus timer.'
          : 'Automatic breaks are off. Focus timers will move directly to their regular break.',
        duration: 2400,
        position: 'bottom',
      })
      .then((toast) => toast.present());
  }

  get commitmentProgress(): number {
    return Math.min(100, (this.commitmentLength / MIN_COMMITMENT_LENGTH) * 100);
  }

  get activeSoundDescription(): string {
    return this.soundOptions.find((sound) => sound.id === this.ambientMode)?.description ??
      'Silent focus';
  }

  async toggleAmbientMode(mode: AmbientMode): Promise<void> {
    const nextMode = this.ambientMode === mode ? 'off' : mode;
    this.audioError = '';
    const error = await this.focusAudio.setAmbientMode(nextMode, this.ambientVolume);
    if (error) {
      this.ambientMode = 'off';
      this.audioError = error;
      return;
    }
    this.ambientMode = nextMode;
  }

  setAmbientVolume(volume: number): void {
    this.ambientVolume = volume;
    this.focusAudio.setVolume(volume);
    this.settings.updateSettings({ ambientVolume: volume });
  }

  openResearch(): void {
    this.focusAudio.playFeedback('tap');
    this.researchModalOpen = true;
  }

  selectResearchTab(tab: ResearchTab): void {
    this.focusAudio.playFeedback('tap');
    this.researchTab = tab;
  }

  closeResearch(): void {
    this.focusAudio.playFeedback('tap');
    this.researchModalOpen = false;
  }

  takeResearchAction(): void {
    const selectedTab = this.researchTab;
    this.closeResearch();
    if (selectedTab === 'canvas') {
      void this.router.navigate(['/tabs/canvas']);
    } else if (selectedTab === 'buffer') {
      this.openTasksPage();
    }
  }

  openBreathingRoom(): void {
    this.focusAudio.playFeedback('start');
    this.breathingSecondsLeft = 5 * 60;
    this.breathingOpen = true;
    this.startBreathingIntervals();
  }

  closeBreathingRoom(): void {
    this.breathingOpen = false;
    this.stopBreathingIntervals();
    if (this.ambientMode === 'rain') {
      this.ambientMode = 'off';
      this.focusAudio.stopAmbient();
    }
  }

  async completeBreathingRoom(): Promise<void> {
    this.progressService.earnXp(30);
    this.focusAudio.playFeedback('done');
    this.closeBreathingRoom();
    const toast = await this.toastController.create({
      message: 'Break complete. You earned 30 points.',
      duration: 2400,
      position: 'bottom',
      color: 'success',
    });
    await toast.present();
  }

  toggleBreathingRain(): void {
    void this.toggleAmbientMode('rain');
  }

  ngOnDestroy(): void {
    this.document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    this.sessionSubscription?.unsubscribe();
    this.clearInterval(this.quoteInterval);
    this.stopBreathingIntervals();
    if (this.burstTimeout) {
      clearTimeout(this.burstTimeout);
    }
    this.focusAudio.destroy();
  }

  ionViewWillLeave(): void {
    this.focusAudio.stopAmbient();
    this.ambientMode = 'off';
    this.audioError = '';
  }

  private syncQuoteRotation(session: TimerSession): void {
    if (session.phase === 'focus' && session.running && !this.quoteInterval) {
      this.quoteInterval = setInterval(() => {
        this.quoteIndex = (this.quoteIndex + 1) % MOTIVATIONS.length;
      }, 12000);
      return;
    }
    if (session.phase !== 'focus' || !session.running) {
      this.clearInterval(this.quoteInterval);
      this.quoteInterval = undefined;
    }
  }

  private triggerBurst(): void {
    this.burstActive = true;
    if (this.burstTimeout) {
      clearTimeout(this.burstTimeout);
    }
    this.burstTimeout = setTimeout(() => {
      this.burstActive = false;
      this.burstTimeout = undefined;
    }, 850);
  }

  private startBreathingIntervals(): void {
    this.stopBreathingIntervals();
    this.breathPhase = 'Inhale';
    this.breathPhaseSeconds = 4;
    this.breathPhaseInterval = setInterval(() => {
      if (this.breathPhaseSeconds > 1) {
        this.breathPhaseSeconds -= 1;
        return;
      }
      this.breathPhase =
        this.breathPhase === 'Inhale'
          ? 'Hold'
          : this.breathPhase === 'Hold'
            ? 'Exhale'
            : this.breathPhase === 'Exhale'
              ? 'Pause'
              : 'Inhale';
      this.breathPhaseSeconds = 4;
    }, 1000);
    this.breathingInterval = setInterval(() => {
      if (this.breathingSecondsLeft <= 1) {
        this.breathingSecondsLeft = 0;
        this.clearInterval(this.breathingInterval);
        this.breathingInterval = undefined;
        return;
      }
      this.breathingSecondsLeft -= 1;
    }, 1000);
  }

  private stopBreathingIntervals(): void {
    this.clearInterval(this.breathingInterval);
    this.clearInterval(this.breathPhaseInterval);
    this.breathingInterval = undefined;
    this.breathPhaseInterval = undefined;
  }

  private clearInterval(timer?: ReturnType<typeof setInterval>): void {
    if (timer) {
      clearInterval(timer);
    }
  }

  displayTitle(title: string, course?: string): string {
    return course ? title.replace(`[${course}] `, '') : title;
  }
}
