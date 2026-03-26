import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpLeft,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowDownRight,
  Play,
  Square,
  RotateCcw,
  Settings2,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "./ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { StepMidiSettings } from "./step-midi-settings";
import { StepChordEditor, type StepChordConfig, createDefaultChordConfig } from "./step-chord-editor";
import { type StepCCConfig, createDefaultCCConfig } from "../utils/cc-modulation";

interface MidiDevice {
  id: string;
  name: string;
}

interface SequencerGridProps {
  stepStates: string[][];
  stepDirections: string[][];
  stepTransports: string[][];
  stepVelocities: number[][];
  stepNotes: string[][];
  stepOctaves: number[][];
  stepProbabilities: number[][];
  stepRepeats: string[][];
  stepClockDividers: number[][];
  stepDelayMs: number[][];
  stepDelayEnabled: boolean[][];
  stepMidiDevices: (string | null)[][];
  stepMidiChannels: (number | null)[][];
  stepCCConfigs: StepCCConfig[][];
  stepChordConfigs: StepChordConfig[][];
  currentStep: [number, number];
  hoveredCell: [number, number] | null;
  isPlaying: boolean;
  midiValue: number;
  isStepRecording?: boolean;
  currentRecordingStep?: [number, number];
  onStepClick: (
    row: number,
    col: number,
    clickType: "main" | "direction" | "state" | "transport",
  ) => void;
  onRecordingStepClick?: (row: number, col: number) => void;
  onDirectionDrag: (row: number, col: number, direction: string) => void;
  onVelocityDrag: (row: number, col: number, velocity: number) => void;
  onNoteChange: (row: number, col: number, note: string) => void;
  onOctaveChange: (row: number, col: number, octave: number) => void;
  onProbabilityChange: (row: number, col: number, probability: number) => void;
  onRepeatChange: (row: number, col: number, repeats: string) => void;
  onClockDividerChange: (row: number, col: number, divider: number) => void;
  onDelayMsChange: (row: number, col: number, delayMs: number) => void;
  onDelayEnabledChange: (row: number, col: number, enabled: boolean) => void;
  onStepMidiDeviceChange: (row: number, col: number, deviceId: string | null) => void;
  onStepMidiChannelChange: (row: number, col: number, channel: number | null) => void;
  onStepCCConfigChange: (row: number, col: number, config: StepCCConfig) => void;
  onStepChordConfigChange: (row: number, col: number, config: StepChordConfig) => void;
  availableMidiOutputs: MidiDevice[];
  globalMidiOutputName: string | null;
  globalMidiChannel: number;
  bpm: number;
  onCellHover: (row: number, col: number) => void;
  onCellLeave: () => void;
}

export function SequencerGrid({
  stepStates,
  stepDirections,
  stepTransports,
  stepVelocities,
  stepNotes,
  stepOctaves,
  stepProbabilities,
  stepRepeats,
  stepClockDividers,
  stepDelayMs,
  stepDelayEnabled,
  stepMidiDevices,
  stepMidiChannels,
  stepCCConfigs,
  stepChordConfigs,
  currentStep,
  hoveredCell,
  isPlaying,
  midiValue,
  isStepRecording = false,
  currentRecordingStep,
  onStepClick,
  onRecordingStepClick,
  onDirectionDrag,
  onVelocityDrag,
  onNoteChange,
  onOctaveChange,
  onProbabilityChange,
  onRepeatChange,
  onClockDividerChange,
  onDelayMsChange,
  onDelayEnabledChange,
  onStepMidiDeviceChange,
  onStepMidiChannelChange,
  onStepCCConfigChange,
  onStepChordConfigChange,
  availableMidiOutputs,
  globalMidiOutputName,
  globalMidiChannel,
  bpm,
  onCellHover,
  onCellLeave,
}: SequencerGridProps) {
  const [isDragging, setIsDragging] = useState<{
    row: number;
    col: number;
    type: "direction" | "velocity";
  } | null>(null);
  
  // Dialog state for advanced step settings
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);
  const [advancedSettingsStep, setAdvancedSettingsStep] = useState<[number, number] | null>(null);
  
  const hasDraggedRef = useRef(false); // Track if actual dragging (mouse movement) occurred
  const cellRefs = useRef<(HTMLDivElement | null)[][]>([]);
  const pendingDirectionRef = useRef<string | null>(null);
  const pendingVelocityRef = useRef<number | null>(null);
  const pendingCellRef = useRef<{ row: number; col: number } | null>(null);

  // Initialize refs array
  if (cellRefs.current.length !== stepStates.length) {
    cellRefs.current = stepStates.map(() =>
      Array(stepStates[0].length).fill(null),
    );
  }
  const getStepColor = (
    state: string,
    isCurrent: boolean,
    isHovered: boolean,
  ) => {
    if (isCurrent && isPlaying) {
      return "border-blue-600";
    }

    if (isHovered) {
      return "border-green-500 border-4";
    }

    if (state === "skip") {
      return "border-yellow-400";
    }

    return "border-gray-300";
  };

  const getStepStyle = (
    state: string,
    velocity: number,
    isCurrent: boolean,
  ) => {
    if (isCurrent && isPlaying) {
      // Blue overlay for current playing step
      return {
        background:
          "linear-gradient(to top, rgba(59, 130, 246, 0.3), rgba(59, 130, 246, 0.5))",
      };
    }

    if (state === "skip") {
      return {
        background:
          "linear-gradient(to top, rgba(255, 255, 0, 0.2), rgba(255, 255, 0, 0.4))",
      };
    }

    if (state === "on") {
      // Velocity gradient from white (bottom) to red (top)
      // velocity 64 = mid point (light red), 127 = full red
      const normalizedVelocity = (velocity - 64) / (127 - 64); // 0-1 range
      const intensity = Math.max(0, normalizedVelocity);
      return {
        background: `linear-gradient(to top, rgba(255, 255, 255, 0.8), rgba(255, ${Math.round(255 * (1 - intensity))}, ${Math.round(255 * (1 - intensity))}, 0.9))`,
      };
    }

    // Off state - transparent
    return {
      backgroundColor: "transparent",
    };
  };

  const getDirectionIcon = (direction: string) => {
    const iconMap: Record<string, React.ComponentType<any>> = {
      up: ChevronUp,
      down: ChevronDown,
      left: ChevronLeft,
      right: ChevronRight,
      "up-left": ArrowUpLeft,
      "up-right": ArrowUpRight,
      "down-left": ArrowDownLeft,
      "down-right": ArrowDownRight,
    };
    return iconMap[direction] || ChevronRight;
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case "on":
        return "bg-green-600 text-white";
      case "off":
        return "bg-gray-600 text-white";
      case "skip":
        return "bg-yellow-600 text-white";
      default:
        return "bg-gray-600 text-white";
    }
  };

  const getTransportIcon = (transport: string) => {
    switch (transport) {
      case "continue":
        return Play;
      case "stop":
        return Square;
      case "jump":
        return RotateCcw;
      default:
        return Play;
    }
  };

  const getTransportColor = (transport: string) => {
    switch (transport) {
      case "continue":
        return "bg-blue-600 text-white";
      case "stop":
        return "bg-red-600 text-white";
      case "jump":
        return "bg-purple-600 text-white";
      default:
        return "bg-blue-600 text-white";
    }
  };

  // Helper to get chord display name
  const getChordDisplay = (chordConfig: StepChordConfig, defaultNote: string, defaultOctave: number) => {
    const enabledVoices = chordConfig.voices.filter(v => v.enabled);
    if (enabledVoices.length === 0) {
      return null; // No chord active
    }
    
    // Get unique semitone offsets sorted
    const offsets = [...new Set(enabledVoices.map(v => v.semitoneOffset))].sort((a, b) => a - b);
    
    // Try to match to a known chord
    const offsetStr = offsets.join(',');
    const chordName = (() => {
      if (offsetStr === '0,4,7') return 'Maj';
      if (offsetStr === '0,3,7') return 'min';
      if (offsetStr === '0,3,6') return 'dim';
      if (offsetStr === '0,4,8') return 'aug';
      if (offsetStr === '0,2,7') return 'sus2';
      if (offsetStr === '0,5,7') return 'sus4';
      if (offsetStr === '0,4,7,10') return '7';
      if (offsetStr === '0,4,7,11') return 'Maj7';
      if (offsetStr === '0,3,7,10') return 'min7';
      if (offsetStr === '0,3,6,9') return 'dim7';
      if (offsetStr === '0,4,7,10,14') return '9';
      if (offsetStr === '0,4,7,14') return 'add9';
      if (offsetStr === '0,4,7,9') return '6';
      if (offsetStr === '0,3,7,9') return 'min6';
      return `[${offsets.length}]`; // Show number of voices for custom chords
    })();
    
    return `${chordConfig.rootNote}${chordName}`;
  };

  const calculateDirection = (
    mouseX: number,
    mouseY: number,
    cellRect: DOMRect,
  ) => {
    const centerX = cellRect.left + cellRect.width / 2;
    const centerY = cellRect.top + cellRect.height / 2;

    const deltaX = mouseX - centerX;
    const deltaY = mouseY - centerY;

    // Calculate angle in degrees
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

    // Normalize to 0-360
    const normalizedAngle = (angle + 360) % 360;

    // Map angle to direction (8 directions, 45 degrees each)
    if (normalizedAngle >= 337.5 || normalizedAngle < 22.5) return "right";
    if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) return "down-right";
    if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) return "down";
    if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) return "down-left";
    if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) return "left";
    if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) return "up-left";
    if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) return "up";
    if (normalizedAngle >= 292.5 && normalizedAngle < 337.5) return "up-right";

    return "right"; // fallback
  };

  const getNextClockwiseDirection = (currentDirection: string) => {
    const clockwiseOrder = [
      "right",
      "down-right",
      "down",
      "down-left",
      "left",
      "up-left",
      "up",
      "up-right",
    ];
    const currentIndex = clockwiseOrder.indexOf(currentDirection);
    const nextIndex = (currentIndex + 1) % clockwiseOrder.length;
    return clockwiseOrder[nextIndex];
  };

  const handleMouseDown = (
    e: React.MouseEvent,
    row: number,
    col: number,
    type: "direction" | "velocity",
  ) => {
    e.preventDefault();
    hasDraggedRef.current = false; // Reset drag tracking on new mousedown
    pendingCellRef.current = { row, col };
    if (type === "direction") {
      pendingDirectionRef.current = stepDirections[row][col];
    } else {
      pendingVelocityRef.current = stepVelocities[row][col];
    }
    setIsDragging({ row, col, type });
  };

  const calculateVelocity = (mouseY: number, cellRect: DOMRect) => {
    const relativeY = mouseY - cellRect.top;
    const cellHeight = cellRect.height;

    // Invert Y so bottom = 64, top = 127
    const normalizedY = 1 - relativeY / cellHeight;
    const velocity = Math.round(64 + normalizedY * (127 - 64));

    // Clamp between 64-127
    return Math.max(64, Math.min(127, velocity));
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    hasDraggedRef.current = true; // Mark that actual dragging occurred
    
    const { row, col, type } = isDragging;
    const cellRef = cellRefs.current[row]?.[col];
    if (!cellRef) return;

    const rect = cellRef.getBoundingClientRect();

    // Store pending values without triggering state updates
    // This prevents MIDI timing interference during drag
    if (type === "direction") {
      const direction = calculateDirection(e.clientX, e.clientY, rect);
      pendingDirectionRef.current = direction;
      pendingCellRef.current = { row, col };
    } else if (type === "velocity") {
      const velocity = calculateVelocity(e.clientY, rect);
      pendingVelocityRef.current = velocity;
      pendingCellRef.current = { row, col };
    }
  };

  const applyPendingChanges = useCallback(() => {
    // Apply pending changes only when drag ends (quantized update)
    // This keeps MIDI timing in sync and prevents stuttering
    if (isDragging && pendingCellRef.current) {
      const { row, col } = pendingCellRef.current;

      if (isDragging.type === "direction" && pendingDirectionRef.current) {
        if (pendingDirectionRef.current !== stepDirections[row][col]) {
          onDirectionDrag(row, col, pendingDirectionRef.current);
        }
      } else if (
        isDragging.type === "velocity" &&
        pendingVelocityRef.current !== null
      ) {
        if (pendingVelocityRef.current !== stepVelocities[row][col]) {
          onVelocityDrag(row, col, pendingVelocityRef.current);
        }
      }
    }

    // Clear pending values and drag state
    setIsDragging(null);
    pendingDirectionRef.current = null;
    pendingVelocityRef.current = null;
    pendingCellRef.current = null;
  }, [
    isDragging,
    onDirectionDrag,
    onVelocityDrag,
    stepDirections,
    stepVelocities,
  ]);

  const handleMouseUp = () => {
    applyPendingChanges();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleWindowMouseUp = () => {
      applyPendingChanges();
    };

    window.addEventListener("mouseup", handleWindowMouseUp);
    window.addEventListener("blur", handleWindowMouseUp);

    return () => {
      window.removeEventListener("mouseup", handleWindowMouseUp);
      window.removeEventListener("blur", handleWindowMouseUp);
    };
  }, [isDragging, applyPendingChanges]);

  const notes = [
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
  const octaves = [1, 2, 3, 4, 5, 6, 7, 8];

  // Store refs for wheel handler data (to avoid stale closures in native event listener)
  const stepNotesRef = useRef(stepNotes);
  const stepOctavesRef = useRef(stepOctaves);
  const onNoteChangeRef = useRef(onNoteChange);
  const onOctaveChangeRef = useRef(onOctaveChange);
  
  // Keep refs updated
  useEffect(() => {
    stepNotesRef.current = stepNotes;
    stepOctavesRef.current = stepOctaves;
    onNoteChangeRef.current = onNoteChange;
    onOctaveChangeRef.current = onOctaveChange;
  }, [stepNotes, stepOctaves, onNoteChange, onOctaveChange]);

  // Handle mouse wheel to change note chromatically (up/down through all notes and octaves)
  // Use native event listener with passive: false to prevent page scrolling
  useEffect(() => {
    const handleWheel = (e: WheelEvent, row: number, col: number) => {
      e.preventDefault();
      e.stopPropagation();
      
      const currentNote = stepNotesRef.current[row][col];
      const currentOctave = stepOctavesRef.current[row][col];
      const currentNoteIndex = notes.indexOf(currentNote);
      
      // Scroll up = higher pitch, scroll down = lower pitch
      const direction = e.deltaY < 0 ? 1 : -1;
      
      let newNoteIndex = currentNoteIndex + direction;
      let newOctave = currentOctave;
      
      // Handle octave wrapping
      if (newNoteIndex >= notes.length) {
        newNoteIndex = 0;
        newOctave = Math.min(8, currentOctave + 1);
      } else if (newNoteIndex < 0) {
        newNoteIndex = notes.length - 1;
        newOctave = Math.max(1, currentOctave - 1);
      }
      
      const newNote = notes[newNoteIndex];
      
      // Only update if something changed
      if (newNote !== currentNote) {
        onNoteChangeRef.current(row, col, newNote);
      }
      if (newOctave !== currentOctave) {
        onOctaveChangeRef.current(row, col, newOctave);
      }
    };

    // Attach wheel listeners to all cells with passive: false
    const listeners: Array<{ el: HTMLDivElement; handler: (e: WheelEvent) => void }> = [];
    
    cellRefs.current.forEach((rowCells, rowIndex) => {
      rowCells.forEach((cell, colIndex) => {
        if (cell) {
          const handler = (e: WheelEvent) => handleWheel(e, rowIndex, colIndex);
          cell.addEventListener('wheel', handler, { passive: false });
          listeners.push({ el: cell, handler });
        }
      });
    });

    return () => {
      listeners.forEach(({ el, handler }) => {
        el.removeEventListener('wheel', handler);
      });
    };
  }, [stepStates.length, stepStates[0]?.length]); // Re-attach when grid size changes

  return (
    <div
      className="grid grid-cols-4 gap-2 p-4 select-none"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 80px)",
        gap: "0.5rem",
        padding: "1rem",
        minWidth: "368px",
        width: "fit-content",
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {stepStates.map((row, rowIndex) =>
        row.map((state, colIndex) => {
          const isCurrent =
            currentStep[0] === rowIndex && currentStep[1] === colIndex;
          const isHovered =
            hoveredCell &&
            hoveredCell[0] === rowIndex &&
            hoveredCell[1] === colIndex;
          const direction = stepDirections[rowIndex][colIndex];
          const transport = stepTransports[rowIndex][colIndex];
          const velocity = stepVelocities[rowIndex][colIndex];
          const note = stepNotes[rowIndex][colIndex];
          const octave = stepOctaves[rowIndex][colIndex];
          const chordConfig = stepChordConfigs[rowIndex][colIndex];
          const chordDisplay = getChordDisplay(chordConfig, note, octave);
          const displayNote = chordDisplay || `${note}${octave}`;
          const probability = stepProbabilities[rowIndex][colIndex];
          const repeats = stepRepeats[rowIndex][colIndex];
          const clockDivider = stepClockDividers[rowIndex][colIndex];
              const delayMs = stepDelayMs[rowIndex][colIndex];
              const delayEnabled = stepDelayEnabled[rowIndex][colIndex];
          const isBeingDragged =
            isDragging?.row === rowIndex && isDragging?.col === colIndex;
          const isRecordingTarget = isStepRecording && currentRecordingStep &&
            currentRecordingStep[0] === rowIndex && currentRecordingStep[1] === colIndex;

          const DirectionIcon = getDirectionIcon(direction);
          const TransportIcon = getTransportIcon(transport);

          return (
            <div key={`${rowIndex}-${colIndex}`} style={{ display: "contents" }}>
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <div
                    ref={(el) => {
                      if (cellRefs.current[rowIndex]) {
                        cellRefs.current[rowIndex][colIndex] = el;
                      }
                    }}
                    className={`relative w-20 h-20 border-2 rounded-lg transition-all duration-200 ${
                      isBeingDragged ? "scale-110" : "hover:scale-105"
                    } ${getStepColor(state, isCurrent, isHovered)} ${isRecordingTarget ? "ring-2 ring-red-500 ring-offset-1" : ""}`}
                    style={{
                    ...getStepStyle(state, velocity, isCurrent),
                    width: "80px",
                    height: "80px",
                    minWidth: "80px",
                    minHeight: "80px",
                  }}
                  onMouseEnter={() => onCellHover(rowIndex, colIndex)}
                  onMouseLeave={onCellLeave}
                >
                  {/* Main step button with velocity drag area */}
                  <button
                    className="absolute inset-0 w-full h-full rounded-lg cursor-crosshair flex items-center justify-center"
                    onClick={(e) => {
                      // Only trigger click if no actual dragging occurred (just a click, not drag)
                      if (hasDraggedRef.current) return;
                      
                      // If step recording is active, set this as the new recording start position
                      if (isStepRecording && onRecordingStepClick) {
                        onRecordingStepClick(rowIndex, colIndex);
                      } else {
                        onStepClick(rowIndex, colIndex, "main");
                      }
                    }}
                    onMouseDown={(e) => {
                      handleMouseDown(e, rowIndex, colIndex, "velocity");
                    }}
                    title={isStepRecording ? `Click to start recording from this step (${note}${octave})` : `Note: ${note}${octave}, Velocity: ${velocity}, Prob: ${probability}%, Quantize: ${repeats}, Clock Div: ÷${clockDivider} (drag vertically to change velocity, hover to enable keyboard input, right-click for options)`}
                  >
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="text-xs font-mono font-semibold text-gray-800 dark:text-gray-200 drop-shadow-sm leading-tight">
                        {displayNote}
                      </div>
                      <div className="text-[10px] font-mono text-gray-500 dark:text-gray-400 drop-shadow-sm leading-tight">
                        {velocity}
                      </div>
                    </div>
                  </button>

                  {/* State button (top-left) */}
                  <button
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded text-xs flex items-center justify-center hover:opacity-80 transition-opacity z-10 ${getStateColor(state)}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onStepClick(rowIndex, colIndex, "state");
                    }}
                    title={`State: ${state}`}
                  >
                    {state === "on" ? "N" : state === "restart" ? "R" : "S"}
                  </button>

                  {/* Direction arrow area (draggable and clickable) */}
                  <div
                    className={`absolute top-0.5 right-0.5 w-4 h-4 bg-gray-800 text-white rounded flex items-center justify-center hover:bg-gray-700 transition-colors z-10 cursor-crosshair ${
                      isBeingDragged ? "bg-gray-600" : ""
                    }`}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      handleMouseDown(e, rowIndex, colIndex, "direction");
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Only handle click if not dragging
                      if (!isDragging) {
                        const nextDirection =
                          getNextClockwiseDirection(direction);
                        onDirectionDrag(rowIndex, colIndex, nextDirection);
                      }
                    }}
                    title={`Direction: ${direction} (click to rotate clockwise, drag to set direction)`}
                  >
                    <DirectionIcon className="w-2.5 h-2.5" />
                  </div>

                  {/* Transport button (bottom-left) */}
                  <button
                    className={`absolute bottom-0.5 left-0.5 w-4 h-4 rounded flex items-center justify-center hover:opacity-80 transition-opacity z-10 ${getTransportColor(transport)}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onStepClick(rowIndex, colIndex, "transport");
                    }}
                    title={`Transport: ${transport}`}
                  >
                    <TransportIcon className="w-2.5 h-2.5" />
                  </button>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-56">
                <ContextMenuSub>
                  <ContextMenuSubTrigger>Note: {note}</ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-36">
                    {notes.map((noteOption) => (
                      <ContextMenuItem
                        key={noteOption}
                        onClick={() =>
                          onNoteChange(rowIndex, colIndex, noteOption)
                        }
                        className={note === noteOption ? "bg-accent" : ""}
                      >
                        {noteOption}
                      </ContextMenuItem>
                    ))}
                  </ContextMenuSubContent>
                </ContextMenuSub>
                <ContextMenuSeparator />
                <ContextMenuSub>
                  <ContextMenuSubTrigger>
                    Octave: {octave}
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-24">
                    {octaves.map((octaveOption) => (
                      <ContextMenuItem
                        key={octaveOption}
                        onClick={() =>
                          onOctaveChange(rowIndex, colIndex, octaveOption)
                        }
                        className={octave === octaveOption ? "bg-accent" : ""}
                      >
                        {octaveOption}
                      </ContextMenuItem>
                    ))}
                  </ContextMenuSubContent>
                </ContextMenuSub>
                <ContextMenuSeparator />
                <ContextMenuSub>
                  <ContextMenuSubTrigger>
                    Probability: {probability}%
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-48">
                    <div className="px-2 py-2 space-y-2">
                      <div className="text-xs text-muted-foreground">
                        {probability}%
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={probability}
                        onChange={(e) =>
                          onProbabilityChange(
                            rowIndex,
                            colIndex,
                            Number(e.target.value),
                          )
                        }
                        className="w-full"
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={probability}
                        onChange={(e) =>
                          onProbabilityChange(
                            rowIndex,
                            colIndex,
                            Number(e.target.value),
                          )
                        }
                        className="w-full h-8 px-2 rounded border bg-background text-sm"
                      />
                    </div>
                  </ContextMenuSubContent>
                </ContextMenuSub>
                <ContextMenuSeparator />
                <ContextMenuSub>
                  <ContextMenuSubTrigger>
                    Delay: {delayEnabled ? `${delayMs}ms` : "Off"}
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-48">
                    <div className="px-2 py-2 space-y-2">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={delayEnabled}
                          onChange={(e) =>
                            onDelayEnabledChange(
                              rowIndex,
                              colIndex,
                              e.target.checked,
                            )
                          }
                        />
                        Enable delay
                      </label>
                      <div className="text-xs text-muted-foreground">
                        {delayMs}ms
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={500}
                        step={5}
                        value={delayMs}
                        onChange={(e) =>
                          onDelayMsChange(
                            rowIndex,
                            colIndex,
                            Number(e.target.value),
                          )
                        }
                        className="w-full"
                      />
                      <input
                        type="number"
                        min={0}
                        max={500}
                        step={1}
                        value={delayMs}
                        onChange={(e) =>
                          onDelayMsChange(
                            rowIndex,
                            colIndex,
                            Number(e.target.value),
                          )
                        }
                        className="w-full h-8 px-2 rounded border bg-background text-sm"
                      />
                    </div>
                  </ContextMenuSubContent>
                </ContextMenuSub>
                <ContextMenuSeparator />
                <ContextMenuSub>
                  <ContextMenuSubTrigger>
                    Quantize: {repeats}
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-24">
                        {[
                          "1/16",
                          "1/8",
                          "1/4",
                          "1/2",
                          "1/3",
                          "1/6",
                          "1/9",
                          "3/8",
                          "3/12",
                          "3/16",
                        ].map(
                      (repeatOption) => (
                        <ContextMenuItem
                          key={repeatOption}
                          onClick={() =>
                            onRepeatChange(rowIndex, colIndex, repeatOption)
                          }
                          className={
                            repeats === repeatOption ? "bg-accent" : ""
                          }
                        >
                          {repeatOption}
                        </ContextMenuItem>
                      ),
                    )}
                  </ContextMenuSubContent>
                </ContextMenuSub>
                <ContextMenuSeparator />
                <ContextMenuSub>
                  <ContextMenuSubTrigger>
                    Clock Div: ÷{stepClockDividers[rowIndex][colIndex]}
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-24">
                    {[1, 2, 3, 4, 6, 8, 9, 12, 16].map((dividerOption) => (
                      <ContextMenuItem
                        key={dividerOption}
                        onClick={() =>
                          onClockDividerChange(
                            rowIndex,
                            colIndex,
                            dividerOption,
                          )
                        }
                        className={
                          stepClockDividers[rowIndex][colIndex] ===
                          dividerOption
                            ? "bg-accent"
                            : ""
                        }
                      >
                        ÷{dividerOption}
                      </ContextMenuItem>
                    ))}
                  </ContextMenuSubContent>
                </ContextMenuSub>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={() => {
                    setAdvancedSettingsStep([rowIndex, colIndex]);
                    setAdvancedSettingsOpen(true);
                  }}
                  className="flex items-center gap-2"
                >
                  <Settings2 className="w-4 h-4" />
                  Advanced Settings...
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
            </div>
          );
        }),
      )}

      {/* Advanced Settings Dialog */}
      <Dialog open={advancedSettingsOpen} onOpenChange={setAdvancedSettingsOpen}>
        <DialogContent className="max-w-2xl h-[650px] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Step Settings [{advancedSettingsStep ? advancedSettingsStep[0] + 1 : '-'}, {advancedSettingsStep ? advancedSettingsStep[1] + 1 : '-'}]
              {advancedSettingsStep && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {stepNotes[advancedSettingsStep[0]][advancedSettingsStep[1]]}
                  {stepOctaves[advancedSettingsStep[0]][advancedSettingsStep[1]]}
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Configure MIDI device, channel, CC controls, and chord voices for this step
            </DialogDescription>
          </DialogHeader>
          
          {advancedSettingsStep && (
            <Tabs defaultValue="midi" className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="midi">MIDI Device & CC</TabsTrigger>
                <TabsTrigger value="chord">Chord Editor</TabsTrigger>
              </TabsList>
              
              <TabsContent value="midi" className="flex-1 overflow-auto">
                <StepMidiSettings
                  stepMidiDevice={stepMidiDevices[advancedSettingsStep[0]][advancedSettingsStep[1]]}
                  stepMidiChannel={stepMidiChannels[advancedSettingsStep[0]][advancedSettingsStep[1]]}
                  onMidiDeviceChange={(deviceId) => 
                    onStepMidiDeviceChange(advancedSettingsStep[0], advancedSettingsStep[1], deviceId)
                  }
                  onMidiChannelChange={(channel) => 
                    onStepMidiChannelChange(advancedSettingsStep[0], advancedSettingsStep[1], channel)
                  }
                  ccConfig={stepCCConfigs[advancedSettingsStep[0]][advancedSettingsStep[1]]}
                  onCCConfigChange={(config) => 
                    onStepCCConfigChange(advancedSettingsStep[0], advancedSettingsStep[1], config)
                  }
                  availableDevices={availableMidiOutputs}
                  globalDeviceName={globalMidiOutputName}
                  globalChannel={globalMidiChannel}
                />
              </TabsContent>
              
              <TabsContent value="chord" className="flex-1 overflow-auto">
                <StepChordEditor
                  chordConfig={stepChordConfigs[advancedSettingsStep[0]][advancedSettingsStep[1]]}
                  onChordConfigChange={(config) => 
                    onStepChordConfigChange(advancedSettingsStep[0], advancedSettingsStep[1], config)
                  }
                  stepNote={stepNotes[advancedSettingsStep[0]][advancedSettingsStep[1]]}
                  stepOctave={stepOctaves[advancedSettingsStep[0]][advancedSettingsStep[1]]}
                  availableDevices={availableMidiOutputs}
                  globalDeviceName={globalMidiOutputName}
                  globalChannel={globalMidiChannel}
                  bpm={bpm}
                />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
