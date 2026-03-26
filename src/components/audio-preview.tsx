import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Volume2, VolumeX, Play, Pause } from 'lucide-react';
import { globalSynth, OscillatorType } from '../utils/websynths';

interface AudioPreviewProps {
  isSequencerPlaying: boolean;
  currentStep: [number, number];
  stepStates: string[][];
  stepNotes: string[][];
  stepOctaves: number[][];
  stepVelocities: number[][];
  stepProbabilities: number[][];
  stepDelayMs: number[][];
  stepDelayEnabled: boolean[][];
  bpm: number;
}

export function AudioPreview({
  isSequencerPlaying,
  currentStep,
  stepStates,
  stepNotes,
  stepOctaves,
  stepVelocities,
  stepProbabilities,
  stepDelayMs,
  stepDelayEnabled,
  bpm
}: AudioPreviewProps) {
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [masterVolume, setMasterVolume] = useState(30);
  const [oscillatorType, setOscillatorType] = useState<OscillatorType>('sawtooth');
  const [isAudioSupported, setIsAudioSupported] = useState(true);
  const [lastPlayedStep, setLastPlayedStep] = useState<[number, number] | null>(null);
  const isAudioEnabledRef = useRef(isAudioEnabled);
  const isSequencerPlayingRef = useRef(isSequencerPlaying);

  useEffect(() => {
    isAudioEnabledRef.current = isAudioEnabled;
  }, [isAudioEnabled]);

  useEffect(() => {
    isSequencerPlayingRef.current = isSequencerPlaying;
  }, [isSequencerPlaying]);

  // Check audio support on mount
  useEffect(() => {
    setIsAudioSupported(globalSynth.isAudioSupported());
  }, []);

  // Update synth settings when they change
  useEffect(() => {
    globalSynth.setOscillatorType(oscillatorType);
  }, [oscillatorType]);

  useEffect(() => {
    globalSynth.setMasterVolume(masterVolume / 100);
  }, [masterVolume]);

  // Play notes when sequencer steps change
  useEffect(() => {
    if (!isAudioEnabled || !isSequencerPlaying) return;

    const [row, col] = currentStep;
    const stepKey = `${row}-${col}`;
    const lastStepKey = lastPlayedStep ? `${lastPlayedStep[0]}-${lastPlayedStep[1]}` : null;

    // Only play if we've moved to a new step
    if (stepKey !== lastStepKey) {
      const state = stepStates[row][col];
      
      if (state === 'on') {
        const probability = stepProbabilities[row][col];
        const probabilityPass =
          probability >= 100 || Math.random() * 100 < probability;

        if (!probabilityPass) {
          setLastPlayedStep(currentStep);
          return;
        }

        const delayMs = stepDelayEnabled[row][col]
          ? stepDelayMs[row][col]
          : 0;

        const note = stepNotes[row][col];
        const octave = stepOctaves[row][col];
        const velocity = stepVelocities[row][col];
        
        // Calculate note duration based on BPM (16th notes)
        const noteDuration = (60 / bpm / 4) * 0.8; // Slightly shorter than step duration

        const playAudio = () => {
          if (!isAudioEnabledRef.current || !isSequencerPlayingRef.current) {
            return;
          }
          globalSynth.playNote(note, octave, velocity, noteDuration);
        };

        if (delayMs > 0) {
          window.setTimeout(playAudio, delayMs);
        } else {
          playAudio();
        }
      }
      
      setLastPlayedStep(currentStep);
    }
  }, [isAudioEnabled, isSequencerPlaying, currentStep, stepStates, stepNotes, stepOctaves, stepVelocities, stepProbabilities, stepDelayMs, stepDelayEnabled, bpm, lastPlayedStep]);

  // Stop all notes when sequencer stops
  useEffect(() => {
    if (!isSequencerPlaying) {
      globalSynth.stopAllNotes();
      setLastPlayedStep(null);
    }
  }, [isSequencerPlaying]);

  // Test note playback
  const playTestNote = () => {
    if (isAudioSupported) {
      globalSynth.playNote('C', 4, 100, 0.5);
    }
  };

  const oscillatorTypes: { value: OscillatorType; label: string }[] = [
    { value: 'sine', label: 'Sine Wave' },
    { value: 'square', label: 'Square Wave' },
    { value: 'sawtooth', label: 'Sawtooth Wave' },
    { value: 'triangle', label: 'Triangle Wave' }
  ];

  if (!isAudioSupported) {
    return (
      <Card className="w-80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <VolumeX className="w-5 h-5" />
            Audio Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Web Audio API is not supported in this browser. 
            Please use a modern browser for real-time audio preview.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="w-5 h-5" />
          Audio Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Audio Enable Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">
            Real-time Audio
          </label>
          <Switch
            checked={isAudioEnabled}
            onCheckedChange={setIsAudioEnabled}
          />
        </div>

        {isAudioEnabled && (
          <>
            {/* Master Volume */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                Master Volume: {masterVolume}%
              </label>
              <Slider
                value={[masterVolume]}
                onValueChange={([value]) => setMasterVolume(value)}
                max={100}
                min={0}
                step={1}
                className="w-full"
              />
            </div>

            {/* Oscillator Type */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                Oscillator Type
              </label>
              <Select value={oscillatorType} onValueChange={(value: OscillatorType) => setOscillatorType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select waveform" />
                </SelectTrigger>
                <SelectContent>
                  {oscillatorTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Test Button */}
            <Button 
              onClick={playTestNote}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <Play className="w-4 h-4 mr-2" />
              Test Audio (C4)
            </Button>

            {/* Status */}
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isSequencerPlaying ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                <span>Sequencer: {isSequencerPlaying ? 'Playing' : 'Stopped'}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isAudioEnabled ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
                <span>Audio: {isAudioEnabled ? 'Enabled' : 'Disabled'}</span>
              </div>
              <div className="mt-2">
                <strong>Current Step:</strong> [{currentStep[0] + 1}, {currentStep[1] + 1}]
              </div>
              {isSequencerPlaying && isAudioEnabled && (
                <div>
                  <strong>Playing:</strong> {stepNotes[currentStep[0]][currentStep[1]]}{stepOctaves[currentStep[0]][currentStep[1]]}
                  {stepStates[currentStep[0]][currentStep[1]] === 'on' ? ' ♪' : ' (silent)'}
                </div>
              )}
            </div>
          </>
        )}

        {!isAudioEnabled && (
          <div className="text-xs text-muted-foreground">
            Enable real-time audio to hear your patterns as they play. 
            The synthesizer will follow your sequencer playback and play notes 
            in real-time with customizable waveforms and volume control.
          </div>
        )}
      </CardContent>
    </Card>
  );
}