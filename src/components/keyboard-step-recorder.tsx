import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Badge } from "./ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Circle,
  Square,
  Keyboard,
  SkipForward,
  Play,
  Pause,
} from "lucide-react";

interface KeyboardStepRecorderProps {
  isRecording: boolean;
  currentRecordingStep: [number, number];
  onToggleRecording: (enabled: boolean) => void;
  onNoteInput: (note: string, octave: number, velocity: number) => void;
  stepStates: string[][];
  stepNotes: string[][];
  stepOctaves: number[][];
  hoveredCell: [number, number] | null;
  currentOctave: number;
  isPlaying: boolean;
  midiStatus: { supported: boolean; available: boolean; message: string };
  availableMidiInputs: { id: string; name: string }[];
  selectedMidiInputId: string;
  onMidiInputChange: (inputId: string) => void;
  midiInputChannel: number;
  onMidiInputChannelChange: (channel: number) => void;
}

export function KeyboardStepRecorder({
  isRecording,
  currentRecordingStep,
  onToggleRecording,
  onNoteInput,
  stepStates,
  stepNotes,
  stepOctaves,
  hoveredCell,
  currentOctave,
  isPlaying,
  midiStatus,
  availableMidiInputs,
  selectedMidiInputId,
  onMidiInputChange,
  midiInputChannel,
  onMidiInputChannelChange,
}: KeyboardStepRecorderProps) {
  const [recordingStats, setRecordingStats] = useState({
    notesRecorded: 0,
    stepsAdvanced: 0,
  });
  const [lastRecordedNote, setLastRecordedNote] = useState<string>("");
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());

  // Keyboard to note mapping
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

  // Key visualization
  const keyLayout = [
    { key: "a", note: "C", type: "white" },
    { key: "w", note: "C#", type: "black" },
    { key: "s", note: "D", type: "white" },
    { key: "e", note: "D#", type: "black" },
    { key: "d", note: "E", type: "white" },
    { key: "f", note: "F", type: "white" },
    { key: "t", note: "F#", type: "black" },
    { key: "g", note: "G", type: "white" },
    { key: "y", note: "G#", type: "black" },
    { key: "h", note: "A", type: "white" },
    { key: "u", note: "A#", type: "black" },
    { key: "j", note: "B", type: "white" },
  ];

  // Handle keyboard input for step recording
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key repeat events — prevents rapid-fire duplicate notes
      if (e.repeat) return;

      const key = e.key.toLowerCase();

      // Prevent default for our handled keys
      if (keyToNote[key] || key === "z" || key === "x") {
        e.preventDefault();
      }

      // Add key to active keys
      setActiveKeys((prev) => new Set([...prev, key]));

      // Handle note input during step recording
      if (isRecording && keyToNote[key]) {
        const note = keyToNote[key];
        onNoteInput(note, currentOctave, 100); // Use velocity 100 for keyboard input
        setLastRecordedNote(`${note}${currentOctave}`);
        setRecordingStats((prev) => ({
          notesRecorded: prev.notesRecorded + 1,
          stepsAdvanced: prev.stepsAdvanced + 1,
        }));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      setActiveKeys((prev) => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isRecording, currentOctave, onNoteInput, keyToNote]);

  // Reset stats when recording starts, clear keys when stopped
  useEffect(() => {
    if (isRecording) {
      setRecordingStats({ notesRecorded: 0, stepsAdvanced: 0 });
      setLastRecordedNote("");
    } else {
      setActiveKeys(new Set());
    }
  }, [isRecording]);

  const handleToggleRecording = () => {
    onToggleRecording(!isRecording);
  };

  // Get readable step position
  const getStepPosition = (step: [number, number]) => {
    return `[${step[0] + 1}, ${step[1] + 1}]`;
  };

  // Get current step info
  const getCurrentStepInfo = () => {
    const [row, col] = currentRecordingStep;
    return {
      state: stepStates[row][col],
      note: stepNotes[row][col],
      octave: stepOctaves[row][col],
      position: getStepPosition(currentRecordingStep),
    };
  };

  const currentStepInfo = getCurrentStepInfo();

  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Keyboard className="w-5 h-5" />
          Keyboard Step Recording
        </CardTitle>
        <div className="mt-2 space-y-2">
          <div className="text-xs text-muted-foreground">
            {midiStatus.message || "MIDI status unavailable"}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">MIDI Device</label>
              <Select
                value={selectedMidiInputId}
                onValueChange={onMidiInputChange}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Select device" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Devices</SelectItem>
                  {availableMidiInputs.map((input) => (
                    <SelectItem key={input.id} value={input.id}>
                      {input.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">MIDI Channel</label>
              <Select
                value={String(midiInputChannel)}
                onValueChange={(value) =>
                  onMidiInputChannelChange(Number(value))
                }
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Omni</SelectItem>
                  {Array.from({ length: 16 }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recording Toggle */}
        <div className="flex items-center justify-between">
          <label className="font-medium">Step Recording Mode</label>
          <div className="flex items-center gap-2">
            {isRecording ? (
              <Circle className="w-3 h-3 fill-red-500 text-red-500 animate-pulse" />
            ) : (
              <Square className="w-3 h-3 text-gray-400" />
            )}
            <Switch
              checked={isRecording}
              onCheckedChange={handleToggleRecording}
            />
          </div>
        </div>

        {/* Piano Keyboard Visualization */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Virtual Piano Keyboard
          </label>
          <div className="bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 p-3 rounded-lg border">
            <div className="relative h-16 flex">
              {keyLayout.map((keyInfo, index) => (
                <div
                  key={keyInfo.key}
                  className={`
                    relative flex-1 mx-px rounded-sm border transition-all duration-75
                    ${
                      keyInfo.type === "white"
                        ? "bg-white dark:bg-gray-100 border-gray-300 dark:border-gray-600"
                        : "bg-gray-800 dark:bg-gray-900 border-gray-600 dark:border-gray-800 -mx-2 z-10 flex-shrink-0 w-6"
                    }
                    ${
                      activeKeys.has(keyInfo.key)
                        ? keyInfo.type === "white"
                          ? "bg-blue-200 dark:bg-blue-800 shadow-inner"
                          : "bg-blue-600 dark:bg-blue-500 shadow-inner"
                        : ""
                    }
                    ${isRecording ? "cursor-pointer hover:shadow-md" : ""}
                  `}
                >
                  <div
                    className={`
                    absolute bottom-1 left-1/2 transform -translate-x-1/2 text-xs font-mono
                    ${keyInfo.type === "white" ? "text-gray-600 dark:text-gray-800" : "text-gray-300 dark:text-gray-400"}
                    ${activeKeys.has(keyInfo.key) ? "font-bold" : ""}
                  `}
                  >
                    {keyInfo.key.toUpperCase()}
                  </div>
                  <div
                    className={`
                    absolute top-1 left-1/2 transform -translate-x-1/2 text-xs
                    ${keyInfo.type === "white" ? "text-gray-500 dark:text-gray-700" : "text-gray-400 dark:text-gray-500"}
                    ${activeKeys.has(keyInfo.key) ? "font-bold text-blue-600 dark:text-blue-300" : ""}
                  `}
                  >
                    {keyInfo.note}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-center gap-4 text-xs">
              <div
                className={`flex items-center gap-1 ${activeKeys.has("z") ? "text-blue-600 dark:text-blue-400 font-bold" : "text-gray-600 dark:text-gray-400"}`}
              >
                <kbd className="px-1 py-0.5 bg-white dark:bg-gray-800 rounded border">
                  Z
                </kbd>
                <span>Oct Down</span>
              </div>
              <div
                className={`flex items-center gap-1 ${activeKeys.has("x") ? "text-blue-600 dark:text-blue-400 font-bold" : "text-gray-600 dark:text-gray-400"}`}
              >
                <kbd className="px-1 py-0.5 bg-white dark:bg-gray-800 rounded border">
                  X
                </kbd>
                <span>Oct Up</span>
              </div>
            </div>
          </div>
        </div>

        {/* Current Recording Position */}
        {isRecording && (
          <div className="space-y-3 p-3 bg-accent rounded-lg">
            <div className="flex items-center gap-2">
              <SkipForward className="w-4 h-4 text-primary" />
              <span className="font-medium">
                Recording to Step {currentStepInfo.position}
              </span>
            </div>

            <div className="text-sm space-y-1">
              <div>
                <strong>Current:</strong> {currentStepInfo.note}
                {currentStepInfo.octave}
                <Badge variant="outline" className="ml-2 text-xs">
                  {currentStepInfo.state}
                </Badge>
              </div>
              {lastRecordedNote && (
                <div>
                  <strong>Last Recorded:</strong> {lastRecordedNote}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recording Statistics */}
        {isRecording && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-muted p-2 rounded text-center">
              <div className="font-mono text-lg">
                {recordingStats.notesRecorded}
              </div>
              <div className="text-muted-foreground">Notes</div>
            </div>
            <div className="bg-muted p-2 rounded text-center">
              <div className="font-mono text-lg">
                {recordingStats.stepsAdvanced}
              </div>
              <div className="text-muted-foreground">Steps</div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-muted-foreground space-y-2">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
            <div className="font-medium text-blue-700 dark:text-blue-300 mb-1">
              How to Record:
            </div>
            <div className="space-y-1 text-blue-600 dark:text-blue-400">
              <div>1. Enable step recording mode above</div>
              <div>2. Use keyboard keys A-J to input notes</div>
              <div>3. Each note automatically advances to next step</div>
              <div>4. Use Z/X to change octave as needed</div>
            </div>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="p-2 bg-muted rounded text-xs space-y-1">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-gray-400"}`}
            ></div>
            <span>Step Recording: {isRecording ? "Active" : "Standby"}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span>Keyboard: Ready</span>
          </div>
          {isPlaying && (
            <div className="flex items-center gap-2">
              <Play className="w-2 h-2 text-blue-500" />
              <span className="text-blue-600 dark:text-blue-400">
                Sequencer Playing
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
