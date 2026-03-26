import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { ScrollArea } from './ui/scroll-area';
import { Play, Volume2, Keyboard, Circle } from 'lucide-react';
import { globalSynth } from '../utils/websynths';
import { globalMidiOutput } from '../utils/midi-output';
import { globalMidiManager, midiNoteToNoteAndOctave, noteAndOctaveToMidiNote } from '../utils/midi-input';

interface MidiDevice {
  id: string;
  name: string;
}

export interface ChordVoiceConfig {
  enabled: boolean;
  device: string | null;  // null = use step's device (or global)
  channel: number | null; // null = use step's channel (or global)
  semitoneOffset: number; // Offset from root note (-48 to +48)
  delay: number;          // Delay in ms (0-500)
  velocity: number;       // Velocity (0-127)
}

export interface StepChordConfig {
  voices: ChordVoiceConfig[];
  rootNote: string;
  rootOctave: number;
}

// Chord presets with semitone offsets from root
const CHORD_PRESETS: Record<string, { name: string; offsets: number[] }> = {
  major: { name: 'Major', offsets: [0, 4, 7] },
  minor: { name: 'Minor', offsets: [0, 3, 7] },
  dim: { name: 'Dim', offsets: [0, 3, 6] },
  aug: { name: 'Aug', offsets: [0, 4, 8] },
  sus2: { name: 'Sus2', offsets: [0, 2, 7] },
  sus4: { name: 'Sus4', offsets: [0, 5, 7] },
  '7th': { name: '7th', offsets: [0, 4, 7, 10] },
  maj7: { name: 'Maj7', offsets: [0, 4, 7, 11] },
  min7: { name: 'Min7', offsets: [0, 3, 7, 10] },
  dim7: { name: 'Dim7', offsets: [0, 3, 6, 9] },
  '9th': { name: '9th', offsets: [0, 4, 7, 10, 14] },
  add9: { name: 'Add9', offsets: [0, 4, 7, 14] },
  '6th': { name: '6th', offsets: [0, 4, 7, 9] },
  min6: { name: 'Min6', offsets: [0, 3, 7, 9] },
};

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OCTAVES = [1, 2, 3, 4, 5, 6, 7, 8];

// Create default voice configuration
export function createDefaultVoice(): ChordVoiceConfig {
  return {
    enabled: false,
    device: null,
    channel: null,
    semitoneOffset: 0,
    delay: 0,
    velocity: 100,
  };
}

// Create default chord configuration with 8 voices
export function createDefaultChordConfig(rootNote: string = 'C', rootOctave: number = 4): StepChordConfig {
  return {
    voices: Array.from({ length: 8 }, () => createDefaultVoice()),
    rootNote,
    rootOctave,
  };
}

interface VoiceRowProps {
  index: number;
  voice: ChordVoiceConfig;
  onChange: (voice: ChordVoiceConfig) => void;
  availableDevices: MidiDevice[];
  globalDeviceName: string | null;
  globalChannel: number;
}

function VoiceRow({
  index,
  voice,
  onChange,
  availableDevices,
  globalDeviceName,
  globalChannel,
}: VoiceRowProps) {
  const channels = Array.from({ length: 16 }, (_, i) => i + 1);

  const handleChange = <K extends keyof ChordVoiceConfig>(
    field: K,
    value: ChordVoiceConfig[K]
  ) => {
    onChange({ ...voice, [field]: value });
  };

  // Get note name from semitone offset
  const getOffsetNoteName = (offset: number, rootNote: string): string => {
    const rootIndex = NOTES.indexOf(rootNote);
    if (rootIndex === -1) return '?';
    const noteIndex = (rootIndex + ((offset % 12) + 12)) % 12;
    const octaveOffset = Math.floor(offset / 12);
    const sign = offset >= 0 ? '+' : '';
    return `${NOTES[noteIndex]} (${sign}${offset})`;
  };

  return (
    <div className={`flex items-center gap-2 p-2 rounded border ${voice.enabled ? 'bg-card border-primary/30' : 'bg-muted/30 border-muted'}`}>
      {/* Enable checkbox */}
      <Checkbox
        checked={voice.enabled}
        onCheckedChange={(checked: boolean | 'indeterminate') => handleChange('enabled', !!checked)}
        className="mr-1"
      />
      
      {/* Voice number */}
      <span className="text-xs font-mono w-4 text-muted-foreground">{index + 1}</span>

      {/* Semitone offset */}
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min={-48}
          max={48}
          value={voice.semitoneOffset}
          onChange={(e) => handleChange('semitoneOffset', Math.max(-48, Math.min(48, parseInt(e.target.value, 10) || 0)))}
          className="w-14 h-7 text-xs text-center"
          disabled={!voice.enabled}
          title="Semitone offset from root"
        />
      </div>

      {/* Device selection */}
      <Select
        value={voice.device || 'step'}
        onValueChange={(v: string) => handleChange('device', v === 'step' ? null : v)}
        disabled={!voice.enabled}
      >
        <SelectTrigger className="h-7 text-xs w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="step">Step Dev</SelectItem>
          {availableDevices.map((device) => (
            <SelectItem key={device.id} value={device.id}>
              {device.name.length > 12 ? device.name.slice(0, 12) + '...' : device.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Channel selection */}
      <Select
        value={voice.channel?.toString() || 'step'}
        onValueChange={(v: string) => handleChange('channel', v === 'step' ? null : parseInt(v, 10))}
        disabled={!voice.enabled}
      >
        <SelectTrigger className="h-7 text-xs w-16">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="step">Step Ch</SelectItem>
          {channels.map((ch) => (
            <SelectItem key={ch} value={ch.toString()}>
              Ch {ch}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Delay */}
      <div className="relative w-28">
        <Slider
          min={0}
          max={500}
          step={1}
          value={[voice.delay]}
          onValueChange={([v]: number[]) => handleChange('delay', v)}
          disabled={!voice.enabled}
          className="w-full"
        />
        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] font-mono text-white pointer-events-none z-10">
          {voice.delay > 0 ? voice.delay : ''}
        </span>
      </div>

      {/* Velocity */}
      <div className="flex items-center gap-1 flex-1">
        <Slider
          min={0}
          max={127}
          step={1}
          value={[voice.velocity]}
          onValueChange={([v]: number[]) => handleChange('velocity', v)}
          disabled={!voice.enabled}
          className="w-16"
        />
        <span className="text-xs font-mono w-6 text-muted-foreground">{voice.velocity}</span>
      </div>
    </div>
  );
}

interface StepChordEditorProps {
  chordConfig: StepChordConfig;
  onChordConfigChange: (config: StepChordConfig) => void;
  stepNote: string;
  stepOctave: number;
  availableDevices: MidiDevice[];
  globalDeviceName: string | null;
  globalChannel: number;
  bpm: number;
}

export function StepChordEditor({
  chordConfig,
  onChordConfigChange,
  stepNote,
  stepOctave,
  availableDevices,
  globalDeviceName,
  globalChannel,
  bpm,
}: StepChordEditorProps) {
  const [previewViaMidi, setPreviewViaMidi] = useState(true);
  
  // MIDI input state
  const [midiLearnActive, setMidiLearnActive] = useState(false);
  const [midiInputDevice, setMidiInputDevice] = useState<string | null>(null);
  const [midiInputChannel, setMidiInputChannel] = useState(0); // 0 = omni
  const [clearOnLearn, setClearOnLearn] = useState(true);
  const [availableMidiInputs, setAvailableMidiInputs] = useState<{ id: string; name: string }[]>([]);
  const [useQwerty, setUseQwerty] = useState(false);
  const [qwertyOctave, setQwertyOctave] = useState(4);
  const firstNoteReceivedRef = useRef(false);
  const chordConfigRef = useRef(chordConfig);
  
  // QWERTY keyboard mapping (piano-style layout)
  const QWERTY_MAP: Record<string, { note: string; octaveOffset: number }> = {
    // Lower row - octave 0
    'z': { note: 'C', octaveOffset: 0 },
    's': { note: 'C#', octaveOffset: 0 },
    'x': { note: 'D', octaveOffset: 0 },
    'd': { note: 'D#', octaveOffset: 0 },
    'c': { note: 'E', octaveOffset: 0 },
    'v': { note: 'F', octaveOffset: 0 },
    'g': { note: 'F#', octaveOffset: 0 },
    'b': { note: 'G', octaveOffset: 0 },
    'h': { note: 'G#', octaveOffset: 0 },
    'n': { note: 'A', octaveOffset: 0 },
    'j': { note: 'A#', octaveOffset: 0 },
    'm': { note: 'B', octaveOffset: 0 },
    // Upper row - octave 1
    'q': { note: 'C', octaveOffset: 1 },
    '2': { note: 'C#', octaveOffset: 1 },
    'w': { note: 'D', octaveOffset: 1 },
    '3': { note: 'D#', octaveOffset: 1 },
    'e': { note: 'E', octaveOffset: 1 },
    'r': { note: 'F', octaveOffset: 1 },
    '5': { note: 'F#', octaveOffset: 1 },
    't': { note: 'G', octaveOffset: 1 },
    '6': { note: 'G#', octaveOffset: 1 },
    'y': { note: 'A', octaveOffset: 1 },
    '7': { note: 'A#', octaveOffset: 1 },
    'u': { note: 'B', octaveOffset: 1 },
    'i': { note: 'C', octaveOffset: 2 },
    '9': { note: 'C#', octaveOffset: 2 },
    'o': { note: 'D', octaveOffset: 2 },
    '0': { note: 'D#', octaveOffset: 2 },
    'p': { note: 'E', octaveOffset: 2 },
  };
  
  // Keep chordConfigRef in sync
  useEffect(() => {
    chordConfigRef.current = chordConfig;
  }, [chordConfig]);
  
  // Fetch available MIDI inputs on mount
  useEffect(() => {
    const updateInputs = () => {
      setAvailableMidiInputs(globalMidiManager.getAvailableInputs());
    };
    updateInputs();
    const interval = setInterval(updateInputs, 2000);
    return () => clearInterval(interval);
  }, []);
  
  // Helper to handle incoming note (shared by MIDI and QWERTY)
  const handleIncomingNote = useCallback((note: string, octave: number, velocity: number) => {
    const currentConfig = chordConfigRef.current;
    const rootMidi = noteAndOctaveToMidiNote(currentConfig.rootNote, currentConfig.rootOctave);
    const incomingMidi = noteAndOctaveToMidiNote(note, octave);
    const semitoneOffset = incomingMidi - rootMidi;
    
    // Clear voices on first note if clearOnLearn is enabled
    let newVoices = [...currentConfig.voices];
    if (clearOnLearn && !firstNoteReceivedRef.current) {
      newVoices = newVoices.map(v => ({ ...v, enabled: false }));
      firstNoteReceivedRef.current = true;
    }
    
    // Find existing voice with same offset or first available slot
    let targetIndex = newVoices.findIndex(v => v.enabled && v.semitoneOffset === semitoneOffset);
    if (targetIndex === -1) {
      targetIndex = newVoices.findIndex(v => !v.enabled);
    }
    
    if (targetIndex !== -1) {
      newVoices[targetIndex] = {
        ...newVoices[targetIndex],
        enabled: true,
        semitoneOffset,
        velocity: Math.max(1, Math.min(127, velocity)),
      };
      onChordConfigChange({ ...currentConfig, voices: newVoices });
      
      // Auto-disable learn when all 8 voices are filled
      const enabledCount = newVoices.filter(v => v.enabled).length;
      if (enabledCount >= 8) {
        setMidiLearnActive(false);
      }
    }
  }, [clearOnLearn, onChordConfigChange]);
  
  // QWERTY keyboard handler
  useEffect(() => {
    if (!midiLearnActive || !useQwerty) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const key = e.key.toLowerCase();
      const mapping = QWERTY_MAP[key];
      if (mapping) {
        e.preventDefault();
        const octave = qwertyOctave + mapping.octaveOffset;
        handleIncomingNote(mapping.note, octave, 100); // Default velocity 100 for QWERTY
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [midiLearnActive, useQwerty, qwertyOctave, handleIncomingNote]);
  
  // MIDI learn effect
  useEffect(() => {
    if (!midiLearnActive || useQwerty) {
      firstNoteReceivedRef.current = false;
      if (!midiLearnActive) {
        globalMidiManager.clearNoteCallback();
      }
      return;
    }
    
    // Set MIDI input device and channel
    globalMidiManager.setSelectedInputId(midiInputDevice);
    globalMidiManager.setSelectedChannel(midiInputChannel);
    
    globalMidiManager.setNoteCallback(handleIncomingNote);
    
    return () => {
      globalMidiManager.clearNoteCallback();
    };
  }, [midiLearnActive, useQwerty, midiInputDevice, midiInputChannel, handleIncomingNote]);

  const handleVoiceChange = useCallback((index: number, voice: ChordVoiceConfig) => {
    const newVoices = [...chordConfig.voices];
    newVoices[index] = voice;
    onChordConfigChange({ ...chordConfig, voices: newVoices });
  }, [chordConfig, onChordConfigChange]);

  const handleRootNoteChange = useCallback((note: string) => {
    onChordConfigChange({ ...chordConfig, rootNote: note });
  }, [chordConfig, onChordConfigChange]);

  const handleRootOctaveChange = useCallback((octave: number) => {
    onChordConfigChange({ ...chordConfig, rootOctave: octave });
  }, [chordConfig, onChordConfigChange]);

  const applyChordPreset = useCallback((presetKey: string) => {
    const preset = CHORD_PRESETS[presetKey];
    if (!preset) return;

    const newVoices = chordConfig.voices.map((voice, index) => {
      if (index < preset.offsets.length) {
        return {
          ...voice,
          enabled: true,
          semitoneOffset: preset.offsets[index],
        };
      }
      return { ...voice, enabled: false };
    });

    onChordConfigChange({ ...chordConfig, voices: newVoices });
  }, [chordConfig, onChordConfigChange]);

  const clearAllVoices = useCallback(() => {
    const newVoices = chordConfig.voices.map(voice => ({
      ...voice,
      enabled: false,
    }));
    onChordConfigChange({ ...chordConfig, voices: newVoices });
  }, [chordConfig, onChordConfigChange]);

  // Convert note name and octave to MIDI number
  const noteToMidi = (note: string, octave: number): number => {
    const noteIndex = NOTES.indexOf(note);
    if (noteIndex === -1) return 60;
    return (octave + 1) * 12 + noteIndex;
  };

  // Preview the chord
  const previewChord = useCallback(() => {
    const rootMidi = noteToMidi(chordConfig.rootNote, chordConfig.rootOctave);
    const noteDuration = (60 / bpm / 4) * 0.8; // 16th note duration

    chordConfig.voices.forEach((voice, index) => {
      if (!voice.enabled) return;

      const midiNote = rootMidi + voice.semitoneOffset;
      const noteOctave = Math.floor(midiNote / 12) - 1;
      const noteIndex = midiNote % 12;
      const noteName = NOTES[noteIndex];

      const playNote = () => {
        if (previewViaMidi && globalMidiOutput.isAvailable()) {
          // Play via MIDI
          const channel = (voice.channel ?? globalChannel) - 1;
          globalMidiOutput.playNote(noteName, noteOctave, voice.velocity, channel, noteDuration * 1000);
        } else {
          // Play via Web Audio
          globalSynth.playNote(noteName, noteOctave, voice.velocity, noteDuration);
        }
      };

      if (voice.delay > 0) {
        setTimeout(playNote, voice.delay);
      } else {
        playNote();
      }
    });
  }, [chordConfig, previewViaMidi, bpm, globalChannel]);

  // Count enabled voices
  const enabledVoiceCount = chordConfig.voices.filter(v => v.enabled).length;

  return (
    <div className="flex flex-col gap-3 p-2">
      {/* Root note and chord presets */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-sm">Root:</Label>
          <Select value={chordConfig.rootNote} onValueChange={handleRootNoteChange}>
            <SelectTrigger className="h-8 w-16">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NOTES.map((note) => (
                <SelectItem key={note} value={note}>{note}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={chordConfig.rootOctave.toString()} onValueChange={(v: string) => handleRootOctaveChange(parseInt(v, 10))}>
            <SelectTrigger className="h-8 w-14">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OCTAVES.map((oct) => (
                <SelectItem key={oct} value={oct.toString()}>{oct}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={previewChord}
            disabled={enabledVoiceCount === 0}
            className="h-8"
          >
            <Play className="w-3 h-3 mr-1" />
            Preview
          </Button>
          <div className="flex items-center gap-1.5">
            <Switch
              checked={previewViaMidi}
              onCheckedChange={setPreviewViaMidi}
              className="scale-75"
            />
            <span className="text-xs text-muted-foreground">
              {previewViaMidi ? 'MIDI' : 'Audio'}
            </span>
          </div>
        </div>
      </div>

      {/* MIDI Input section */}
      <div className="flex items-center gap-3 flex-wrap border-t pt-2">
        <div className="flex items-center gap-2">
          <Keyboard className="w-4 h-4 text-muted-foreground" />
          <Label className="text-sm">Input:</Label>
          <Select 
            value={useQwerty ? 'qwerty' : (midiInputDevice || 'all')} 
            onValueChange={(v: string) => {
              if (v === 'qwerty') {
                setUseQwerty(true);
              } else {
                setUseQwerty(false);
                setMidiInputDevice(v === 'all' ? null : v);
              }
            }}
          >
            <SelectTrigger className="h-7 w-32 text-xs">
              <SelectValue placeholder="All Devices" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="qwerty">QWERTY Keyboard</SelectItem>
              <SelectItem value="all">All MIDI Devices</SelectItem>
              {availableMidiInputs.map((input) => (
                <SelectItem key={input.id} value={input.id}>{input.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {useQwerty ? (
            <Select value={qwertyOctave.toString()} onValueChange={(v: string) => setQwertyOctave(parseInt(v, 10))}>
              <SelectTrigger className="h-7 w-16 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7].map((oct) => (
                  <SelectItem key={oct} value={oct.toString()}>Oct {oct}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select value={midiInputChannel.toString()} onValueChange={(v: string) => setMidiInputChannel(parseInt(v, 10))}>
              <SelectTrigger className="h-7 w-16 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Omni</SelectItem>
                {Array.from({ length: 16 }, (_, i) => i + 1).map((ch) => (
                  <SelectItem key={ch} value={ch.toString()}>Ch {ch}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Switch
              checked={clearOnLearn}
              onCheckedChange={setClearOnLearn}
              className="scale-75"
            />
            <span className="text-xs text-muted-foreground">Clear & Learn</span>
          </div>
          
          <Button
            variant={midiLearnActive ? "destructive" : "outline"}
            size="sm"
            onClick={() => setMidiLearnActive(!midiLearnActive)}
            className="h-7 text-xs"
          >
            {midiLearnActive && (
              <Circle className="w-2 h-2 mr-1 fill-current animate-pulse" />
            )}
            {midiLearnActive ? 'Learning...' : 'Learn'}
          </Button>
          
          {midiLearnActive && (
            <span className="text-xs text-muted-foreground">
              {enabledVoiceCount}/8 {useQwerty && '(Z-M, Q-P)'}
            </span>
          )}
        </div>
      </div>

      {/* Chord presets */}
      <div className="flex flex-wrap gap-1">
        {Object.entries(CHORD_PRESETS).map(([key, preset]) => (
          <Button
            key={key}
            variant="outline"
            size="sm"
            onClick={() => applyChordPreset(key)}
            className="h-6 text-xs px-2"
          >
            {preset.name}
          </Button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAllVoices}
          className="h-6 text-xs px-2 text-muted-foreground"
        >
          Clear
        </Button>
      </div>

      {/* Voice list header */}
      <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground border-b pb-1">
        <span className="w-4"></span>
        <span className="w-4">#</span>
        <span className="w-14 text-center">Offset</span>
        <span className="w-24">Device</span>
        <span className="w-16">Channel</span>
        <span className="w-28">Delay (ms)</span>
        <span className="flex-1">Velocity</span>
      </div>

      {/* Voice rows in scroll area */}
      <ScrollArea className="h-[280px]">
        <div className="flex flex-col gap-1 pr-3">
          {chordConfig.voices.map((voice, index) => (
            <VoiceRow
              key={index}
              index={index}
              voice={voice}
              onChange={(v) => handleVoiceChange(index, v)}
              availableDevices={availableDevices}
              globalDeviceName={globalDeviceName}
              globalChannel={globalChannel}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Status */}
      <div className="text-xs text-muted-foreground text-center border-t pt-2">
        {enabledVoiceCount} voice{enabledVoiceCount !== 1 ? 's' : ''} enabled
        {enabledVoiceCount > 0 && ` • Root: ${chordConfig.rootNote}${chordConfig.rootOctave}`}
      </div>
    </div>
  );
}
