import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Slider } from './ui/slider';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Play, Pause, Square, Download, Circle } from 'lucide-react';

interface MidiControlsProps {
  midiValue: number;
  isPlaying: boolean;
  bpm: number;
  swingValue: number;
  swingTightness: number;
  onMidiChange: (value: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onBpmChange: (bpm: number) => void;
  onSwingChange: (value: number) => void;
  onSwingTightnessChange: (value: number) => void;
  isRecordingExport?: boolean;
  isWaitingForNextBar?: boolean;
  onStartExport?: () => void;
  onStopExport?: () => void;
  restartMode?: "hybrid" | "immediate" | "nextTick";
  onRestartModeChange?: (mode: "hybrid" | "immediate" | "nextTick") => void;
}

export function MidiControls({
  midiValue,
  isPlaying,
  bpm,
  swingValue,
  swingTightness,
  onMidiChange,
  onPlay,
  onPause,
  onStop,
  onBpmChange,
  onSwingChange,
  onSwingTightnessChange,
  isRecordingExport = false,
  isWaitingForNextBar = false,
  onStartExport,
  onStopExport,
  restartMode = "hybrid",
  onRestartModeChange
}: MidiControlsProps) {
  // Local BPM state for immediate UI feedback
  const [localBpm, setLocalBpm] = useState(bpm);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local BPM when prop changes (e.g., from external source)
  useEffect(() => {
    setLocalBpm(bpm);
  }, [bpm]);

  // Debounced BPM change handler - immediate local update, delayed callback
  const handleBpmChange = useCallback((value: number) => {
    setLocalBpm(value); // Immediate UI update
    
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Debounce the actual BPM change by 400ms
    debounceTimerRef.current = setTimeout(() => {
      onBpmChange(value);
    }, 400);
  }, [onBpmChange]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>MIDI Step Sequencer Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Transport Controls */}
        <div className="flex gap-2">
          <Button
            variant={isPlaying ? "secondary" : "default"}
            size="sm"
            onClick={isPlaying ? onPause : onPlay}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={onStop}>
            <Square className="w-4 h-4" />
          </Button>
        </div>

        {/* Restart Mode */}
        {onRestartModeChange && (
          <div className="space-y-2">
            <label className="block text-sm">Restart Mode:</label>
            <select
              value={restartMode}
              onChange={(e) => onRestartModeChange(e.target.value as "hybrid" | "immediate" | "nextTick")}
              className="w-full px-2 py-1 text-sm border rounded bg-background"
              title="Restart timing mode"
            >
              <option value="hybrid">Hybrid (waits for delay)</option>
              <option value="immediate">Immediate (instant jump)</option>
              <option value="nextTick">Next Tick (one step later)</option>
            </select>
          </div>
        )}

        {/* Export Controls */}
        {onStartExport && onStopExport && (
          <div className="space-y-2">
            <h4>Export Last 4 Bars</h4>
            <div className="flex gap-2">
              <Button
                variant={isRecordingExport ? "destructive" : isWaitingForNextBar ? "secondary" : "outline"}
                size="sm"
                onClick={isRecordingExport ? onStopExport : onStartExport}
                disabled={false} // Always allow starting export
              >
                {isRecordingExport ? (
                  <>
                    <Circle className="w-4 h-4 fill-current" />
                    Stop Recording
                  </>
                ) : isWaitingForNextBar ? (
                  <>
                    <Circle className="w-4 h-4 animate-pulse" />
                    Waiting for Bar...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Record & Export
                  </>
                )}
              </Button>
            </div>
            {isWaitingForNextBar && (
              <div className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
                <Circle className="w-2 h-2 fill-current animate-pulse" />
                Waiting for next bar boundary for perfect timing...
              </div>
            )}
            {isRecordingExport && (
              <div className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                <Circle className="w-2 h-2 fill-current animate-pulse" />
                Recording sequence... (4 bars) - Perfect timing guaranteed!
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Records the next 4 complete sequences and exports as MIDI 1.0 file
            </div>
          </div>
        )}

        {/* MIDI CC Value */}
        <div className="space-y-2">
          <label className="block">
            MIDI CC Value: {midiValue}
          </label>
          <Slider
            value={[midiValue]}
            onValueChange={([value]) => onMidiChange(value)}
            max={127}
            min={0}
            step={1}
            className="w-full"
          />
          <div className="text-xs text-muted-foreground">
            Controls step intensity (0 = white, 127 = red)
          </div>
        </div>

        {/* BPM Control */}
        <div className="space-y-2">
          <label className="block">
            BPM: {localBpm}
          </label>
          <Slider
            value={[localBpm]}
            onValueChange={([value]) => handleBpmChange(value)}
            max={200}
            min={60}
            step={1}
            className="w-full"
          />
        </div>

        {/* Global Swing */}
        <div className="space-y-2">
          <label className="block">
            Swing (MPC ← 0 → Linear): {swingValue}%
          </label>
          <Slider
            value={[swingValue]}
            onValueChange={([value]) => onSwingChange(value)}
            max={75}
            min={-75}
            step={1}
            className="w-full"
          />
          <div className="text-xs text-muted-foreground">
            Left = MPC curve, right = linear swing
          </div>
        </div>

        {/* MPC Tightness */}
        <div className="space-y-2">
          <label className="block">
            MPC Tightness: {swingTightness}
          </label>
          <Slider
            value={[swingTightness]}
            onValueChange={([value]) => onSwingTightnessChange(value)}
            max={100}
            min={0}
            step={1}
            className="w-full"
          />
          <div className="text-xs text-muted-foreground">
            Looser ←→ tighter MPC groove
          </div>
        </div>

        {/* Visual Indicators */}
        <div className="space-y-2">
          <h4>Cell Controls</h4>
          <div className="text-xs space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-600 rounded"></div>
              <span>State: On (N) / Restart (R) / Skip (S)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-800 rounded"></div>
              <span>Direction arrows</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-600 rounded"></div>
              <span>Transport: Continue/Stop/Jump</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-600 rounded"></div>
              <span>MIDI CC number</span>
            </div>
          </div>
        </div>
        
        {/* Status Indicators */}
        <div className="space-y-2">
          <h4>Status Indicators</h4>
          <div className="text-xs space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span>Currently playing step</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-200 border rounded"></div>
              <span>Skip step (shortens sequence)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gradient-to-r from-white to-red-500 border rounded"></div>
              <span>Active step (intensity based on CC)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-100 border border-gray-300 rounded"></div>
              <span>Click any cell to start playing from there</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}