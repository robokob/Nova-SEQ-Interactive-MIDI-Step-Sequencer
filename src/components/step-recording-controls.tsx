import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Circle, Square, Keyboard, Mic, SkipForward } from 'lucide-react';
import { globalMidiManager } from '../utils/midi-input';

interface StepRecordingControlsProps {
  isRecording: boolean;
  currentRecordingStep: [number, number];
  onToggleRecording: (enabled: boolean) => void;
  onNoteInput: (note: string, octave: number, velocity: number) => void;
  stepStates: string[][];
  stepNotes: string[][];
  stepOctaves: number[][];
}

export function StepRecordingControls({
  isRecording,
  currentRecordingStep,
  onToggleRecording,
  onNoteInput,
  stepStates,
  stepNotes,
  stepOctaves
}: StepRecordingControlsProps) {
  const [midiStatus, setMidiStatus] = useState({ supported: false, available: false, message: '' });
  const [availableInputs, setAvailableInputs] = useState<{ id: string, name: string }[]>([]);
  const [activeNotes, setActiveNotes] = useState<number[]>([]);
  const [lastRecordedNote, setLastRecordedNote] = useState<string>('');
  const [recordingStats, setRecordingStats] = useState({ notesRecorded: 0, stepsAdvanced: 0 });

  // Check MIDI support and get available inputs
  useEffect(() => {
    const checkMidi = async () => {
      // Give MIDI manager time to initialize
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setMidiStatus(globalMidiManager.getMidiStatus());
      
      // Poll for available inputs only if MIDI is available
      const updateInputs = () => {
        if (globalMidiManager.isMidiAvailable()) {
          setAvailableInputs(globalMidiManager.getAvailableInputs());
        }
      };
      
      updateInputs();
      const interval = setInterval(() => {
        setMidiStatus(globalMidiManager.getMidiStatus());
        updateInputs();
      }, 2000); // Check every 2 seconds
      
      return () => clearInterval(interval);
    };
    
    checkMidi();
  }, []);

  // Setup MIDI note callback when recording is enabled
  useEffect(() => {
    if (isRecording) {
      globalMidiManager.setNoteCallback((note, octave, velocity) => {
        onNoteInput(note, octave, velocity);
        setLastRecordedNote(`${note}${octave}`);
        setRecordingStats(prev => ({
          notesRecorded: prev.notesRecorded + 1,
          stepsAdvanced: prev.stepsAdvanced + 1
        }));
      });
    } else {
      globalMidiManager.clearNoteCallback();
    }

    return () => {
      globalMidiManager.clearNoteCallback();
    };
  }, [isRecording, onNoteInput]);

  // Monitor active MIDI notes for display
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveNotes(globalMidiManager.getActiveNotes());
    }, 50); // Update 20 times per second

    return () => clearInterval(interval);
  }, []);

  // Reset stats when recording starts
  useEffect(() => {
    if (isRecording) {
      setRecordingStats({ notesRecorded: 0, stepsAdvanced: 0 });
      setLastRecordedNote('');
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
      position: getStepPosition(currentRecordingStep)
    };
  };

  const currentStepInfo = getCurrentStepInfo();

  if (!midiStatus.supported || !midiStatus.available) {
    return (
      <Card className="w-80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            Step Recording
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="text-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="font-medium text-blue-800 dark:text-blue-200">QWERTY Keyboard Mode</span>
              </div>
              <div className="text-blue-700 dark:text-blue-300 text-xs">
                Step recording available using your computer keyboard
              </div>
            </div>
          </div>
          
          <div className="text-sm text-muted-foreground space-y-3">
            <div>
              <strong>Keyboard Step Recording:</strong> Full functionality using your computer keyboard
            </div>
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-3 rounded border">
              <div className="font-medium text-sm mb-2 text-blue-700 dark:text-blue-300">Piano Key Layout</div>
              <div className="text-xs font-mono space-y-1">
                <div className="flex justify-between items-center">
                  <span>A W S E D F T G Y H U J</span>
                </div>
                <div className="flex justify-between items-center text-blue-600 dark:text-blue-400">
                  <span>C C# D D# E F F# G G# A A# B</span>
                </div>
                <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-800">
                  <span className="text-purple-600 dark:text-purple-400">Z = Oct Down | X = Oct Up</span>
                </div>
              </div>
            </div>
            <div className="text-xs bg-green-50 dark:bg-green-900/20 p-2 rounded text-green-700 dark:text-green-300">
              ✓ Hover over any sequencer cell → Enable step recording → Play keys to input notes
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Keyboard className="w-5 h-5" />
          Step Recording
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recording Toggle */}
        <div className="flex items-center justify-between">
          <label className="font-medium">
            Recording Mode
          </label>
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

        {/* MIDI Input Status */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            MIDI Devices ({availableInputs.length})
          </label>
          {availableInputs.length > 0 ? (
            <div className="space-y-1">
              {availableInputs.map((input) => (
                <div key={input.id} className="text-xs bg-muted p-2 rounded">
                  <Badge variant="secondary" className="text-xs mr-2">
                    MIDI
                  </Badge>
                  {input.name}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
              No MIDI devices detected. Connect a MIDI keyboard to begin step recording.
            </div>
          )}
        </div>

        {/* Current Recording Position */}
        {isRecording && (
          <div className="space-y-3 p-3 bg-accent rounded-lg">
            <div className="flex items-center gap-2">
              <SkipForward className="w-4 h-4 text-primary" />
              <span className="font-medium">Recording to Step {currentStepInfo.position}</span>
            </div>
            
            <div className="text-sm space-y-1">
              <div>
                <strong>Current:</strong> {currentStepInfo.note}{currentStepInfo.octave}
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
              <div className="font-mono text-lg">{recordingStats.notesRecorded}</div>
              <div className="text-muted-foreground">Notes</div>
            </div>
            <div className="bg-muted p-2 rounded text-center">
              <div className="font-mono text-lg">{recordingStats.stepsAdvanced}</div>
              <div className="text-muted-foreground">Steps</div>
            </div>
          </div>
        )}

        {/* Active MIDI Notes Display */}
        {activeNotes.length > 0 && (
          <div className="space-y-2">
            <label className="block text-xs font-medium text-muted-foreground">
              Active Notes
            </label>
            <div className="flex flex-wrap gap-1">
              {activeNotes.map((midiNote) => {
                const { note: noteName, octave } = require('../utils/midi-input').midiNoteToNoteAndOctave(midiNote);
                return (
                  <Badge key={midiNote} variant="default" className="text-xs">
                    {noteName}{octave}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-muted-foreground space-y-1">
          <div>
            <strong>Step Recording:</strong> Each MIDI note input automatically advances to the next step position.
          </div>
          <div>
            <strong>Override:</strong> New notes replace existing step content.
          </div>
          <div>
            <strong>Auto-Advance:</strong> Follows the same directional flow as playback.
          </div>
          {!isRecording && (
            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-blue-700 dark:text-blue-300">
              💡 Connect a MIDI keyboard and enable recording mode to input notes directly into the sequencer.
            </div>
          )}
        </div>

        {/* Status Indicator */}
        <div className="p-2 bg-muted rounded text-xs space-y-1">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`}></div>
            <span>Status: {isRecording ? 'Recording Active' : 'Standby'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${midiStatus.available && availableInputs.length > 0 ? 'bg-green-500' : 'bg-gray-400'}`}></div>
            <span>MIDI: {midiStatus.available ? (availableInputs.length > 0 ? 'Connected' : 'No Devices') : 'Blocked'}</span>
          </div>
          {!midiStatus.available && (
            <div className="text-yellow-600 dark:text-yellow-400 text-xs">
              ⚠️ Use QWERTY keyboard input instead
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}