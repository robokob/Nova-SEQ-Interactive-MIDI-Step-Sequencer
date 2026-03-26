/**
 * WebSynths integration utilities for real-time MIDI pattern preview
 * Based on WebSynths GitHub - web-based synthesizer library
 */

// WebSynths oscillator types
export type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';

// Microtuning system - cents deviation from equal temperament
export interface MicrotuningPreset {
  name: string;
  description: string;
  deviations: number[]; // 12 values for each semitone in cents (-100 to +100)
}

// Built-in microtuning presets
export const MICROTUNING_PRESETS: MicrotuningPreset[] = [
  {
    name: 'Equal Temperament',
    description: 'Standard 12-tone equal temperament',
    deviations: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  },
  {
    name: 'Just Intonation',
    description: 'Pure harmonic ratios',
    deviations: [0, -29, 4, 16, -14, -2, -31, 2, -27, -4, 18, -12]
  },
  {
    name: 'Pythagorean',
    description: 'Based on perfect fifths',
    deviations: [0, -10, 4, -6, 8, -2, -12, 2, -8, 6, -4, 10]
  },
  {
    name: 'Meantone',
    description: 'Quarter-comma meantone temperament',
    deviations: [0, -24, -7, -31, -14, 3, -21, -3, -27, -10, -34, -17]
  },
  {
    name: 'Well Temperament',
    description: 'Bach-style well temperament',
    deviations: [0, -6, -2, -8, -4, 2, -4, 0, -6, -2, -8, -4]
  },
  {
    name: 'Arabic Maqam',
    description: 'Quarter-tone intervals',
    deviations: [0, -50, 0, 50, 0, 0, -50, 0, -50, 0, 50, 0]
  }
];

// Simple Web Audio API synthesizer
export class WebSynth {
  private audioContext: AudioContext | null = null;
  private oscillators: Map<string, OscillatorNode> = new Map();
  private gainNodes: Map<string, GainNode> = new Map();
  private masterGain: GainNode | null = null;
  private microtuning: number[] = MICROTUNING_PRESETS[0].deviations;
  private oscType: OscillatorType = 'sawtooth';

  constructor() {
    this.initAudio();
  }

  private async initAudio() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.value = 0.3; // Master volume
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
      this.audioContext = null;
      this.masterGain = null;
    }
  }

  // Ensure AudioContext is usable (not closed), re-initialize if needed
  private async ensureAudioContext(): Promise<boolean> {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = null;
      this.masterGain = null;
      await this.initAudio();
    }
    if (!this.audioContext || !this.masterGain) return false;
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    return true;
  }

  // Convert MIDI note to frequency with microtuning
  private noteToFrequency(note: string, octave: number): number {
    const noteMap: Record<string, number> = {
      'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
      'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
    };
    
    const midiNote = (octave + 1) * 12 + noteMap[note];
    const baseCents = (midiNote - 69) * 100; // A4 = 440Hz = MIDI 69
    const microtuningCents = this.microtuning[noteMap[note]] || 0;
    const totalCents = baseCents + microtuningCents;
    
    return 440 * Math.pow(2, totalCents / 1200);
  }

  // Start playing a note
  async playNote(note: string, octave: number, velocity: number = 127, duration: number = 0.1) {
    if (!(await this.ensureAudioContext())) return;

    const noteKey = `${note}${octave}`;
    const frequency = this.noteToFrequency(note, octave);
    const gain = (velocity / 127) * 0.1; // Convert velocity to gain

    try {
      // Create oscillator and gain
      const oscillator = this.audioContext!.createOscillator();
      const gainNode = this.audioContext!.createGain();

      oscillator.type = this.oscType;
      oscillator.frequency.setValueAtTime(frequency, this.audioContext!.currentTime);
      
      // ADSR envelope
      gainNode.gain.setValueAtTime(0, this.audioContext!.currentTime);
      gainNode.gain.linearRampToValueAtTime(gain, this.audioContext!.currentTime + 0.01); // Attack
      gainNode.gain.exponentialRampToValueAtTime(gain * 0.7, this.audioContext!.currentTime + 0.05); // Decay
      gainNode.gain.setValueAtTime(gain * 0.7, this.audioContext!.currentTime + duration - 0.05); // Sustain
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext!.currentTime + duration); // Release

      // Connect audio graph
      oscillator.connect(gainNode);
      gainNode.connect(this.masterGain!);

      // Start and schedule stop
      oscillator.start(this.audioContext!.currentTime);
      oscillator.stop(this.audioContext!.currentTime + duration);

      // Store references
      this.oscillators.set(noteKey, oscillator);
      this.gainNodes.set(noteKey, gainNode);

      // Clean up when done
      oscillator.addEventListener('ended', () => {
        this.oscillators.delete(noteKey);
        this.gainNodes.delete(noteKey);
        try { oscillator.disconnect(); } catch (_) {}
        try { gainNode.disconnect(); } catch (_) {}
      });
    } catch (error) {
      console.warn('WebSynth playNote error:', error);
    }
  }

  // Stop a specific note
  stopNote(note: string, octave: number) {
    const noteKey = `${note}${octave}`;
    const oscillator = this.oscillators.get(noteKey);
    const gainNode = this.gainNodes.get(noteKey);

    if (oscillator && gainNode && this.audioContext) {
      // Quick fade out
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.01);
      oscillator.stop(this.audioContext.currentTime + 0.01);
    }
  }

  // Stop all notes
  stopAllNotes() {
    for (const [noteKey, oscillator] of this.oscillators) {
      const gainNode = this.gainNodes.get(noteKey);
      if (gainNode && this.audioContext) {
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.01);
        oscillator.stop(this.audioContext.currentTime + 0.01);
      }
    }
  }

  // Set oscillator type
  setOscillatorType(type: OscillatorType) {
    this.oscType = type;
  }

  // Set microtuning preset
  setMicrotuning(preset: MicrotuningPreset) {
    this.microtuning = [...preset.deviations];
  }

  // Set custom microtuning
  setCustomMicrotuning(deviations: number[]) {
    if (deviations.length === 12) {
      // Clamp each deviation to valid range
      this.microtuning = deviations.map(d => Math.max(-100, Math.min(100, d)));
    }
  }

  // Get current microtuning
  getMicrotuning(): number[] {
    return [...this.microtuning];
  }

  // Set master volume
  setMasterVolume(volume: number) {
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(volume, this.audioContext?.currentTime || 0);
    }
  }

  // Check if audio is supported
  isAudioSupported(): boolean {
    return !!(window.AudioContext || (window as any).webkitAudioContext);
  }

  // Destroy the synth — call on app unmount
  destroy() {
    this.stopAllNotes();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
    }
    this.audioContext = null;
    this.masterGain = null;
  }
}

// Global synth instance
export const globalSynth = new WebSynth();