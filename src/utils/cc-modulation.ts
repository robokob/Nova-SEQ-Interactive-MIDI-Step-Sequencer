/**
 * CC Modulation Utility
 * Calculates modulated CC values based on velocity or pitch (keytracking)
 */

export type ModulationSource = 'velocity' | 'pitch' | 'none';

export interface CCModulationConfig {
  source: ModulationSource;
  amount: number; // 0-100 percentage
}

export interface CCKnobConfig {
  ccNumber: number;
  value: number;
  modulation: CCModulationConfig;
}

export interface StepCCConfig {
  cc1: CCKnobConfig;
  cc2: CCKnobConfig;
  cc3: CCKnobConfig;
  cc4: CCKnobConfig;
}

// Default CC configuration for a step
export function createDefaultCCConfig(): StepCCConfig {
  return {
    cc1: { ccNumber: 74, value: 64, modulation: { source: 'none', amount: 0 } }, // Filter cutoff
    cc2: { ccNumber: 71, value: 64, modulation: { source: 'none', amount: 0 } }, // Resonance
    cc3: { ccNumber: 73, value: 64, modulation: { source: 'none', amount: 0 } }, // Attack
    cc4: { ccNumber: 72, value: 64, modulation: { source: 'none', amount: 0 } }, // Release
  };
}

/**
 * Convert note name and octave to MIDI note number
 */
export function noteToMidiNumber(note: string, octave: number): number {
  const noteMap: Record<string, number> = {
    'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
    'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
  };
  return (octave + 1) * 12 + (noteMap[note] ?? 0);
}

/**
 * Calculate modulated CC value based on velocity or pitch (keytracking)
 * 
 * @param baseValue - The base CC value (0-127)
 * @param modulation - Modulation configuration with source and amount
 * @param velocity - Current note velocity (0-127)
 * @param midiNote - Current MIDI note number (0-127, where 60 = C4)
 * @returns Modulated CC value clamped to 0-127
 */
export function calculateModulatedCC(
  baseValue: number,
  modulation: CCModulationConfig,
  velocity: number,
  midiNote: number
): number {
  if (modulation.source === 'none' || modulation.amount === 0) {
    return Math.round(Math.max(0, Math.min(127, baseValue)));
  }

  let normalizedSource = 0;

  if (modulation.source === 'velocity') {
    // Velocity: normalize 0-127 to -1 to 1, centered at 64
    normalizedSource = (velocity - 64) / 63;
  } else if (modulation.source === 'pitch') {
    // Keytracking: normalize around C4 (MIDI note 60)
    // Range: C0 (24) to C8 (108), centered at C4 (60)
    // This gives about -0.6 to +0.8 range for typical keyboard
    normalizedSource = (midiNote - 60) / 60;
  }

  // Apply modulation: amount is 0-100, convert to 0-1, then scale by max modulation (64)
  const modOffset = (modulation.amount / 100) * normalizedSource * 64;
  const modulatedValue = baseValue + modOffset;

  return Math.round(Math.max(0, Math.min(127, modulatedValue)));
}

/**
 * Process all 4 CC knobs and return array of CC messages to send
 */
export function processStepCCs(
  ccConfig: StepCCConfig,
  velocity: number,
  note: string,
  octave: number
): Array<{ ccNumber: number; value: number }> {
  const midiNote = noteToMidiNumber(note, octave);
  const ccMessages: Array<{ ccNumber: number; value: number }> = [];

  const knobs = [ccConfig.cc1, ccConfig.cc2, ccConfig.cc3, ccConfig.cc4];
  
  for (const knob of knobs) {
    // CC 120-127 are reserved Channel Mode Messages — skip them
    if (knob.ccNumber >= 0 && knob.ccNumber <= 119) {
      const modulatedValue = calculateModulatedCC(
        knob.value,
        knob.modulation,
        velocity,
        midiNote
      );
      ccMessages.push({ ccNumber: knob.ccNumber, value: modulatedValue });
    }
  }

  return ccMessages;
}
