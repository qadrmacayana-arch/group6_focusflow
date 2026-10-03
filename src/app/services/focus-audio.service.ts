import { Injectable } from '@angular/core';
import { AppSettingsService } from './app-settings.service';

export type AmbientMode =
  | 'off'
  | 'lofi'
  | 'binaural'
  | 'rain'
  | 'ocean'
  | 'forest'
  | 'cafe'
  | 'vinyl'
  | 'whitenoise';

@Injectable({
  providedIn: 'root',
})
export class FocusAudioService {
  private context?: AudioContext;
  private masterGain?: GainNode;
  private sources: AudioScheduledSourceNode[] = [];
  private filters: AudioNode[] = [];

  constructor(private settings: AppSettingsService) {}

  async setAmbientMode(mode: AmbientMode, volume: number): Promise<string | null> {
    this.stopAmbient();
    if (mode === 'off') {
      return null;
    }
    if (typeof globalThis.AudioContext === 'undefined') {
      return 'Ambient audio is not supported in this browser or device.';
    }

    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }

      const gain = this.context.createGain();
      gain.gain.setValueAtTime(volume * 0.5, this.context.currentTime);
      gain.connect(this.context.destination);
      this.masterGain = gain;

      if (mode === 'binaural') {
        this.startBinaural(gain);
      } else if (mode === 'lofi') {
        this.startLofi(gain);
      } else {
        this.startNoise(mode, gain);
      }
      return null;
    } catch (error) {
      this.stopAmbient();
      return error instanceof Error
        ? `Ambient audio could not start: ${error.message}`
        : 'Ambient audio could not start on this device.';
    }
  }

  setVolume(volume: number): void {
    if (!this.context || !this.masterGain) {
      return;
    }
    this.masterGain.gain.setTargetAtTime(
      Math.min(1, Math.max(0, volume)) * 0.5,
      this.context.currentTime,
      0.04,
    );
  }

  playFeedback(type: 'tap' | 'lock' | 'start' | 'done' | 'bell'): void {
    if (
      !this.settings.getSettings().vibrationFeedback ||
      typeof navigator === 'undefined' ||
      typeof navigator.vibrate !== 'function'
    ) {
      return;
    }

    const pattern: Record<typeof type, number | number[]> = {
      tap: 12,
      lock: [30, 25, 30],
      start: [20, 20, 45],
      done: [25, 30, 65],
      bell: [35, 40, 80],
    };
    navigator.vibrate(pattern[type]);
  }

  stopAmbient(): void {
    for (const source of this.sources.splice(0)) {
      source.stop();
      source.disconnect();
    }
    for (const filter of this.filters.splice(0)) {
      filter.disconnect();
    }
    this.masterGain?.disconnect();
    this.masterGain = undefined;
  }

  destroy(): void {
    this.stopAmbient();
    void this.context?.close();
    this.context = undefined;
  }

  private startBinaural(gain: GainNode): void {
    const context = this.context!;
    const left = context.createOscillator();
    const right = context.createOscillator();
    left.type = 'sine';
    right.type = 'sine';
    left.frequency.value = 216;
    right.frequency.value = 256;

    const leftPan = context.createStereoPanner();
    const rightPan = context.createStereoPanner();
    leftPan.pan.value = -0.8;
    rightPan.pan.value = 0.8;
    left.connect(leftPan).connect(gain);
    right.connect(rightPan).connect(gain);
    left.start();
    this.sources.push(left);
    right.start();
    this.sources.push(right);
    this.filters.push(leftPan, rightPan);
  }

  private startNoise(
    mode: Exclude<AmbientMode, 'off' | 'binaural' | 'lofi'>,
    gain: GainNode,
  ): void {
    const context = this.context!;
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let lastSample = 0;
    for (let i = 0; i < samples.length; i += 1) {
      const whiteSample = Math.random() * 2 - 1;
      samples[i] = (lastSample + 0.02 * whiteSample) / 1.02;
      lastSample = samples[i];
      samples[i] *= mode === 'vinyl' ? 2.1 : 3.5;
    }

    const noise = context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = context.createBiquadFilter();
    if (mode === 'rain') {
      filter.type = 'lowpass';
      filter.frequency.value = 850;
    } else if (mode === 'ocean') {
      filter.type = 'lowpass';
      filter.frequency.value = 560;
      const swell = context.createGain();
      swell.gain.value = 0.42;
      const lfo = context.createOscillator();
      const lfoDepth = context.createGain();
      lfo.frequency.value = 0.085;
      lfoDepth.gain.value = 0.22;
      lfo.connect(lfoDepth).connect(swell.gain);
      filter.connect(swell).connect(gain);
      noise.connect(filter);
      noise.start();
      lfo.start();
      this.sources.push(noise, lfo);
      this.filters.push(filter, swell, lfoDepth);
      return;
    } else if (mode === 'forest') {
      filter.type = 'bandpass';
      filter.frequency.value = 1250;
      filter.Q.value = 0.45;
    } else if (mode === 'cafe') {
      filter.type = 'bandpass';
      filter.frequency.value = 450;
      filter.Q.value = 1.2;
    } else if (mode === 'vinyl') {
      filter.type = 'lowpass';
      filter.frequency.value = 1900;
    } else {
      filter.type = 'lowpass';
      filter.frequency.value = 2200;
    }

    noise.connect(filter).connect(gain);
    noise.start();
    this.sources.push(noise);
    this.filters.push(filter);
  }

  private startLofi(gain: GainNode): void {
    const context = this.context!;
    const tempo = 80;
    const beatSeconds = 60 / tempo;
    const barSeconds = beatSeconds * 4;
    const buffer = context.createBuffer(1, context.sampleRate * barSeconds * 4, context.sampleRate);
    const samples = buffer.getChannelData(0);
    const chords = [
      [220, 261.63, 329.63],
      [174.61, 220, 261.63],
      [196, 246.94, 293.66],
      [164.81, 196, 246.94],
    ];
    const melody = [329.63, 392, 440, 392, 329.63, 293.66, 261.63, 293.66];

    for (let i = 0; i < samples.length; i += 1) {
      const time = i / context.sampleRate;
      const barIndex = Math.floor(time / barSeconds);
      const barTime = time % barSeconds;
      const nextBarIndex = (barIndex + 1) % chords.length;
      const crossfade = Math.min(1, Math.max(0, (barTime - (barSeconds - 0.35)) / 0.35));
      const edgeFade = Math.min(1, time / 0.04, (buffer.duration - time) / 0.04);
      let pad = 0;
      let nextPad = 0;

      for (const frequency of chords[barIndex]) {
        pad += Math.sin(2 * Math.PI * frequency * time) * 0.035;
        pad += Math.sin(2 * Math.PI * frequency * 2 * time) * 0.008;
      }
      for (const frequency of chords[nextBarIndex]) {
        nextPad += Math.sin(2 * Math.PI * frequency * time) * 0.035;
        nextPad += Math.sin(2 * Math.PI * frequency * 2 * time) * 0.008;
      }

      const beatIndex = Math.floor(barTime / beatSeconds);
      const beatTime = barTime - beatIndex * beatSeconds;
      const noteFrequency = melody[(barIndex * 2 + beatIndex) % melody.length];
      const pluckEnvelope = Math.exp(-beatTime * 3.8);
      const pluck =
        Math.sin(2 * Math.PI * noteFrequency * beatTime) * pluckEnvelope * 0.08 +
        Math.sin(2 * Math.PI * noteFrequency * 2 * beatTime) * pluckEnvelope * 0.018;
      const dust = (Math.random() * 2 - 1) * 0.0018;
      samples[i] = (pad * (1 - crossfade) + nextPad * crossfade + pluck + dust) * edgeFade;
    }

    const source = context.createBufferSource();
    const warmth = context.createBiquadFilter();
    source.buffer = buffer;
    source.loop = true;
    warmth.type = 'lowpass';
    warmth.frequency.value = 2600;
    source.connect(warmth).connect(gain);
    source.start();
    this.sources.push(source);
    this.filters.push(warmth);
  }
}
