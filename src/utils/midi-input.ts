/**
 * MIDI Input utilities for step recording mode
 * Handles external MIDI keyboard input using Web MIDI API
 */

import { globalMidiOutput } from './midi-output';

// MIDI note number to note name and octave conversion
export function midiNoteToNoteAndOctave(midiNote: number): {
  note: string;
  octave: number;
} {
  const noteNames = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];
  const octave = Math.floor(midiNote / 12) - 1;
  const noteIndex = midiNote % 12;
  const note = noteNames[noteIndex];

  return { note, octave: Math.max(1, Math.min(8, octave)) }; // Clamp octave to 1-8 range
}

// Note name and octave to MIDI note number conversion
export function noteAndOctaveToMidiNote(note: string, octave: number): number {
  const noteMap: Record<string, number> = {
    C: 0,
    "C#": 1,
    D: 2,
    "D#": 3,
    E: 4,
    F: 5,
    "F#": 6,
    G: 7,
    "G#": 8,
    A: 9,
    "A#": 10,
    B: 11,
  };

  return (octave + 1) * 12 + noteMap[note];
}

// MIDI Input Manager Class
export class MidiInputManager {
  private midiAccess: WebMidi.MIDIAccess | null = null;
  private onNoteCallback:
    | ((note: string, octave: number, velocity: number) => void)
    | null = null;
  private activeNotes: Set<number> = new Set();
  private selectedInputId: string | null = null;
  private selectedChannel: number = 0; // 0 = omni, 1-16 = specific channel

  constructor() {
    this.initMidi();
  }

  private async initMidi() {
    try {
      if ("requestMIDIAccess" in navigator) {
        this.midiAccess = await (navigator as any).requestMIDIAccess();
        this.setupMidiInputs();
        console.log("MIDI access successfully initialized");
      } else {
        console.log(
          "Web MIDI API not supported - using QWERTY keyboard input mode",
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.name === "SecurityError" ||
          error.message.includes("permissions policy")
        ) {
          console.log(
            "MIDI access restricted by browser policy - using QWERTY keyboard input mode",
          );
        } else if (error.name === "NotSupportedError") {
          console.log("MIDI not supported - using QWERTY keyboard input mode");
        } else {
          console.log(
            "MIDI unavailable:",
            error.message,
            "- using QWERTY keyboard input mode",
          );
        }
      } else {
        console.log("MIDI unavailable - using QWERTY keyboard input mode");
      }
      // Set midiAccess to null so we know MIDI failed to initialize
      this.midiAccess = null;
    }
  }

  private setupMidiInputs() {
    if (!this.midiAccess) return;

    // Listen for new MIDI devices
    this.midiAccess.onstatechange = () => {
      this.setupMidiInputs();
    };

    // Remove old listeners before re-attaching to prevent duplicates
    for (const input of this.midiAccess.inputs.values()) {
      input.onmidimessage = null;
    }

    // Setup existing MIDI inputs
    for (const input of this.midiAccess.inputs.values()) {
      input.onmidimessage = (event) => this.handleMidiMessage(event, input.id);
    }
  }

  private handleMidiMessage(
    message: WebMidi.MIDIMessageEvent,
    inputId: string,
  ) {
    if (this.selectedInputId && inputId !== this.selectedInputId) return;

    const [status, note, velocity] = message.data;
    const channel = (status & 0x0f) + 1; // 1-16

    if (this.selectedChannel !== 0 && channel !== this.selectedChannel) {
      return;
    }

    // Note On message (status 144-159) with velocity > 0
    if (status >= 144 && status <= 159 && velocity > 0) {
      // Filter out loopback notes (sequencer's own playback through virtual MIDI devices)
      if (globalMidiOutput.isRecentPlayback(note, 50)) {
        return; // Ignore - this is our own playback looping back
      }
      
      this.activeNotes.add(note);
      const { note: noteName, octave } = midiNoteToNoteAndOctave(note);

      if (this.onNoteCallback) {
        this.onNoteCallback(noteName, octave, velocity);
      }
    }

    // Note Off message (status 128-143) or Note On with velocity 0
    else if (
      (status >= 128 && status <= 143) ||
      (status >= 144 && status <= 159 && velocity === 0)
    ) {
      this.activeNotes.delete(note);
    }
  }

  // Set callback for note input
  setNoteCallback(
    callback: (note: string, octave: number, velocity: number) => void,
  ) {
    this.onNoteCallback = callback;
  }

  // Select MIDI input device by id (null = all)
  setSelectedInputId(inputId: string | null) {
    this.selectedInputId = inputId;
  }

  getSelectedInputId(): string | null {
    return this.selectedInputId;
  }

  // Select MIDI channel (0 = omni, 1-16 specific)
  setSelectedChannel(channel: number) {
    if (channel < 0 || channel > 16) return;
    this.selectedChannel = channel;
  }

  getSelectedChannel(): number {
    return this.selectedChannel;
  }

  // Clear note callback
  clearNoteCallback() {
    this.onNoteCallback = null;
    this.activeNotes.clear();
  }

  // Clear all tracked active notes (call when stopping recording)
  clearActiveNotes() {
    this.activeNotes.clear();
  }

  // Destroy the manager — call on app unmount
  destroy() {
    this.clearNoteCallback();
    if (this.midiAccess) {
      this.midiAccess.onstatechange = null;
      for (const input of this.midiAccess.inputs.values()) {
        input.onmidimessage = null;
      }
    }
  }

  // Get list of available MIDI inputs
  getAvailableInputs(): { id: string; name: string }[] {
    if (!this.midiAccess) return [];

    const inputs: { id: string; name: string }[] = [];
    for (const input of this.midiAccess.inputs.values()) {
      inputs.push({
        id: input.id,
        name: input.name || "Unknown MIDI Device",
      });
    }
    return inputs;
  }

  // Check if MIDI is supported and accessible
  isMidiSupported(): boolean {
    return "requestMIDIAccess" in navigator;
  }

  // Check if MIDI is actually available (not blocked by permissions)
  isMidiAvailable(): boolean {
    return this.midiAccess !== null;
  }

  // Get MIDI status for user display
  getMidiStatus(): { supported: boolean; available: boolean; message: string } {
    const supported = this.isMidiSupported();
    const available = this.isMidiAvailable();

    let message = "";
    if (!supported) {
      message = "Web MIDI API not supported in this browser";
    } else if (!available) {
      message = "MIDI access blocked by browser permissions policy";
    } else {
      message = "MIDI ready";
    }

    return { supported, available, message };
  }

  // Get active notes (for display purposes)
  getActiveNotes(): number[] {
    return Array.from(this.activeNotes);
  }
}

// Global MIDI manager instance
export const globalMidiManager = new MidiInputManager();
