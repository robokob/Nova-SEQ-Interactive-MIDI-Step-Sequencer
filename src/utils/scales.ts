// Scale definitions using semitone intervals
export const SCALE_PATTERNS: Record<string, number[]> = {
  'major': [0, 2, 4, 5, 7, 9, 11], // W-W-H-W-W-W-H
  'minor': [0, 2, 3, 5, 7, 8, 10], // W-H-W-W-H-W-W (Natural Minor)
  'dorian': [0, 2, 3, 5, 7, 9, 10], // W-H-W-W-W-H-W
  'phrygian': [0, 1, 3, 5, 7, 8, 10], // H-W-W-W-H-W-W
  'lydian': [0, 2, 4, 6, 7, 9, 11], // W-W-W-H-W-W-H
  'mixolydian': [0, 2, 4, 5, 7, 9, 10], // W-W-H-W-W-H-W
  'locrian': [0, 1, 3, 5, 6, 8, 10], // H-W-W-H-W-W-W
  'pentatonic-major': [0, 2, 4, 7, 9], // Major Pentatonic
  'pentatonic-minor': [0, 3, 5, 7, 10], // Minor Pentatonic
  'blues': [0, 3, 5, 6, 7, 10], // Minor Pentatonic + b5
  'harmonic-minor': [0, 2, 3, 5, 7, 8, 11], // Natural Minor + Maj7
  'melodic-minor': [0, 2, 3, 5, 7, 9, 11], // Natural Minor + Maj6 + Maj7
  'chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] // All 12 notes
};

// All 12 chromatic notes
export const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Get the MIDI note number for a given note and octave
 */
export function getNoteNumber(note: string, octave: number): number {
  const noteIndex = CHROMATIC_NOTES.indexOf(note);
  if (noteIndex === -1) return 60; // Default to C4
  return (octave + 1) * 12 + noteIndex;
}

/**
 * Get note and octave from MIDI note number
 */
export function getNoteFromNumber(midiNote: number): { note: string; octave: number } {
  const octave = Math.floor(midiNote / 12) - 1;
  const noteIndex = midiNote % 12;
  return {
    note: CHROMATIC_NOTES[noteIndex],
    octave: Math.max(1, Math.min(8, octave)) // Clamp to 1-8 range
  };
}

/**
 * Generate scale notes from a root note and scale pattern
 */
export function generateScale(rootNote: string, scaleType: string, startOctave: number = 1): Array<{ note: string; octave: number }> {
  const pattern = SCALE_PATTERNS[scaleType];
  if (!pattern) return [];

  const rootIndex = CHROMATIC_NOTES.indexOf(rootNote);
  if (rootIndex === -1) return [];

  const scaleNotes: Array<{ note: string; octave: number }> = [];
  let currentOctave = startOctave;
  
  // Generate multiple octaves to fill the 4x4 grid (16 notes)
  for (let octaveCount = 0; octaveCount < 4; octaveCount++) {
    for (let i = 0; i < pattern.length; i++) {
      const noteIndex = (rootIndex + pattern[i]) % 12;
      const note = CHROMATIC_NOTES[noteIndex];
      
      // Calculate if we've wrapped around the octave
      const octaveOffset = Math.floor((rootIndex + pattern[i]) / 12);
      const noteOctave = currentOctave + octaveOffset;
      
      scaleNotes.push({ 
        note, 
        octave: Math.max(1, Math.min(8, noteOctave)) // Clamp to valid octave range
      });
      
      // Break early if we have enough notes for the grid
      if (scaleNotes.length >= 16) {
        return scaleNotes.slice(0, 16);
      }
    }
    currentOctave++;
    
    // Safety check to prevent infinite loops
    if (currentOctave > 8) break;
  }
  
  // If scale is shorter than 16 notes, repeat the pattern
  while (scaleNotes.length < 16) {
    const patternIndex = scaleNotes.length % pattern.length;
    const octaveMultiplier = Math.floor(scaleNotes.length / pattern.length);
    const noteIndex = (rootIndex + pattern[patternIndex]) % 12;
    const note = CHROMATIC_NOTES[noteIndex];
    const octaveOffset = Math.floor((rootIndex + pattern[patternIndex]) / 12);
    const noteOctave = startOctave + octaveMultiplier + octaveOffset;
    
    scaleNotes.push({ 
      note, 
      octave: Math.max(1, Math.min(8, noteOctave))
    });
  }
  
  return scaleNotes.slice(0, 16);
}

/**
 * Convert scale notes array to 4x4 grid format
 */
export function scaleToGrid(scaleNotes: Array<{ note: string; octave: number }>): {
  notes: string[][];
  octaves: number[][];
} {
  const notes: string[][] = [[], [], [], []];
  const octaves: number[][] = [[], [], [], []];
  
  for (let i = 0; i < 16; i++) {
    const row = Math.floor(i / 4);
    const col = i % 4;
    const scaleNote = scaleNotes[i] || { note: 'C', octave: 4 }; // Fallback
    
    notes[row][col] = scaleNote.note;
    octaves[row][col] = scaleNote.octave;
  }
  
  return { notes, octaves };
}