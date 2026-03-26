import React, { useState, useEffect, useCallback, useRef } from "react";
import { SequencerGrid } from "./components/sequencer-grid";
import { MidiControls } from "./components/midi-controls";
import { ScaleControls } from "./components/scale-controls";
import { AudioPreview } from "./components/audio-preview";
import { MicrotuningControls } from "./components/microtuning-controls";
import { RandomizationControls } from "./components/randomization-controls";
import { KeyboardStepRecorder } from "./components/keyboard-step-recorder";
import { EuclideanControls } from "./components/euclidean-controls";
import { MidiOutputControls } from "./components/midi-output-controls";
import { generateScale, scaleToGrid } from "./utils/scales";
import { MicrotuningPreset, globalSynth } from "./utils/websynths";
import { globalMidiOutput } from "./utils/midi-output";
import { globalMidiManager } from "./utils/midi-input";
import { type StepCCConfig, createDefaultCCConfig, processStepCCs } from "./utils/cc-modulation";
import { type StepChordConfig, createDefaultChordConfig } from "./components/step-chord-editor";

export default function App() {
  // Cell states: 'on' | 'restart' | 'skip'
  const [stepStates, setStepStates] = useState<string[][]>([
    ["on", "restart", "on", "skip"],
    ["restart", "on", "restart", "on"],
    ["on", "skip", "on", "restart"],
    ["skip", "on", "restart", "on"],
  ]);

  // Transport controls: 'continue' | 'stop' | 'jump' - mostly continue to keep looping
  const [stepTransports, setStepTransports] = useState<string[][]>([
    ["continue", "continue", "continue", "continue"],
    ["continue", "continue", "continue", "continue"],
    ["continue", "continue", "continue", "continue"],
    ["continue", "continue", "continue", "continue"],
  ]);

  // Each cell has its own direction
  const [stepDirections, setStepDirections] = useState<string[][]>([
    ["right", "right", "right", "right"],
    ["right", "right", "right", "right"],
    ["right", "right", "right", "right"],
    ["right", "right", "right", "right"],
  ]);

  // Velocity per cell (64-127)
  const [stepVelocities, setStepVelocities] = useState<number[][]>([
    [64, 64, 64, 64],
    [64, 64, 64, 64],
    [64, 64, 64, 64],
    [64, 64, 64, 64],
  ]);

  // Pending (quantized) updates applied on clock ticks
  const pendingDirectionUpdates = useRef<Map<string, string>>(new Map());
  const pendingVelocityUpdates = useRef<Map<string, number>>(new Map());
  const pendingDelayMsUpdates = useRef<Map<string, number>>(new Map());
  const pendingDelayEnabledUpdates = useRef<Map<string, boolean>>(new Map());
  const pendingJumpRef = useRef<[number, number] | null>(null); // Quantized step jump

  // Notes per cell - C major scale starting from top left
  const [stepNotes, setStepNotes] = useState<string[][]>([
    ["C", "D", "E", "F"],
    ["G", "A", "B", "C"],
    ["D", "E", "F", "G"],
    ["A", "B", "C", "D"],
  ]);

  // Octaves per cell - progressing through octaves as we go through the scale
  const [stepOctaves, setStepOctaves] = useState<number[][]>([
    [4, 4, 4, 4],
    [4, 4, 4, 5],
    [5, 5, 5, 5],
    [5, 5, 6, 6],
  ]);

  const [currentStep, setCurrentStep] = useState<[number, number]>([0, 0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const startingStepRef = useRef<[number, number]>([0, 0]); // Track where sequencer started for restart ("R") state
  const [midiValue, setMidiValue] = useState(64);
  const [bpm, setBpm] = useState(120);
  const [globalSwing, setGlobalSwing] = useState(0);
  const [swingTightness, setSwingTightness] = useState(50);
  const [hoveredCell, setHoveredCell] = useState<[number, number] | null>(null);
  const [currentOctave, setCurrentOctave] = useState(4);

  // Scale selection state
  const [selectedScale, setSelectedScale] = useState("major");
  const [selectedRoot, setSelectedRoot] = useState("C");
  const [globalOctave, setGlobalOctave] = useState(1);

  // Audio and microtuning state
  const [currentMicrotuning, setCurrentMicrotuning] =
    useState<MicrotuningPreset | null>(null);

  // Step recording state
  const [isStepRecording, setIsStepRecording] = useState(false);
  const [currentRecordingStep, setCurrentRecordingStep] = useState<
    [number, number]
  >([0, 0]);
  const currentRecordingStepRef = useRef<[number, number]>([0, 0]);
  const pendingStepRecordingRef = useRef<{
    note: string;
    octave: number;
    velocity: number;
  } | null>(null);

  // Export and audio recording state
  const [isRecordingExport, setIsRecordingExport] = useState(false);
  const [isWaitingForNextBar, setIsWaitingForNextBar] = useState(false); // New state for bar sync
  const [isRecordingTransition, setIsRecordingTransition] = useState(false); // Prevents overlapping operations
  const [recordedBars, setRecordedBars] = useState<
    Array<{
      step: [number, number];
      note: string;
      octave: number;
      velocity: number;
      quantizedTicks: number;
      stepPosition: number;
      barNumber: number;
      quantizeValue: string;
      delayMs: number;
      delayEnabled: boolean;
      swingAmount: number;
    }>
  >([]);
  const [barCount, setBarCount] = useState(0);
  const [recordingStartTime, setRecordingStartTime] = useState<number>(0);

  // Root note change state
  const [pendingRootChange, setPendingRootChange] = useState<string | null>(
    null,
  );
  const [stepsSinceLastBar, setStepsSinceLastBar] = useState(0);

  // MIDI channel state (1-16)
  const [midiOutputChannel, setMidiOutputChannel] = useState<number>(1);

  // MIDI input device/channel state (for step recording)
  const [midiInputStatus, setMidiInputStatus] = useState({
    supported: false,
    available: false,
    message: "",
  });
  const [availableMidiInputs, setAvailableMidiInputs] = useState<
    { id: string; name: string }[]
  >([]);
  const [selectedMidiInputId, setSelectedMidiInputId] = useState<string>("all");
  const [midiInputChannel, setMidiInputChannel] = useState<number>(0); // 0 = omni

  // Conditional step probabilities (0-100% chance of playing)
  const [stepProbabilities, setStepProbabilities] = useState<number[][]>([
    [100, 100, 100, 100],
    [100, 100, 100, 100],
    [100, 100, 100, 100],
    [100, 100, 100, 100],
  ]);

  // Per-step delay (ms) and enabled toggle
  const [stepDelayMs, setStepDelayMs] = useState<number[][]>([
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  const [stepDelayEnabled, setStepDelayEnabled] = useState<boolean[][]>([
    [false, false, false, false],
    [false, false, false, false],
    [false, false, false, false],
    [false, false, false, false],
  ]);

  // Step repeat quantization (musical note values: 1/16, 1/8, 1/4, 1/2, 1/1)
  const [stepRepeats, setStepRepeats] = useState<string[][]>([
    ["1/16", "1/16", "1/16", "1/16"],
    ["1/16", "1/16", "1/16", "1/16"],
    ["1/16", "1/16", "1/16", "1/16"],
    ["1/16", "1/16", "1/16", "1/16"],
  ]);

  // Clock dividers per cell (1, 2, 3, 4, 6, 8, 9, 12, 16)
  const [stepClockDividers, setStepClockDividers] = useState<number[][]>([
    [1, 1, 1, 1],
    [1, 1, 1, 1],
    [1, 1, 1, 1],
    [1, 1, 1, 1],
  ]);

  // Per-step MIDI device (null = use global device)
  const [stepMidiDevices, setStepMidiDevices] = useState<(string | null)[][]>([
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
  ]);

  // Per-step MIDI channel (null = use global channel)
  const [stepMidiChannels, setStepMidiChannels] = useState<(number | null)[][]>([
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
  ]);

  // Per-step CC configurations (4 CC knobs per step with modulation)
  const [stepCCConfigs, setStepCCConfigs] = useState<StepCCConfig[][]>(() => 
    Array.from({ length: 4 }, () => 
      Array.from({ length: 4 }, () => createDefaultCCConfig())
    )
  );

  // Per-step chord configurations (8 voices per step)
  const [stepChordConfigs, setStepChordConfigs] = useState<StepChordConfig[][]>(() =>
    Array.from({ length: 4 }, () =>
      Array.from({ length: 4 }, () => createDefaultChordConfig())
    )
  );

  // Available MIDI output devices (fetched from globalMidiOutput)
  const [availableMidiOutputs, setAvailableMidiOutputs] = useState<{ id: string; name: string }[]>([]);
  const [selectedMidiOutputId, setSelectedMidiOutputId] = useState<string | null>(null);

  // Steps per bar setting (6, 8, 9, 12, 16, 32, 64, or custom)
  const [stepsPerBar, setStepsPerBar] = useState(16);
  const [customStepsPerBar, setCustomStepsPerBar] = useState(16);

  // Quantize + divider combine mode ('and' | 'or')
  const [quantizeCombineMode, setQuantizeCombineMode] = useState<
    "and" | "or"
  >("and");

  // Advance step only when divider triggers (false = always advance)
  const [advanceOnDivider, setAdvanceOnDivider] = useState(false);

  // Current repeat counter per step for conditional logic
  const [stepRepeatCounters, setStepRepeatCounters] = useState<number[][]>([
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);

  // Clock divider counters per step
  const [stepClockCounters, setStepClockCounters] = useState<number[][]>([
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);

  // Restart timing mode: 'hybrid' (waits for delay), 'immediate' (instant), 'nextTick' (one step later)
  const [restartMode, setRestartMode] = useState<"hybrid" | "immediate" | "nextTick">("hybrid");

  // Refs for clock-stable reads (avoid re-creating the clock loop)
  const stepStatesRef = useRef(stepStates);
  const stepTransportsRef = useRef(stepTransports);
  const stepNotesRef = useRef(stepNotes);
  const stepOctavesRef = useRef(stepOctaves);
  const stepVelocitiesRef = useRef(stepVelocities);
  const stepProbabilitiesRef = useRef(stepProbabilities);
  const stepDelayMsRef = useRef(stepDelayMs);
  const stepDelayEnabledRef = useRef(stepDelayEnabled);
  const stepRepeatsRef = useRef(stepRepeats);
  const stepClockDividersRef = useRef(stepClockDividers);
  const stepClockCountersRef = useRef(stepClockCounters);
  const stepMidiDevicesRef = useRef(stepMidiDevices);
  const stepMidiChannelsRef = useRef(stepMidiChannels);
  const stepCCConfigsRef = useRef(stepCCConfigs);
  const stepChordConfigsRef = useRef(stepChordConfigs);
  const stepsPerBarRef = useRef(stepsPerBar);
  const quantizeCombineModeRef = useRef(quantizeCombineMode);
  const advanceOnDividerRef = useRef(advanceOnDivider);
  const globalSwingRef = useRef(globalSwing);
  const swingTightnessRef = useRef(swingTightness);
  const currentStepRef = useRef(currentStep);
  const isPlayingRef = useRef(isPlaying);
  const pendingRootChangeRef = useRef(pendingRootChange);
  const isStepRecordingRef = useRef(isStepRecording);
  const bpmRef = useRef(bpm);
  const restartModeRef = useRef(restartMode);
  const midiOutputChannelRef = useRef(midiOutputChannel);

  useEffect(() => {
    stepStatesRef.current = stepStates;
  }, [stepStates]);

  useEffect(() => {
    stepTransportsRef.current = stepTransports;
  }, [stepTransports]);

  useEffect(() => {
    stepNotesRef.current = stepNotes;
  }, [stepNotes]);

  useEffect(() => {
    stepOctavesRef.current = stepOctaves;
  }, [stepOctaves]);

  useEffect(() => {
    stepVelocitiesRef.current = stepVelocities;
  }, [stepVelocities]);

  useEffect(() => {
    stepProbabilitiesRef.current = stepProbabilities;
  }, [stepProbabilities]);

  useEffect(() => {
    stepDelayMsRef.current = stepDelayMs;
  }, [stepDelayMs]);

  useEffect(() => {
    stepDelayEnabledRef.current = stepDelayEnabled;
  }, [stepDelayEnabled]);

  useEffect(() => {
    stepRepeatsRef.current = stepRepeats;
  }, [stepRepeats]);

  useEffect(() => {
    stepClockDividersRef.current = stepClockDividers;
  }, [stepClockDividers]);

  useEffect(() => {
    stepClockCountersRef.current = stepClockCounters;
  }, [stepClockCounters]);

  useEffect(() => {
    stepMidiDevicesRef.current = stepMidiDevices;
  }, [stepMidiDevices]);

  useEffect(() => {
    stepMidiChannelsRef.current = stepMidiChannels;
  }, [stepMidiChannels]);

  useEffect(() => {
    stepCCConfigsRef.current = stepCCConfigs;
  }, [stepCCConfigs]);

  useEffect(() => {
    stepChordConfigsRef.current = stepChordConfigs;
  }, [stepChordConfigs]);

  useEffect(() => {
    midiOutputChannelRef.current = midiOutputChannel;
  }, [midiOutputChannel]);

  useEffect(() => {
    stepsPerBarRef.current = stepsPerBar;
  }, [stepsPerBar]);

  useEffect(() => {
    quantizeCombineModeRef.current = quantizeCombineMode;
  }, [quantizeCombineMode]);

  useEffect(() => {
    advanceOnDividerRef.current = advanceOnDivider;
  }, [advanceOnDivider]);

  useEffect(() => {
    globalSwingRef.current = globalSwing;
  }, [globalSwing]);

  useEffect(() => {
    swingTightnessRef.current = swingTightness;
  }, [swingTightness]);

  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    pendingRootChangeRef.current = pendingRootChange;
  }, [pendingRootChange]);

  useEffect(() => {
    isStepRecordingRef.current = isStepRecording;
  }, [isStepRecording]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    restartModeRef.current = restartMode;
  }, [restartMode]);

  const getNextStep = useCallback(
    (currentPos: [number, number]): [number, number] => {
      // Direction mappings - moved inside useCallback to fix dependency issue
      const directionMap: Record<string, [number, number]> = {
        up: [-1, 0],
        down: [1, 0],
        left: [0, -1],
        right: [0, 1],
        "up-left": [-1, -1],
        "up-right": [-1, 1],
        "down-left": [1, -1],
        "down-right": [1, 1],
      };

      const [row, col] = currentPos;
      const cellDirection = stepDirections[row][col];
      const [deltaRow, deltaCol] = directionMap[cellDirection];
      let [newRow, newCol] = [row + deltaRow, col + deltaCol];

      // Wrap around boundaries for 4x4 grid
      if (newRow < 0) newRow = 3;
      if (newRow > 3) newRow = 0;
      if (newCol < 0) newCol = 3;
      if (newCol > 3) newCol = 0;

      return [newRow, newCol];
    },
    [stepDirections],
  );

  // Advance recording step position
  const advanceRecordingStep = useCallback(() => {
    const nextStep = getNextStep(currentRecordingStepRef.current);
    setCurrentRecordingStep(nextStep);
    currentRecordingStepRef.current = nextStep;
  }, [getNextStep]);

  useEffect(() => {
    currentRecordingStepRef.current = currentRecordingStep;
  }, [currentRecordingStep]);

  // MIDI input status + device polling
  useEffect(() => {
    const updateMidiStatus = () => {
      setMidiInputStatus(globalMidiManager.getMidiStatus());
      if (globalMidiManager.isMidiAvailable()) {
        const inputs = globalMidiManager.getAvailableInputs();
        setAvailableMidiInputs(inputs);
        if (
          inputs.length > 0 &&
          selectedMidiInputId !== "all" &&
          !inputs.find((input) => input.id === selectedMidiInputId)
        ) {
          setSelectedMidiInputId("all");
        }
      }
    };

    updateMidiStatus();
    const interval = setInterval(updateMidiStatus, 2000);
    return () => clearInterval(interval);
  }, [selectedMidiInputId]);

  useEffect(() => {
    globalMidiManager.setSelectedInputId(
      selectedMidiInputId === "all" ? null : selectedMidiInputId,
    );
  }, [selectedMidiInputId]);

  useEffect(() => {
    globalMidiManager.setSelectedChannel(midiInputChannel);
  }, [midiInputChannel]);

  // MIDI output device polling
  useEffect(() => {
    const updateMidiOutputs = () => {
      const outputs = globalMidiOutput.getAvailableOutputs();
      setAvailableMidiOutputs(outputs.map(o => ({ id: o.id, name: o.name })));
      const selected = globalMidiOutput.getSelectedOutput();
      if (selected) {
        setSelectedMidiOutputId(selected.id);
      }
    };

    updateMidiOutputs();
    const interval = setInterval(updateMidiOutputs, 2000);
    return () => clearInterval(interval);
  }, []);

  const getSwingRatio = (swingAmount: number) => {
    const clamped = Math.max(-75, Math.min(75, swingAmount));
    if (clamped === 0) return 0;
    const normalized = Math.abs(clamped) / 75;
    if (clamped < 0) {
      const tightness = Math.max(0, Math.min(100, swingTightnessRef.current));
      const exponent = 1.1 + (tightness / 100) * 1.1; // 1.1 (loose) -> 2.2 (tight)
      return Math.pow(normalized, exponent); // MPC-style curve
    }
    return normalized; // linear swing
  };

  // Export recording function as MIDI 1.0 file with proper quantization
  const exportRecording = useCallback(() => {
    if (recordedBars.length === 0) return;

    // Convert note names to MIDI note numbers
    const noteToMidi = (note: string, octave: number): number => {
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
    };

    // Create MIDI file structure with quantized timing
    const createMidiFile = () => {
      const ticksPerQuarter = 480; // Standard MIDI resolution
      const ticksPer16th = ticksPerQuarter / 4; // 120 ticks per 1/16 note
      const microsecondsPerQuarter = Math.round(60000000 / bpm);

      // MIDI header chunk
      const header = new Uint8Array([
        0x4d,
        0x54,
        0x68,
        0x64, // "MThd"
        0x00,
        0x00,
        0x00,
        0x06, // Header length (6 bytes)
        0x00,
        0x00, // Format type 0 (single track)
        0x00,
        0x01, // Number of tracks (1)
        (ticksPerQuarter >> 8) & 0xff,
        ticksPerQuarter & 0xff, // Ticks per quarter note
      ]);

      // Prepare track events
      const events: number[] = [];

      // Tempo event (at time 0)
      events.push(0x00); // Delta time = 0
      events.push(0xff, 0x51, 0x03); // Meta event: Set Tempo
      events.push((microsecondsPerQuarter >> 16) & 0xff);
      events.push((microsecondsPerQuarter >> 8) & 0xff);
      events.push(microsecondsPerQuarter & 0xff);

      const msToTicks = (ms: number) =>
        Math.round((ms * ticksPerQuarter * bpm) / 60000);

      const getSwingTicks = (swingAmount: number) => {
        const swingRatio = getSwingRatio(swingAmount);
        return Math.round(ticksPer16th * 0.5 * swingRatio);
      };

      // Sort recorded notes by their absolute tick position (includes delay)
      const sortedNotes = [...recordedBars]
        .map((noteData) => {
          const delayTicks = noteData.delayEnabled
            ? msToTicks(noteData.delayMs)
            : 0;
          const swingTicks =
            noteData.stepPosition % 2 === 1
              ? getSwingTicks(noteData.swingAmount)
              : 0;
          return {
            ...noteData,
            noteTickPosition:
              noteData.stepPosition * ticksPer16th + delayTicks + swingTicks,
          };
        })
        .sort((a, b) => a.noteTickPosition - b.noteTickPosition);

      let lastTicks = 0;
      sortedNotes.forEach((noteData) => {
        const midiNote = noteToMidi(noteData.note, noteData.octave);

        const noteTickPosition = noteData.noteTickPosition;
        const deltaTime = noteTickPosition - lastTicks;

        // Ensure we don't have negative delta times
        const safeDeltaTime = Math.max(0, deltaTime);

        // Note On event
        events.push(...encodeVariableLength(safeDeltaTime));
        events.push(0x90); // Note On, channel 0
        events.push(midiNote);
        events.push(noteData.velocity);

        // Note Off event - use quantized duration based on note value
        const noteDuration = getQuantizedDuration(
          noteData.quantizeValue,
          ticksPer16th,
        );
        events.push(...encodeVariableLength(noteDuration));
        events.push(0x80); // Note Off, channel 0
        events.push(midiNote);
        events.push(0x40); // Release velocity

        lastTicks = noteTickPosition + noteDuration;
      });

      // End of track
      events.push(0x00); // Delta time = 0
      events.push(0xff, 0x2f, 0x00); // Meta event: End of Track

      // Track header
      const trackLength = events.length;
      const trackHeader = new Uint8Array([
        0x4d,
        0x54,
        0x72,
        0x6b, // "MTrk"
        (trackLength >> 24) & 0xff,
        (trackLength >> 16) & 0xff,
        (trackLength >> 8) & 0xff,
        trackLength & 0xff,
      ]);

      // Combine header, track header, and events
      const midiFile = new Uint8Array(
        header.length + trackHeader.length + events.length,
      );
      midiFile.set(header, 0);
      midiFile.set(trackHeader, header.length);
      midiFile.set(events, header.length + trackHeader.length);

      return midiFile;
    };

    // Get quantized note duration in MIDI ticks
    const getQuantizedDuration = (
      quantizeValue: string,
      ticksPer16th: number,
    ): number => {
      const parsed = parseQuantizeValue(quantizeValue) || {
        numerator: 1,
        denominator: 16,
      };
      const ticksPerWhole = ticksPer16th * 16;
      const durationTicks =
        (ticksPerWhole * parsed.numerator) / parsed.denominator;
      return Math.round(durationTicks * 0.8);
    };

    // Encode variable length quantity (MIDI standard)
    const encodeVariableLength = (value: number): number[] => {
      const result: number[] = [];
      result.push(value & 0x7f);

      while (value > 127) {
        value >>= 7;
        result.unshift((value & 0x7f) | 0x80);
      }

      return result;
    };

    // Create and download MIDI file
    const midiData = createMidiFile();
    const blob = new Blob([midiData], { type: "audio/midi" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `sequencer-quantized-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.mid`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
    console.log(
      "Quantized MIDI export completed:",
      recordedBars.length,
      "notes exported with perfect timing",
    );
  }, [recordedBars, bpm, stepsPerBar]);

  const getNextStepRef = useRef(getNextStep);
  const handleNoteChangeRef = useRef(handleNoteChange);
  const handleOctaveChangeRef = useRef(handleOctaveChange);
  const advanceRecordingStepRef = useRef(advanceRecordingStep);
  const exportRecordingRef = useRef(exportRecording);

  useEffect(() => {
    getNextStepRef.current = getNextStep;
  }, [getNextStep]);

  useEffect(() => {
    handleNoteChangeRef.current = handleNoteChange;
  }, [handleNoteChange]);

  useEffect(() => {
    handleOctaveChangeRef.current = handleOctaveChange;
  }, [handleOctaveChange]);

  useEffect(() => {
    advanceRecordingStepRef.current = advanceRecordingStep;
  }, [advanceRecordingStep]);

  useEffect(() => {
    exportRecordingRef.current = exportRecording;
  }, [exportRecording]);

  // Fixed step sequencer with proper quantization (separated advancement from triggering)
  useEffect(() => {
    if (!isPlaying && !isStepRecording) return;

    // Use consistent 1/16 note timing as base clock - read from ref for live updates
    let globalStepCounter = 0;
    let nextTickTime = performance.now();
    let timerId: number | null = null;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;

      // Calculate interval from ref for live BPM updates without loop restart
      const sixteenthNoteInterval = (60 / bpmRef.current / 4) * 1000;

      // Apply queued step jump on clock tick (quantized to BPM)
      if (pendingJumpRef.current) {
        const [jumpRow, jumpCol] = pendingJumpRef.current;
        currentStepRef.current = [jumpRow, jumpCol];
        setCurrentStep([jumpRow, jumpCol]);
        startingStepRef.current = [jumpRow, jumpCol]; // Update restart target to new starting position
        pendingJumpRef.current = null;
        console.log(`⏭️ Quantized jump to step [${jumpRow},${jumpCol}] - new restart target`);
      }

      // Apply queued step recording input on clock tick (quantized)
      if (isStepRecordingRef.current && pendingStepRecordingRef.current) {
        const pending = pendingStepRecordingRef.current;
        const [row, col] = currentRecordingStepRef.current;

        handleNoteChangeRef.current(row, col, pending.note);
        handleOctaveChangeRef.current(row, col, pending.octave);
        setStepVelocities((prev) => {
          const newVelocities = [...prev];
          newVelocities[row] = [...newVelocities[row]];
          newVelocities[row][col] = pending.velocity;
          return newVelocities;
        });
        setStepStates((prev) => {
          const newStates = [...prev];
          newStates[row] = [...newStates[row]];
          newStates[row][col] = "on";
          return newStates;
        });
        advanceRecordingStepRef.current();
        pendingStepRecordingRef.current = null;
      }

      // Apply queued direction/velocity updates on the clock tick (quantized)
      if (pendingDirectionUpdates.current.size > 0) {
        setStepDirections((prev) => {
          const newDirections = prev.map((row) => [...row]);
          pendingDirectionUpdates.current.forEach((direction, key) => {
            const [rowStr, colStr] = key.split("-");
            const row = Number(rowStr);
            const col = Number(colStr);
            if (
              Number.isFinite(row) &&
              Number.isFinite(col) &&
              newDirections[row] &&
              typeof newDirections[row][col] === "string"
            ) {
              newDirections[row][col] = direction;
            }
          });
          return newDirections;
        });
        pendingDirectionUpdates.current.clear();
      }

      if (pendingVelocityUpdates.current.size > 0) {
        setStepVelocities((prev) => {
          const newVelocities = prev.map((row) => [...row]);
          pendingVelocityUpdates.current.forEach((velocity, key) => {
            const [rowStr, colStr] = key.split("-");
            const row = Number(rowStr);
            const col = Number(colStr);
            if (
              Number.isFinite(row) &&
              Number.isFinite(col) &&
              newVelocities[row] &&
              typeof newVelocities[row][col] === "number"
            ) {
              newVelocities[row][col] = velocity;
            }
          });
          return newVelocities;
        });
        pendingVelocityUpdates.current.clear();
      }

      if (pendingDelayMsUpdates.current.size > 0) {
        setStepDelayMs((prev) => {
          const newDelays = prev.map((row) => [...row]);
          pendingDelayMsUpdates.current.forEach((delayMs, key) => {
            const [rowStr, colStr] = key.split("-");
            const row = Number(rowStr);
            const col = Number(colStr);
            if (
              Number.isFinite(row) &&
              Number.isFinite(col) &&
              newDelays[row] &&
              typeof newDelays[row][col] === "number"
            ) {
              newDelays[row][col] = delayMs;
            }
          });
          return newDelays;
        });
        pendingDelayMsUpdates.current.clear();
      }

      if (pendingDelayEnabledUpdates.current.size > 0) {
        setStepDelayEnabled((prev) => {
          const newEnabled = prev.map((row) => [...row]);
          pendingDelayEnabledUpdates.current.forEach((enabled, key) => {
            const [rowStr, colStr] = key.split("-");
            const row = Number(rowStr);
            const col = Number(colStr);
            if (
              Number.isFinite(row) &&
              Number.isFinite(col) &&
              newEnabled[row] &&
              typeof newEnabled[row][col] === "boolean"
            ) {
              newEnabled[row][col] = enabled;
            }
          });
          return newEnabled;
        });
        pendingDelayEnabledUpdates.current.clear();
      }

      if (isPlaying) {
        const [row, col] = currentStepRef.current;
        const stepState = stepStatesRef.current[row][col];
        const transport = stepTransportsRef.current[row][col];
        const repeatValue = stepRepeatsRef.current[row][col];
        const clockDivider = Math.max(1, stepClockDividersRef.current[row][col]);

        const stepPosition = row * 4 + col; // Calculate step position in sequence
        const elapsedMs = globalStepCounter * sixteenthNoteInterval;
        const quantizeTrigger = shouldStepTrigger(
          elapsedMs,
          repeatValue,
          stepPosition,
          sixteenthNoteInterval,
          bpmRef.current,
        );

        const shouldAdvanceDividerCounter = quantizeTrigger;
        const currentCounter = stepClockCountersRef.current[row][col] ?? 0;
        const nextCounter = shouldAdvanceDividerCounter
          ? (currentCounter + 1) % clockDivider
          : currentCounter;

        if (nextCounter !== currentCounter) {
          setStepClockCounters((prev) => {
            const newCounters = prev.map((r) => [...r]);
            newCounters[row][col] = nextCounter;
            stepClockCountersRef.current = newCounters;
            return newCounters;
          });
        }

        const clockDividerTrigger = shouldAdvanceDividerCounter && nextCounter === 0;

        const shouldTrigger =
          quantizeCombineModeRef.current === "and"
            ? clockDividerTrigger && quantizeTrigger
            : clockDividerTrigger || quantizeTrigger;

          // Define quantize map for export timing calculations
          const probability = stepProbabilitiesRef.current[row][col];
          const probabilityPass =
            probability >= 100 || Math.random() * 100 < probability;
          const delayEnabled = stepDelayEnabledRef.current[row][col];
          const delayMs = delayEnabled
            ? stepDelayMsRef.current[row][col]
            : 0;
          const swingAmount = globalSwingRef.current;
          const swingRatio = getSwingRatio(swingAmount);
          const swingMs =
            stepPosition % 2 === 1
              ? sixteenthNoteInterval * 0.5 * swingRatio
              : 0;
          const totalDelayMs = delayMs + swingMs;

          // Play the current step if it's 'on' or 'restart' and should trigger
          let restartTriggered = false;
          if ((stepState === "on" || stepState === "restart") && shouldTrigger && probabilityPass) {
            const note = stepNotesRef.current[row][col];
            const octave = stepOctavesRef.current[row][col];
            const velocity = stepVelocitiesRef.current[row][col];

            // Get per-step MIDI device and channel (or use global)
            const stepDevice = stepMidiDevicesRef.current[row][col];
            const stepChannel = stepMidiChannelsRef.current[row][col];
            const effectiveChannel = stepChannel !== null ? stepChannel - 1 : midiOutputChannelRef.current - 1;

            // Resolve the effective device: per-step override takes priority, then global selected device
            const effectiveDeviceId = stepDevice || globalMidiOutput.getSelectedOutput()?.id || null;

            // Get CC config and chord config for this step
            const ccConfig = stepCCConfigsRef.current[row][col];
            const chordConfig = stepChordConfigsRef.current[row][col];

            console.log(
              `Playing step [${row},${col}]: ${note}${octave} @ velocity ${velocity} (div:${clockDivider}, ${repeatValue}, delay:${delayMs}ms, device:${effectiveDeviceId || 'none'})`,
            );

            // Subtract swing delay from duration to prevent note-off extending past step boundary
            const baseDuration = Math.round(getQuantizeDurationMs(repeatValue, bpmRef.current) * 0.8);
            const noteDuration = Math.max(60, baseDuration - swingMs);

            const playNote = () => {
              if (!isPlayingRef.current) return;
              // Require a resolved device (per-step or global)
              if (!effectiveDeviceId || !globalMidiOutput.isDeviceAvailable(effectiveDeviceId)) return;

              // Send CC messages before note-on (with modulation applied)
              const ccMessages = processStepCCs(ccConfig, velocity, note, octave);
              for (const cc of ccMessages) {
                globalMidiOutput.sendControlChangeToDevice(effectiveDeviceId, cc.ccNumber, cc.value, effectiveChannel);
              }

              // Play the main note to the resolved device
              globalMidiOutput.playNoteToDevice(
                effectiveDeviceId,
                note,
                octave,
                velocity,
                effectiveChannel,
                noteDuration,
              );

              // Play chord voices (if any enabled)
              const NOTES_ARRAY = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
              const noteToMidiNum = (n: string, o: number) => {
                const noteIndex = NOTES_ARRAY.indexOf(n);
                return noteIndex >= 0 ? (o + 1) * 12 + noteIndex : 60;
              };
              
              const rootMidi = noteToMidiNum(chordConfig.rootNote, chordConfig.rootOctave);
              
              chordConfig.voices.forEach((voice, voiceIndex) => {
                if (!voice.enabled) return;

                const voiceMidi = rootMidi + voice.semitoneOffset;
                const voiceOctave = Math.floor(voiceMidi / 12) - 1;
                const voiceNoteIndex = ((voiceMidi % 12) + 12) % 12;
                const voiceNoteName = NOTES_ARRAY[voiceNoteIndex];
                
                // Determine channel for this voice (voices use the same step device)
                const voiceChannel = voice.channel !== null 
                  ? voice.channel - 1 
                  : effectiveChannel;

                const playVoice = () => {
                  if (!isPlayingRef.current) return;
                  if (!effectiveDeviceId || !globalMidiOutput.isDeviceAvailable(effectiveDeviceId)) return;
                  globalMidiOutput.playNoteToDevice(
                    effectiveDeviceId,
                    voiceNoteName,
                    voiceOctave,
                    voice.velocity,
                    voiceChannel,
                    noteDuration,
                  );
                };

                // Apply voice delay
                if (voice.delay > 0) {
                  window.setTimeout(playVoice, voice.delay);
                } else {
                  playVoice();
                }
              });
            };

            if (totalDelayMs > 0) {
              window.setTimeout(playNote, totalDelayMs);
            } else {
              playNote();
            }

            // Record for export if recording is active - use quantized timing
            if (isRecordingExport) {
              // Calculate absolute step position across all bars (starts from 0)
              const absoluteStepPosition =
                barCount * stepsPerBar + stepsSinceLastBar;

              setRecordedBars((prev) => [
                ...prev,
                {
                  step: [row, col],
                  note,
                  octave,
                  velocity,
                  quantizedTicks: 0, // Will be calculated during export
                  stepPosition: absoluteStepPosition, // Use absolute position from start
                  barNumber: barCount,
                  quantizeValue: repeatValue,
                  delayMs,
                  delayEnabled,
                  swingAmount,
                },
              ]);
            }
            
            // If this is a restart step, trigger the jump based on restart mode
            if (stepState === "restart") {
              const actualDelay = delayEnabled ? delayMs : 0;
              const targetPos = startingStepRef.current;
              const currentRestartMode = restartModeRef.current;
              
              switch (currentRestartMode) {
                case "hybrid":
                  // Waits for delay before jumping
                  setTimeout(() => {
                    console.log(
                      `🔄 Hybrid restart after ${actualDelay}ms delay to [${targetPos[0]},${targetPos[1]}]`,
                    );
                    currentStepRef.current = targetPos;
                    setCurrentStep(targetPos);
                  }, actualDelay);
                  restartTriggered = true;
                  break;
                  
                case "immediate":
                  // Instant jump, ignores delay for restart timing
                  console.log(
                    `⚡ Immediate restart to [${targetPos[0]},${targetPos[1]}]`,
                  );
                  currentStepRef.current = targetPos;
                  setCurrentStep(targetPos);
                  restartTriggered = true;
                  break;
                  
                case "nextTick":
                  // Allows normal advancement, then restarts on next tick
                  console.log(
                    `⏭️ Next tick restart - will jump to [${targetPos[0]},${targetPos[1]}]`,
                  );
                  setTimeout(() => {
                    currentStepRef.current = targetPos;
                    setCurrentStep(targetPos);
                  }, 0);
                  // Don't set restartTriggered - let normal flow happen
                  break;
              }
            }
          } else if (stepState === "skip" && shouldTrigger) {
            console.log(
              `Skipping step [${row},${col}] (div:${clockDivider}, ${repeatValue})`,
            );
          } else if (stepState === "on" && shouldTrigger && !probabilityPass) {
            console.log(
              `Probability muted step [${row},${col}] (${probability}%)`,
            );
          }

        // Handle transport conditions (always check, regardless of trigger)
        if (!restartTriggered) {
          if (transport === "stop") {
            setIsPlaying(false);
          } else {
            const shouldAdvanceStep = advanceOnDividerRef.current
              ? clockDividerTrigger
              : true;

            const nextStep =
              transport === "jump"
                ? ([0, 0] as [number, number])
                : shouldAdvanceStep
                  ? getNextStepRef.current([row, col])
                  : ([row, col] as [number, number]);

            currentStepRef.current = nextStep;
            setCurrentStep(nextStep);

            if (shouldAdvanceStep) {
              // Track step count and bar completion
              setStepsSinceLastBar((prev) => {
                const newStepCount = prev + 1;

          // Check if we've completed a full bar (variable steps per bar)
          if (newStepCount >= stepsPerBar) {
            // Use requestAnimationFrame for smoother state transitions
            requestAnimationFrame(() => {
              // Apply pending root note change at bar boundary
              if (pendingRootChangeRef.current) {
                setSelectedRoot(pendingRootChangeRef.current);
                setPendingRootChange(null);
                console.log(
                  `Applied root note change: ${pendingRootChangeRef.current}`,
                );
              }

              // Start recording on bar boundary if waiting
              if (isWaitingForNextBar) {
                setIsWaitingForNextBar(false);
                setIsRecordingExport(true);
                setBarCount(0);
                setRecordedBars([]);
                console.log(
                  "🎵 Recording started at bar boundary - perfect timing guaranteed!",
                );
              }

              // Track bar completion for export
              if (isRecordingExport) {
                setBarCount((prev) => {
                  const newCount = prev + 1;
                  // Stop recording after 4 bars
                  if (newCount >= 4) {
                    // Use requestAnimationFrame for smooth export completion
                    requestAnimationFrame(() => {
                      setIsRecordingExport(false);
                      exportRecordingRef.current();
                    });
                  }
                  return newCount;
                });
              }
            });

              return 0; // Reset step counter
            }

                return newStepCount;
              });
            }
          }
        }
      }

      globalStepCounter++;
      nextTickTime += sixteenthNoteInterval;
      const delay = Math.max(0, nextTickTime - performance.now());
      timerId = window.setTimeout(tick, delay);
    };

    // Start immediately and schedule the next tick precisely
    timerId = window.setTimeout(tick, 0);

    return () => {
      cancelled = true;
      if (timerId !== null) {
        clearTimeout(timerId);
      }
    };
  }, [isPlaying, isStepRecording]);

  const parseQuantizeValue = (value: string) => {
    const match = value.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
    if (!match) return null;
    const numerator = Number(match[1]);
    const denominator = Number(match[2]);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
    if (numerator <= 0 || denominator <= 0) return null;
    return { numerator, denominator };
  };

  const getQuantizeDurationMs = (value: string, bpmValue: number) => {
    const parsed = parseQuantizeValue(value) || { numerator: 1, denominator: 16 };
    const beats = (4 * parsed.numerator) / parsed.denominator;
    return (60 / bpmValue) * 1000 * beats;
  };

  // Helper function to determine if a step should trigger based on quantization
  const shouldStepTrigger = (
    elapsedMs: number,
    quantizeValue: string,
    stepPosition: number,
    tickDurationMs: number,
    bpmValue: number,
  ): boolean => {
    const quantizeDurationMs = getQuantizeDurationMs(quantizeValue, bpmValue);
    const stepOffsetMs = stepPosition * tickDurationMs;
    const phase = (elapsedMs + stepOffsetMs) % quantizeDurationMs;
    return phase < tickDurationMs;
  };

  const handleDirectionDrag = (row: number, col: number, direction: string) => {
    if (!isPlaying) {
      setStepDirections((prev) => {
        const newDirections = [...prev];
        newDirections[row] = [...newDirections[row]];
        newDirections[row][col] = direction;
        return newDirections;
      });
      return;
    }
    pendingDirectionUpdates.current.set(`${row}-${col}`, direction);
  };

  const handleDirectionChange = (
    row: number,
    col: number,
    direction: string,
  ) => {
    if (!isPlaying) {
      setStepDirections((prev) => {
        const newDirections = [...prev];
        newDirections[row] = [...newDirections[row]];
        newDirections[row][col] = direction;
        return newDirections;
      });
      return;
    }
    pendingDirectionUpdates.current.set(`${row}-${col}`, direction);
  };

  const handleVelocityDrag = (row: number, col: number, velocity: number) => {
    if (!isPlaying) {
      setStepVelocities((prev) => {
        const newVelocities = [...prev];
        newVelocities[row] = [...newVelocities[row]];
        newVelocities[row][col] = velocity;
        return newVelocities;
      });
      return;
    }
    pendingVelocityUpdates.current.set(`${row}-${col}`, velocity);
  };

  function handleNoteChange(row: number, col: number, note: string) {
    setStepNotes((prev) => {
      const newNotes = [...prev];
      newNotes[row] = [...newNotes[row]];
      newNotes[row][col] = note;
      return newNotes;
    });
  }

  function handleOctaveChange(row: number, col: number, octave: number) {
    setStepOctaves((prev) => {
      const newOctaves = [...prev];
      newOctaves[row] = [...newOctaves[row]];
      newOctaves[row][col] = octave;
      return newOctaves;
    });
  }

  const handleProbabilityChange = (
    row: number,
    col: number,
    probability: number,
  ) => {
    setStepProbabilities((prev) => {
      const newProbs = [...prev];
      newProbs[row] = [...newProbs[row]];
      newProbs[row][col] = Math.max(0, Math.min(100, probability));
      return newProbs;
    });
  };

  const handleStepDelayMsChange = (
    row: number,
    col: number,
    delayMs: number,
  ) => {
    // Queue delay change for quantized application on next tick
    const key = `${row}-${col}`;
    const clampedDelay = Math.max(0, Math.min(500, delayMs));
    pendingDelayMsUpdates.current.set(key, clampedDelay);
  };

  const handleStepDelayEnabledChange = (
    row: number,
    col: number,
    enabled: boolean,
  ) => {
    // Queue delay enabled change for quantized application on next tick
    const key = `${row}-${col}`;
    pendingDelayEnabledUpdates.current.set(key, enabled);
  };

  const handleRepeatChange = (
    row: number,
    col: number,
    repeatValue: string,
  ) => {
    setStepRepeats((prev) => {
      const newRepeats = [...prev];
      newRepeats[row] = [...newRepeats[row]];
      newRepeats[row][col] = repeatValue;
      return newRepeats;
    });
  };

  const handleClockDividerChange = (
    row: number,
    col: number,
    divider: number,
  ) => {
    setStepClockDividers((prev) => {
      const newDividers = [...prev];
      newDividers[row] = [...newDividers[row]];
      newDividers[row][col] = divider;
      return newDividers;
    });

    // Reset the clock counter for this step when divider changes
    setStepClockCounters((prev) => {
      const newCounters = [...prev];
      newCounters[row] = [...newCounters[row]];
      newCounters[row][col] = 0;
      return newCounters;
    });

    // Auto-enable clock divider when user selects a divider value other than 1
    if (divider > 1 && !advanceOnDivider) {
      setAdvanceOnDivider(true);
    }
  };

  // Handler for per-step MIDI device change
  const handleStepMidiDeviceChange = (row: number, col: number, deviceId: string | null) => {
    setStepMidiDevices((prev) => {
      const newDevices = prev.map(r => [...r]);
      newDevices[row][col] = deviceId;
      return newDevices;
    });
  };

  // Handler for per-step MIDI channel change
  const handleStepMidiChannelChange = (row: number, col: number, channel: number | null) => {
    setStepMidiChannels((prev) => {
      const newChannels = prev.map(r => [...r]);
      newChannels[row][col] = channel;
      return newChannels;
    });
  };

  // Handler for per-step CC config change
  const handleStepCCConfigChange = (row: number, col: number, config: StepCCConfig) => {
    setStepCCConfigs((prev) => {
      const newConfigs = prev.map(r => [...r]);
      newConfigs[row][col] = config;
      return newConfigs;
    });
  };

  // Handler for per-step chord config change
  const handleStepChordConfigChange = (row: number, col: number, config: StepChordConfig) => {
    setStepChordConfigs((prev) => {
      const newConfigs = prev.map(r => [...r]);
      newConfigs[row][col] = config;
      return newConfigs;
    });
  };

  const handleStepsPerBarChange = (steps: number) => {
    setStepsPerBar(steps);
    // Reset step counter when changing steps per bar
    setStepsSinceLastBar(0);
  };

  const handleCustomStepsPerBarChange = (steps: number) => {
    setCustomStepsPerBar(steps);
    setStepsPerBar(steps);
    setStepsSinceLastBar(0);
  };

  // Calculate repeat timing based on note value
  const getRepeatTiming = (repeatValue: string, baseBpm: number) => {
    const parsed = parseQuantizeValue(repeatValue) || {
      numerator: 1,
      denominator: 16,
    };
    const beats = (4 * parsed.numerator) / parsed.denominator;
    return (60 / baseBpm) * beats * 1000; // Convert to milliseconds
  };

  // Keyboard input handler with spacebar controls and root note changes
  useEffect(() => {
    // Keyboard to note mapping (QWERTY keyboard as MIDI input)
    const keyToNote: Record<string, string> = {
      a: "C",
      w: "C#",
      s: "D",
      e: "D#",
      d: "E",
      f: "F",
      t: "F#",
      g: "G",
      y: "G#",
      h: "A",
      u: "A#",
      j: "B",
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Spacebar controls for play/stop
      if (e.code === "Space") {
        e.preventDefault();
        if (!isPlaying) {
          // First spacebar: start playing from top left
          setCurrentStep([0, 0]);
          setStepsSinceLastBar(0);
          setIsPlaying(true);
        } else {
          // Second spacebar: stop sequencer
          setIsPlaying(false);
        }
        return;
      }

      // Prevent default for our handled keys
      if (
        keyToNote[e.key.toLowerCase()] ||
        e.key.toLowerCase() === "z" ||
        e.key.toLowerCase() === "x"
      ) {
        e.preventDefault();
      }

      // Handle octave changes
      if (e.key.toLowerCase() === "z") {
        setCurrentOctave((prev) => Math.max(1, prev - 1)); // Z = lower octave
        return;
      }
      if (e.key.toLowerCase() === "x") {
        setCurrentOctave((prev) => Math.min(8, prev + 1)); // X = raise octave
        return;
      }

      // Handle note input
      const note = keyToNote[e.key.toLowerCase()];
      if (note) {
        // If step recording is ON and cell is hovered, record to that cell
        if (isStepRecording && hoveredCell) {
          const [row, col] = hoveredCell;
          currentRecordingStepRef.current = [row, col];
          setCurrentRecordingStep([row, col]);
          handleMidiNoteInput(note, currentOctave, 100);
        }
        // NEW RULE: If step recording is ON and NO cell is hovered, override step recording and use for transpose
        else if (isStepRecording && !hoveredCell) {
          handleMidiNoteInput(note, currentOctave, 100);
        }
        // If step recording is OFF and no cell is hovered, change root note (quantized to next bar)
        else if (!isStepRecording && !hoveredCell) {
          setPendingRootChange(note);
          console.log(
            `Root note change queued: ${note} (will apply at next bar)`,
          );
        }
        // If cell is hovered but step recording is off, still edit the hovered cell
        else if (hoveredCell) {
          const [row, col] = hoveredCell;
          handleNoteChange(row, col, note);
          handleOctaveChange(row, col, currentOctave);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    hoveredCell,
    currentOctave,
    isPlaying,
    isStepRecording,
    handleNoteChange,
    handleOctaveChange,
  ]);

  const handleCellHover = (row: number, col: number) => {
    setHoveredCell([row, col]);
  };

  const handleCellLeave = () => {
    setHoveredCell(null);
  };

  const handleStepClick = (
    row: number,
    col: number,
    clickType: "main" | "direction" | "state" | "transport",
  ) => {
    if (clickType === "state") {
      // Cycle through states: on -> restart -> skip -> on
      const states = ["on", "restart", "skip"];
      const currentState = stepStates[row][col];
      const currentIndex = states.indexOf(currentState);
      const nextIndex = (currentIndex + 1) % states.length;

      setStepStates((prev) => {
        const newStates = [...prev];
        newStates[row] = [...newStates[row]];
        newStates[row][col] = states[nextIndex];
        return newStates;
      });
    } else if (clickType === "transport") {
      // Cycle through transports: continue -> stop -> jump -> continue
      const transports = ["continue", "stop", "jump"];
      const currentTransport = stepTransports[row][col];
      const currentIndex = transports.indexOf(currentTransport);
      const nextIndex = (currentIndex + 1) % transports.length;

      setStepTransports((prev) => {
        const newTransports = [...prev];
        newTransports[row] = [...newTransports[row]];
        newTransports[row][col] = transports[nextIndex];
        return newTransports;
      });
    } else {
      // Main cell click - jump to this cell and start/continue playing
      if (isPlaying) {
        // Queue the jump for quantized application on next tick
        pendingJumpRef.current = [row, col];
        console.log(`🎯 Queued quantized jump to step [${row},${col}]`);
      } else {
        // Not playing - jump immediately and start
        setCurrentStep([row, col]);
        currentStepRef.current = [row, col];
        startingStepRef.current = [row, col]; // Remember new starting position
        setIsPlaying(true);
      }
    }
  };

  const handlePlay = () => {
    startingStepRef.current = currentStepRef.current; // Remember where we started
    setIsPlaying(true);
  };

  const handlePause = () => setIsPlaying(false);

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentStep([0, 0]);
    startingStepRef.current = [0, 0]; // Reset starting position
  };

  // Scale application function
  const applyScale = useCallback(() => {
    console.log(
      "🎵 Applying scale:",
      selectedRoot,
      selectedScale,
      "starting at octave",
      globalOctave,
    );

    const scaleNotes = generateScale(selectedRoot, selectedScale, globalOctave);
    console.log("Generated scale notes:", scaleNotes);

    const { notes, octaves } = scaleToGrid(scaleNotes);
    console.log("Grid notes:", notes);
    console.log("Grid octaves:", octaves);

    setStepNotes(notes);
    setStepOctaves(octaves);

    console.log("✅ Scale applied to grid successfully");
  }, [selectedRoot, selectedScale, globalOctave]);

  // Auto-apply scale when root or scale type changes (only when not playing)
  useEffect(() => {
    if (!isPlaying) {
      applyScale();
    }
  }, [applyScale, isPlaying]);

  // Handle microtuning changes
  const handleMicrotuningChange = useCallback((preset: MicrotuningPreset) => {
    setCurrentMicrotuning(preset);
  }, []);

  // Handle step recording toggle
  const handleToggleStepRecording = useCallback(
    (enabled: boolean) => {
      setIsStepRecording(enabled);
      if (enabled && !isPlaying) {
        // Start recording from current step if not playing
        setCurrentRecordingStep(currentStep);
      }
    },
    [isPlaying, currentStep],
  );

  // Handle click on grid cell to set recording start position
  const handleRecordingStepClick = useCallback(
    (row: number, col: number) => {
      if (isStepRecording) {
        setCurrentRecordingStep([row, col]);
        currentRecordingStepRef.current = [row, col];
        console.log(`Recording position set to [${row}, ${col}]`);
      }
    },
    [isStepRecording],
  );

  useEffect(() => {
    if (isStepRecording) {
      globalMidiManager.setNoteCallback((note, octave, velocity) => {
        handleMidiNoteInput(note, octave, velocity);
      });
    } else {
      globalMidiManager.clearNoteCallback();
    }

    return () => {
      globalMidiManager.clearNoteCallback();
    };
  }, [isStepRecording, handleMidiNoteInput]);

  // Handle MIDI note input during step recording
  function handleMidiNoteInput(note: string, octave: number, velocity: number) {
    if (!isStepRecording) return;

    const adjustedVelocity = Math.max(64, Math.min(127, velocity));

    // Always queue and apply on the next clock tick
    pendingStepRecordingRef.current = {
      note,
      octave,
      velocity: adjustedVelocity,
    };
  }

  // Start export recording - waits for nearest bar boundary for perfect timing
  const handleStartExport = useCallback(() => {
    // Prevent overlapping recording operations
    if (isRecordingTransition || isRecordingExport) return;

    setIsRecordingTransition(true);

    // If we're at the start of a bar (step 0), start recording immediately
    if (stepsSinceLastBar === 0 && isPlaying) {
      // Use requestAnimationFrame for smoother timing
      requestAnimationFrame(() => {
        setRecordedBars([]);
        setBarCount(0);
        setIsRecordingExport(true);
        setIsWaitingForNextBar(false);
        setIsRecordingTransition(false);
        console.log(
          "🎵 Recording started immediately - already at bar boundary!",
        );
      });
    } else {
      // Otherwise, wait for the next bar boundary
      setIsWaitingForNextBar(true);
      setIsRecordingTransition(false);
      console.log(
        `🎵 Waiting for next bar boundary... (${stepsPerBar - stepsSinceLastBar} steps remaining)`,
      );

      // Start playing if not already playing
      if (!isPlaying) {
        setCurrentStep([0, 0]);
        setStepsSinceLastBar(0);
        setIsPlaying(true);
        // Since we're starting from step 0, start recording immediately after playback starts
        requestAnimationFrame(() => {
          setRecordedBars([]);
          setBarCount(0);
          setIsRecordingExport(true);
          setIsWaitingForNextBar(false);
          console.log("🎵 Started from beginning - recording immediately!");
        });
      }
    }
  }, [
    isPlaying,
    stepsSinceLastBar,
    stepsPerBar,
    isRecordingTransition,
    isRecordingExport,
  ]);

  // Stop export recording
  const handleStopExport = useCallback(() => {
    // Use requestAnimationFrame for smooth stop transition
    requestAnimationFrame(() => {
      setIsRecordingExport(false);
      setIsWaitingForNextBar(false); // Cancel waiting state
      if (recordedBars.length > 0) {
        requestAnimationFrame(() => {
          exportRecording();
        });
      }
    });
  }, [recordedBars, exportRecording]);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1>Interactive Audio Step Sequencer</h1>
          <div className="mt-1 font-mono text-xs text-muted-foreground/70 tracking-wider">
            <span className="text-green-600 dark:text-green-400">;</span> AUTHOR
            <span className="text-green-600 dark:text-green-400">:</span>{" "}
            <span className="text-cyan-600 dark:text-cyan-400">Nova_Seq</span>
            <span className="text-yellow-600 dark:text-yellow-400">/</span>
            <span className="text-cyan-600 dark:text-cyan-400">TLV</span>
          </div>
          <p className="text-muted-foreground mt-2">
            A 4x4 step sequencer with per-cell state control, transport
            commands, directional flow, audio synthesis, per-step MIDI device/channel
            routing, 4 CC knobs with velocity/pitch modulation, and 8-voice chord editor.
          </p>
        </header>

        <div
          className="flex gap-6 items-start justify-center"
          style={{
            display: "flex",
            gap: "1.5rem",
            alignItems: "flex-start",
            justifyContent: "center",
            flexWrap: "nowrap",
          }}
        >
          {/* Left: Sequencer Grid + Step Info */}
          <div
            className="flex flex-col items-center flex-shrink-0"
            style={{ minWidth: "400px" }}
          >
            {/* Main Grid */}
            <SequencerGrid
              stepStates={stepStates}
              stepDirections={stepDirections}
              stepTransports={stepTransports}
              stepVelocities={stepVelocities}
              stepNotes={stepNotes}
              stepOctaves={stepOctaves}
              stepProbabilities={stepProbabilities}
              stepRepeats={stepRepeats}
              stepClockDividers={stepClockDividers}
              stepDelayMs={stepDelayMs}
              stepDelayEnabled={stepDelayEnabled}
              stepMidiDevices={stepMidiDevices}
              stepMidiChannels={stepMidiChannels}
              stepCCConfigs={stepCCConfigs}
              stepChordConfigs={stepChordConfigs}
              currentStep={currentStep}
              hoveredCell={hoveredCell}
              isPlaying={isPlaying}
              midiValue={midiValue}
              isStepRecording={isStepRecording}
              currentRecordingStep={currentRecordingStep}
              onStepClick={handleStepClick}
              onRecordingStepClick={handleRecordingStepClick}
              onDirectionDrag={handleDirectionDrag}
              onVelocityDrag={handleVelocityDrag}
              onNoteChange={handleNoteChange}
              onOctaveChange={handleOctaveChange}
              onProbabilityChange={handleProbabilityChange}
              onRepeatChange={handleRepeatChange}
              onClockDividerChange={handleClockDividerChange}
              onDelayMsChange={handleStepDelayMsChange}
              onDelayEnabledChange={handleStepDelayEnabledChange}
              onStepMidiDeviceChange={handleStepMidiDeviceChange}
              onStepMidiChannelChange={handleStepMidiChannelChange}
              onStepCCConfigChange={handleStepCCConfigChange}
              onStepChordConfigChange={handleStepChordConfigChange}
              availableMidiOutputs={availableMidiOutputs}
              globalMidiOutputName={globalMidiOutput.getSelectedOutput()?.name || null}
              globalMidiChannel={midiOutputChannel}
              bpm={bpm}
              onCellHover={handleCellHover}
              onCellLeave={handleCellLeave}
            />

            {/* Step Info */}
            <div className="mt-4 text-center">
              <div className="text-sm text-muted-foreground">
                Current Step:{" "}
                <span className="font-mono">
                  [{currentStep[0] + 1}, {currentStep[1] + 1}]
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                Current Direction:{" "}
                <span className="font-mono">
                  {stepDirections[currentStep[0]][currentStep[1]]}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                State:{" "}
                <span className="font-mono">
                  {stepStates[currentStep[0]][currentStep[1]]}
                </span>{" "}
                | Transport:{" "}
                <span className="font-mono">
                  {stepTransports[currentStep[0]][currentStep[1]]}
                </span>{" "}
                | Velocity:{" "}
                <span className="font-mono">
                  {stepVelocities[currentStep[0]][currentStep[1]]}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                Note:{" "}
                <span className="font-mono">
                  {stepNotes[currentStep[0]][currentStep[1]]}
                  {stepOctaves[currentStep[0]][currentStep[1]]}
                </span>{" "}
                | Probability:{" "}
                <span className="font-mono">
                  {stepProbabilities[currentStep[0]][currentStep[1]]}%
                </span>{" "}
                | Quantize:{" "}
                <span className="font-mono">
                  {stepRepeats[currentStep[0]][currentStep[1]]}
                </span>{" "}
                | Clock Div:{" "}
                <span className="font-mono">
                  ÷{stepClockDividers[currentStep[0]][currentStep[1]]}
                </span>
              </div>
              {isWaitingForNextBar && (
                <div className="text-sm text-orange-600 dark:text-orange-400">
                  ⏳ Waiting for next bar boundary... (
                  {stepsPerBar - stepsSinceLastBar} steps remaining)
                </div>
              )}
              {isRecordingExport && (
                <div className="text-sm text-red-600 dark:text-red-400">
                  🔴 Recording Export - Bar {barCount}/4 ({recordedBars.length}{" "}
                  steps recorded) - Perfect Timing!
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                Current Scale:{" "}
                <span className="font-mono">
                  {selectedRoot}{" "}
                  {selectedScale.charAt(0).toUpperCase() +
                    selectedScale.slice(1).replace("-", " ")}{" "}
                  (Oct {globalOctave})
                </span>
                {pendingRootChange && (
                  <span className="ml-2 text-orange-600 dark:text-orange-400">
                    → {pendingRootChange} (pending next bar)
                  </span>
                )}
              </div>
              {currentMicrotuning && (
                <div className="text-sm text-muted-foreground">
                  Microtuning:{" "}
                  <span className="font-mono">{currentMicrotuning.name}</span>
                </div>
              )}
              <div className="text-sm text-muted-foreground">
                Hovered Cell:{" "}
                <span className="font-mono">
                  {hoveredCell
                    ? `[${hoveredCell[0] + 1}, ${hoveredCell[1] + 1}]`
                    : "None"}
                </span>{" "}
                | Keyboard Octave:{" "}
                <span className="font-mono">{currentOctave}</span> |
                <kbd className="px-1 py-0.5 bg-muted rounded text-xs">
                  SPACE
                </kbd>{" "}
                = Play/Stop
              </div>
              <div className="text-sm text-muted-foreground">
                Steps:{" "}
                <span className="font-mono">
                  {stepsSinceLastBar}/{stepsPerBar}
                </span>{" "}
                | Combine Mode:{" "}
                <span className="font-mono">{quantizeCombineMode}</span> | A-J Keys:{" "}
                {isStepRecording
                  ? hoveredCell
                    ? "Record to hovered cell"
                    : "Transpose root note (override)"
                  : hoveredCell
                    ? "Edit hovered cell"
                    : "Change root note (quantized)"}
              </div>
              {isStepRecording && (
                <div className="text-sm text-muted-foreground">
                  Recording Position:{" "}
                  <span className="font-mono bg-red-100 dark:bg-red-900/30 px-1 rounded">
                    [{currentRecordingStep[0] + 1},{" "}
                    {currentRecordingStep[1] + 1}]
                  </span>
                  <span className="text-red-600 dark:text-red-400 ml-2">
                    ● REC
                  </span>
                </div>
              )}
            </div>

            {/* MIDI Panic Button — kills all stuck notes immediately */}
            <div className="mt-2 flex justify-center">
              <button
                onClick={() => {
                  globalMidiOutput.stopAllNotes();
                  globalSynth.stopAllNotes();
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold rounded-lg text-sm shadow-md transition-colors"
                title="Stop all MIDI notes immediately (panic)"
              >
                ■ MIDI PANIC
              </button>
            </div>

            {/* Randomization Controls */}
            <div className="mt-6">
              <RandomizationControls
                stepDirections={stepDirections}
                stepNotes={stepNotes}
                stepOctaves={stepOctaves}
                onDirectionChange={handleDirectionChange}
                onNoteChange={handleNoteChange}
                onOctaveChange={handleOctaveChange}
                isPlaying={isPlaying}
              />
            </div>
          </div>

          {/* Right: All Control Modules (scrollable stack) */}
          <div
            className="flex flex-col gap-4 overflow-y-auto"
            style={{ maxHeight: "calc(100vh - 8rem)" }}
          >
            <ScaleControls
              currentScale={selectedScale}
              currentRoot={selectedRoot}
              globalOctave={globalOctave}
              onScaleChange={setSelectedScale}
              onRootChange={setSelectedRoot}
              onGlobalOctaveChange={setGlobalOctave}
              onApplyScale={applyScale}
            />

            <MidiControls
              midiValue={midiValue}
              isPlaying={isPlaying}
              bpm={bpm}
              swingValue={globalSwing}
              swingTightness={swingTightness}
              onMidiChange={setMidiValue}
              onPlay={handlePlay}
              onPause={handlePause}
              onStop={handleStop}
              onBpmChange={setBpm}
              onSwingChange={setGlobalSwing}
              onSwingTightnessChange={setSwingTightness}
              isRecordingExport={isRecordingExport}
              isWaitingForNextBar={isWaitingForNextBar}
              onStartExport={handleStartExport}
              onStopExport={handleStopExport}
              restartMode={restartMode}
              onRestartModeChange={setRestartMode}
            />

            <EuclideanControls
              stepsPerBar={stepsPerBar}
              customStepsPerBar={customStepsPerBar}
              quantizeCombineMode={quantizeCombineMode}
              advanceOnDivider={advanceOnDivider}
              onStepsPerBarChange={handleStepsPerBarChange}
              onCustomStepsPerBarChange={handleCustomStepsPerBarChange}
              onQuantizeCombineModeChange={setQuantizeCombineMode}
              onAdvanceOnDividerChange={setAdvanceOnDivider}
            />

            <MidiOutputControls
              isSequencerPlaying={isPlaying}
              bpm={bpm}
              onBpmChange={setBpm}
              midiChannel={midiOutputChannel}
              onMidiChannelChange={setMidiOutputChannel}
            />

            <AudioPreview
              isSequencerPlaying={isPlaying}
              currentStep={currentStep}
              stepStates={stepStates}
              stepNotes={stepNotes}
              stepOctaves={stepOctaves}
              stepVelocities={stepVelocities}
              stepProbabilities={stepProbabilities}
              stepDelayMs={stepDelayMs}
              stepDelayEnabled={stepDelayEnabled}
              bpm={bpm}
            />

            <MicrotuningControls
              onMicrotuningChange={handleMicrotuningChange}
            />

            <KeyboardStepRecorder
              isRecording={isStepRecording}
              currentRecordingStep={currentRecordingStep}
              onToggleRecording={handleToggleStepRecording}
              onNoteInput={handleMidiNoteInput}
              stepStates={stepStates}
              stepNotes={stepNotes}
              stepOctaves={stepOctaves}
              hoveredCell={hoveredCell}
              currentOctave={currentOctave}
              isPlaying={isPlaying}
              midiStatus={midiInputStatus}
              availableMidiInputs={availableMidiInputs}
              selectedMidiInputId={selectedMidiInputId}
              onMidiInputChange={setSelectedMidiInputId}
              midiInputChannel={midiInputChannel}
              onMidiInputChannelChange={setMidiInputChannel}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
