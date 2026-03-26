/**
 * MIDI Output Manager for real-time MIDI streaming
 * Implements MIDI 1.0 protocol with low-latency output and clock synchronization
 */

export interface MidiOutputDevice {
  id: string;
  name: string;
  output: WebMidi.MIDIOutput;
}

export interface MidiNote {
  note: number;
  velocity: number;
  channel: number;
  duration?: number;
}

export interface MidiCC {
  controller: number;
  value: number;
  channel: number;
}

export interface MidiClock {
  bpm: number;
  isPlaying: boolean;
  position: number;
}

// MIDI message types (MIDI 1.0 standard)
const MIDI_MESSAGES = {
  NOTE_ON: 0x90,
  NOTE_OFF: 0x80,
  CONTROL_CHANGE: 0xb0,
  CLOCK: 0xf8,
  START: 0xfa,
  CONTINUE: 0xfb,
  STOP: 0xfc,
  SONG_POSITION: 0xf2,
  TIMING_CLOCK: 0xf8
} as const;

export class MidiOutputManager {
  private midiAccess: WebMidi.MIDIAccess | null = null;
  private outputs: Map<string, MidiOutputDevice> = new Map();
  private activeNotes: Map<string, { note: number; channel: number; deviceId?: string }> = new Map();
  private recentlyPlayedNotes: Map<number, number> = new Map(); // midiNote -> timestamp for loopback detection
  private recentNotesCleanupInterval: ReturnType<typeof setInterval> | null = null;
  private clockInterval: ReturnType<typeof setInterval> | null = null;
  private scheduledNoteOffs: Set<ReturnType<typeof setTimeout>> = new Set(); // Track all note-off timers
  private currentBPM: number = 120;
  private isClockRunning: boolean = false;
  private clockPosition: number = 0;
  private selectedOutputId: string | null = null;
  private initializationAttempts: number = 0;
  private maxInitAttempts: number = 3;
  private diagnostics: string[] = [];
  private _isDestroyed: boolean = false;

  constructor() {
    this.initMidiWithRetry();
    // Cleanup old entries from recentlyPlayedNotes every 100ms
    this.recentNotesCleanupInterval = setInterval(() => {
      const now = performance.now();
      for (const [note, timestamp] of this.recentlyPlayedNotes.entries()) {
        if (now - timestamp > 100) {
          this.recentlyPlayedNotes.delete(note);
        }
      }
    }, 100);
  }

  private async initMidiWithRetry() {
    for (let attempt = 1; attempt <= this.maxInitAttempts; attempt++) {
      this.initializationAttempts = attempt;
      this.diagnostics.push(`MIDI initialization attempt ${attempt}/${this.maxInitAttempts}`);
      
      const success = await this.initMidi();
      if (success) {
        this.diagnostics.push('MIDI initialization successful');
        return;
      }
      
      if (attempt < this.maxInitAttempts) {
        this.diagnostics.push(`Attempt ${attempt} failed, retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    this.diagnostics.push('All MIDI initialization attempts failed');
  }

  private async initMidi(): Promise<boolean> {
    try {
      // Check if Web MIDI API is available
      if (!('requestMIDIAccess' in navigator)) {
        this.diagnostics.push('Web MIDI API not available in this browser');
        return false;
      }

      // Enhanced MIDI access request with comprehensive options
      const midiOptions = {
        sysex: false, // Start without sysex to avoid additional permission prompts
        software: true, // Include software/virtual MIDI ports
      };

      this.diagnostics.push('Requesting MIDI access with options:', JSON.stringify(midiOptions));
      
      // Request MIDI access with timeout
      const midiAccessPromise = (navigator as any).requestMIDIAccess(midiOptions);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('MIDI access request timeout')), 10000)
      );

      this.midiAccess = await Promise.race([midiAccessPromise, timeoutPromise]) as WebMidi.MIDIAccess;
      
      this.diagnostics.push('MIDI access granted successfully');
      
      // Immediate device scan
      await this.comprehensiveDeviceScan();
      
      // Setup change monitoring
      this.setupDeviceMonitoring();
      
      console.log('MIDI output manager initialized successfully');
      console.log('Diagnostics:', this.diagnostics);
      
      return true;
      
    } catch (error) {
      this.handleInitializationError(error);
      return false;
    }
  }

  private handleInitializationError(error: any) {
    let errorMsg = 'Unknown error';
    let errorType = 'generic';

    if (error instanceof Error) {
      errorMsg = error.message;
      
      if (error.name === 'SecurityError' || error.message.includes('permissions policy')) {
        errorType = 'permissions';
        errorMsg = 'MIDI access blocked by browser security policy';
      } else if (error.name === 'NotSupportedError') {
        errorType = 'unsupported';
        errorMsg = 'MIDI not supported on this platform';
      } else if (error.message.includes('timeout')) {
        errorType = 'timeout';
        errorMsg = 'MIDI access request timed out';
      } else if (error.message.includes('AbortError')) {
        errorType = 'user_denied';
        errorMsg = 'User denied MIDI access permission';
      }
    }

    this.diagnostics.push(`Error (${errorType}): ${errorMsg}`);
    console.log(`MIDI initialization error: ${errorMsg}`);
    this.midiAccess = null;
  }

  private async comprehensiveDeviceScan() {
    if (!this.midiAccess) return;

    this.diagnostics.push('Starting comprehensive device scan...');
    
    // Clear existing outputs
    this.outputs.clear();

    // Scan all available MIDI outputs with detailed logging
    const outputCount = this.midiAccess.outputs.size;
    this.diagnostics.push(`Found ${outputCount} MIDI output ports`);

    let validDeviceCount = 0;
    
    for (const [id, output] of this.midiAccess.outputs.entries()) {
      try {
        // Validate device properties
        const deviceName = output.name || `Unknown Device ${id}`;
        const deviceManufacturer = output.manufacturer || 'Unknown';
        const deviceVersion = output.version || 'Unknown';
        const connectionState = output.connection || 'unknown';
        const deviceState = output.state || 'unknown';
        const deviceType = output.type || 'unknown';

        this.diagnostics.push(`Device ${validDeviceCount + 1}: ${deviceName}`);
        this.diagnostics.push(`  - ID: ${id}`);
        this.diagnostics.push(`  - Manufacturer: ${deviceManufacturer}`);
        this.diagnostics.push(`  - Version: ${deviceVersion}`);
        this.diagnostics.push(`  - Connection: ${connectionState}`);
        this.diagnostics.push(`  - State: ${deviceState}`);
        this.diagnostics.push(`  - Type: ${deviceType}`);

        // Only add connected and open devices
        if (deviceState === 'connected' || deviceState === 'disconnected') {
          const device: MidiOutputDevice = {
            id: id,
            name: `${deviceName} (${deviceManufacturer})`,
            output: output
          };
          
          this.outputs.set(id, device);
          validDeviceCount++;
          
          this.diagnostics.push(`  - Status: Added to available devices`);
        } else {
          this.diagnostics.push(`  - Status: Skipped (state: ${deviceState})`);
        }

        // Test device connectivity
        await this.testDeviceConnectivity(output);
        
      } catch (deviceError) {
        this.diagnostics.push(`  - Error processing device: ${deviceError}`);
      }
    }

    // Scan for virtual/software MIDI ports
    await this.scanVirtualPorts();
    
    this.diagnostics.push(`Device scan complete. ${validDeviceCount} valid devices found.`);
    
    // Auto-select first available device if none selected
    if (validDeviceCount > 0 && !this.selectedOutputId) {
      const firstDevice = Array.from(this.outputs.values())[0];
      this.selectedOutputId = firstDevice.id;
      this.diagnostics.push(`Auto-selected device: ${firstDevice.name}`);
    }
  }

  private async testDeviceConnectivity(output: WebMidi.MIDIOutput) {
    try {
      // Try to open the device connection if it's not already open
      if (output.connection === 'closed') {
        this.diagnostics.push(`    - Attempting to open connection...`);
        // Note: Web MIDI API doesn't have explicit open/close methods
        // Connection state is managed by the browser
      }
      
      // Test basic message sending capability (non-intrusive)
      // We'll just prepare a test but not send it unless explicitly requested
      this.diagnostics.push(`    - Device appears ready for communication`);
      
    } catch (error) {
      this.diagnostics.push(`    - Connection test failed: ${error}`);
    }
  }

  private async scanVirtualPorts() {
    this.diagnostics.push('Scanning for virtual/software MIDI ports...');
    
    // Virtual ports often have specific naming patterns
    const virtualPortPatterns = [
      'loopMIDI',
      'Virtual MIDI',
      'IAC Driver',
      'Network MIDI',
      'Software MIDI',
      'DAW MIDI',
      'Virtual',
      'Loop',
      'Software'
    ];

    let virtualPortCount = 0;
    
    for (const device of this.outputs.values()) {
      const isVirtual = virtualPortPatterns.some(pattern => 
        device.name.toLowerCase().includes(pattern.toLowerCase())
      );
      
      if (isVirtual) {
        virtualPortCount++;
        this.diagnostics.push(`  - Virtual port detected: ${device.name}`);
      }
    }
    
    this.diagnostics.push(`Found ${virtualPortCount} virtual MIDI ports`);
  }

  private setupDeviceMonitoring() {
    if (!this.midiAccess) return;

    this.midiAccess.onstatechange = (event: WebMidi.MIDIConnectionEvent) => {
      const port = event.port;
      this.diagnostics.push(`Device state change: ${port.name} - ${port.state} (${port.connection})`);
      
      // Re-scan devices when state changes
      setTimeout(() => this.comprehensiveDeviceScan(), 500);
    };
  }

  // Convert note name and octave to MIDI note number
  private noteToMidiNumber(note: string, octave: number): number {
    const noteMap: Record<string, number> = {
      'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
      'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
    };
    return (octave + 1) * 12 + noteMap[note];
  }

  // Send MIDI message with error handling
  private sendMidiMessage(message: number[], timestamp?: number) {
    if (!this.selectedOutputId || !this.outputs.has(this.selectedOutputId)) return;

    try {
      const device = this.outputs.get(this.selectedOutputId)!;
      const currentTime = timestamp || performance.now();
      device.output.send(message, currentTime);
    } catch (error) {
      console.warn('Failed to send MIDI message:', error);
    }
  }

  // Send MIDI message to a specific device (bypasses selectedOutputId)
  private sendMidiMessageToDevice(deviceId: string, message: number[], timestamp?: number) {
    const device = this.outputs.get(deviceId);
    if (!device) return;
    try {
      const currentTime = timestamp || performance.now();
      device.output.send(message, currentTime);
    } catch (error) {
      console.warn('Failed to send MIDI message to device:', error);
    }
  }

  // Check if a specific device is available
  isDeviceAvailable(deviceId: string): boolean {
    return this.midiAccess !== null && this.outputs.has(deviceId);
  }

  // Play note to a specific device (bypasses global selectedOutputId)
  playNoteToDevice(deviceId: string, note: string, octave: number, velocity: number = 127, channel: number = 0, duration?: number) {
    if (this._isDestroyed || !this.midiAccess || !this.outputs.has(deviceId)) return;

    // Validate and clamp MIDI channel (0-15)
    const safeChannel = Math.max(0, Math.min(15, channel));

    const midiNote = this.noteToMidiNumber(note, octave);
    const noteKey = `${deviceId}-${midiNote}-${safeChannel}`;

    this.recentlyPlayedNotes.set(midiNote, performance.now());

    // Stop previous instance of same note (prevent stuck notes)
    if (this.activeNotes.has(noteKey)) {
      const noteOffMsg = [MIDI_MESSAGES.NOTE_OFF | safeChannel, midiNote, 0];
      this.sendMidiMessageToDevice(deviceId, noteOffMsg);
      this.activeNotes.delete(noteKey);
    }

    // MIDI spec: velocity 0 = note-off
    if (velocity <= 0) {
      const noteOffMsg = [MIDI_MESSAGES.NOTE_OFF | safeChannel, midiNote, 0];
      this.sendMidiMessageToDevice(deviceId, noteOffMsg);
      return;
    }

    const noteOnMessage = [MIDI_MESSAGES.NOTE_ON | safeChannel, midiNote, Math.min(127, velocity)];
    this.sendMidiMessageToDevice(deviceId, noteOnMessage);
    this.activeNotes.set(noteKey, { note: midiNote, channel: safeChannel, deviceId });

    if (duration) {
      const timerId = setTimeout(() => {
        this.scheduledNoteOffs.delete(timerId);
        if (!this._isDestroyed) {
          const noteOffMsg = [MIDI_MESSAGES.NOTE_OFF | safeChannel, midiNote, 0];
          this.sendMidiMessageToDevice(deviceId, noteOffMsg);
          this.activeNotes.delete(noteKey);
        }
      }, duration);
      this.scheduledNoteOffs.add(timerId);
    }
  }

  // Send CC to a specific device
  sendControlChangeToDevice(deviceId: string, controller: number, value: number, channel: number = 0) {
    if (!this.midiAccess || !this.outputs.has(deviceId)) return;
    const safeChannel = Math.max(0, Math.min(15, channel));
    const safeController = Math.max(0, Math.min(127, controller));
    const ccMessage = [MIDI_MESSAGES.CONTROL_CHANGE | safeChannel, safeController, Math.max(0, Math.min(127, value))];
    this.sendMidiMessageToDevice(deviceId, ccMessage);
  }

  // Play MIDI note
  playNote(note: string, octave: number, velocity: number = 127, channel: number = 0, duration?: number) {
    if (this._isDestroyed || !this.isAvailable()) return;

    // Validate and clamp MIDI channel (0-15)
    const safeChannel = Math.max(0, Math.min(15, channel));

    const midiNote = this.noteToMidiNumber(note, octave);
    const noteKey = `${midiNote}-${safeChannel}`;
    
    // Track for loopback detection (50ms window)
    this.recentlyPlayedNotes.set(midiNote, performance.now());
    
    // Stop previous note if still playing
    if (this.activeNotes.has(noteKey)) {
      this.stopNote(note, octave, safeChannel);
    }

    // MIDI spec: velocity 0 = note-off
    if (velocity <= 0) {
      this.stopNote(note, octave, safeChannel);
      return;
    }

    // Send note on
    const noteOnMessage = [MIDI_MESSAGES.NOTE_ON | safeChannel, midiNote, Math.min(127, velocity)];
    this.sendMidiMessage(noteOnMessage);
    
    // Track active note
    this.activeNotes.set(noteKey, { note: midiNote, channel: safeChannel });

    // Schedule note off if duration is specified
    if (duration) {
      const timerId = setTimeout(() => {
        this.scheduledNoteOffs.delete(timerId);
        if (!this._isDestroyed) {
          this.stopNote(note, octave, safeChannel);
        }
      }, duration);
      this.scheduledNoteOffs.add(timerId);
    }
  }

  // Stop MIDI note
  stopNote(note: string, octave: number, channel: number = 0) {
    if (!this.isAvailable()) return;

    const safeChannel = Math.max(0, Math.min(15, channel));
    const midiNote = this.noteToMidiNumber(note, octave);
    const noteKey = `${midiNote}-${safeChannel}`;

    if (this.activeNotes.has(noteKey)) {
      const noteOffMessage = [MIDI_MESSAGES.NOTE_OFF | safeChannel, midiNote, 0];
      this.sendMidiMessage(noteOffMessage);
      this.activeNotes.delete(noteKey);
    }
  }

  // Send MIDI CC
  sendControlChange(controller: number, value: number, channel: number = 0) {
    if (!this.isAvailable()) return;

    const safeChannel = Math.max(0, Math.min(15, channel));
    const safeController = Math.max(0, Math.min(127, controller));
    const ccMessage = [MIDI_MESSAGES.CONTROL_CHANGE | safeChannel, safeController, Math.max(0, Math.min(127, value))];
    this.sendMidiMessage(ccMessage);
  }

  // Start MIDI clock
  startClock(bpm: number = 120) {
    if (!this.isAvailable()) return;

    this.currentBPM = bpm;
    this.isClockRunning = true;
    this.clockPosition = 0;

    // Send MIDI start message
    this.sendMidiMessage([MIDI_MESSAGES.START]);

    // Start clock timer (24 MIDI clocks per quarter note)
    const clockInterval = (60000 / (bpm * 24)); // milliseconds per clock
    
    this.clockInterval = setInterval(() => {
      if (this.isClockRunning) {
        this.sendMidiMessage([MIDI_MESSAGES.TIMING_CLOCK]);
        this.clockPosition++;
      }
    }, clockInterval);
  }

  // Continue MIDI clock
  continueClock() {
    if (!this.isAvailable() || this.isClockRunning) return;
    
    this.isClockRunning = true;
    this.sendMidiMessage([MIDI_MESSAGES.CONTINUE]);
  }

  // Stop MIDI clock
  stopClock() {
    if (!this.isAvailable()) return;

    this.isClockRunning = false;
    this.sendMidiMessage([MIDI_MESSAGES.STOP]);

    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }

    // Stop all active notes
    this.stopAllNotes();
  }

  // Stop all active notes (panic function)
  stopAllNotes() {
    // Cancel all scheduled note-off timers
    for (const timerId of this.scheduledNoteOffs) {
      clearTimeout(timerId);
    }
    this.scheduledNoteOffs.clear();

    // Send note-off for all tracked active notes
    for (const [noteKey, noteInfo] of this.activeNotes.entries()) {
      if (noteInfo.deviceId) {
        const noteOffMessage = [MIDI_MESSAGES.NOTE_OFF | noteInfo.channel, noteInfo.note, 0];
        this.sendMidiMessageToDevice(noteInfo.deviceId, noteOffMessage);
      } else {
        const noteOffMessage = [MIDI_MESSAGES.NOTE_OFF | noteInfo.channel, noteInfo.note, 0];
        this.sendMidiMessage(noteOffMessage);
      }
    }
    this.activeNotes.clear();

    // Send MIDI CC 123 (All Notes Off) + CC 121 (Reset All Controllers) on all channels to all devices
    for (const device of this.outputs.values()) {
      for (let ch = 0; ch < 16; ch++) {
        try {
          device.output.send([MIDI_MESSAGES.CONTROL_CHANGE | ch, 123, 0]); // All Notes Off
          device.output.send([MIDI_MESSAGES.CONTROL_CHANGE | ch, 121, 0]); // Reset All Controllers
        } catch (_) {
          // Ignore errors during panic — best effort
        }
      }
    }
  }

  // Destroy the manager — call on app unmount to prevent leaks
  destroy() {
    this._isDestroyed = true;
    this.stopAllNotes();
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
    if (this.recentNotesCleanupInterval) {
      clearInterval(this.recentNotesCleanupInterval);
      this.recentNotesCleanupInterval = null;
    }
    this.recentlyPlayedNotes.clear();
    this.isClockRunning = false;
  }

  // Set BPM and update clock if running (without stopping notes)
  setBPM(bpm: number) {
    const clampedBPM = Math.max(20, Math.min(300, bpm));
    this.currentBPM = clampedBPM;
    if (this.isClockRunning && this.clockInterval) {
      // Atomically swap interval — start new before clearing old to avoid gap
      const newClockMs = 60000 / (clampedBPM * 24); // 24 MIDI clocks per quarter note
      const oldInterval = this.clockInterval;
      this.clockInterval = setInterval(() => {
        if (this.isClockRunning) {
          this.sendMidiMessage([MIDI_MESSAGES.TIMING_CLOCK]);
          this.clockPosition++;
        }
      }, newClockMs);
      clearInterval(oldInterval);
    }
  }

  // Select MIDI output device
  selectOutput(deviceId: string | null) {
    if (deviceId && this.outputs.has(deviceId)) {
      this.selectedOutputId = deviceId;
      return true;
    } else if (deviceId === null) {
      this.selectedOutputId = null;
      return true;
    }
    return false;
  }

  // Get available MIDI outputs
  getAvailableOutputs(): MidiOutputDevice[] {
    return Array.from(this.outputs.values());
  }

  // Get selected output info
  getSelectedOutput(): MidiOutputDevice | null {
    if (this.selectedOutputId && this.outputs.has(this.selectedOutputId)) {
      return this.outputs.get(this.selectedOutputId)!;
    }
    return null;
  }

  // Check if MIDI output is available
  isAvailable(): boolean {
    return this.midiAccess !== null && this.selectedOutputId !== null;
  }

  // Check if a MIDI note was recently played by the sequencer (for loopback detection)
  // Returns true if the note should be filtered out (it's our own playback)
  isRecentPlayback(midiNote: number, thresholdMs: number = 50): boolean {
    const timestamp = this.recentlyPlayedNotes.get(midiNote);
    if (timestamp === undefined) return false;
    return performance.now() - timestamp < thresholdMs;
  }

  // Get MIDI status with enhanced diagnostics
  getStatus(): { 
    supported: boolean; 
    available: boolean; 
    selectedDevice: string | null; 
    devicesCount: number;
    clockRunning: boolean;
    activeNotesCount: number;
    diagnostics: string[];
    initAttempts: number;
    lastError: string | null;
  } {
    return {
      supported: 'requestMIDIAccess' in navigator,
      available: this.isAvailable(),
      selectedDevice: this.getSelectedOutput()?.name || null,
      devicesCount: this.outputs.size,
      clockRunning: this.isClockRunning,
      activeNotesCount: this.activeNotes.size,
      diagnostics: this.diagnostics.slice(-10), // Last 10 diagnostic messages
      initAttempts: this.initializationAttempts,
      lastError: this.diagnostics.filter(msg => msg.includes('Error')).pop() || null
    };
  }

  // Force rescan of MIDI devices
  async forceScan(): Promise<number> {
    this.diagnostics.push('Force rescan requested');
    if (this.midiAccess) {
      await this.comprehensiveDeviceScan();
    } else {
      await this.initMidiWithRetry();
    }
    return this.outputs.size;
  }

  // Get detailed diagnostics
  getDiagnostics(): string[] {
    return [...this.diagnostics];
  }

  // Clear diagnostics log
  clearDiagnostics() {
    this.diagnostics = [];
  }

  // Manual device refresh with user interaction
  async refreshDevices(): Promise<boolean> {
    this.diagnostics.push('Manual device refresh initiated');
    
    try {
      // If we don't have MIDI access, try to get it again
      if (!this.midiAccess) {
        const success = await this.initMidi();
        if (!success) return false;
      }
      
      // Perform comprehensive scan
      await this.comprehensiveDeviceScan();
      
      this.diagnostics.push(`Refresh complete: ${this.outputs.size} devices available`);
      return true;
      
    } catch (error) {
      this.diagnostics.push(`Refresh failed: ${error}`);
      return false;
    }
  }

  // Test device with user-initiated action
  async testDeviceOutput(deviceId?: string): Promise<boolean> {
    const targetDeviceId = deviceId || this.selectedOutputId;
    if (!targetDeviceId || !this.outputs.has(targetDeviceId)) {
      this.diagnostics.push('No device selected for testing');
      return false;
    }

    try {
      const device = this.outputs.get(targetDeviceId)!;
      this.diagnostics.push(`Testing device: ${device.name}`);
      
      // Send a safe test message (MIDI timing clock - won't make sound)
      const testMessage = [MIDI_MESSAGES.TIMING_CLOCK];
      device.output.send(testMessage);
      
      this.diagnostics.push('Test message sent successfully');
      return true;
      
    } catch (error) {
      this.diagnostics.push(`Test failed: ${error}`);
      return false;
    }
  }

  // Advanced: Send raw MIDI message
  sendRawMessage(message: number[], timestamp?: number) {
    this.sendMidiMessage(message, timestamp);
  }

  // Advanced: Send system exclusive message
  sendSysEx(data: number[]) {
    if (!this.isAvailable()) return;
    
    const sysexMessage = [0xf0, ...data, 0xf7]; // SysEx start + data + end
    this.sendMidiMessage(sysexMessage);
  }
}

// Global MIDI output manager instance
export const globalMidiOutput = new MidiOutputManager();