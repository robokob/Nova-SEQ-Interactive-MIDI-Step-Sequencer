import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';

interface ScaleControlsProps {
  currentScale: string;
  currentRoot: string;
  globalOctave: number;
  onScaleChange: (scale: string) => void;
  onRootChange: (root: string) => void;
  onGlobalOctaveChange: (octave: number) => void;
  onApplyScale: () => void;
}

export function ScaleControls({
  currentScale,
  currentRoot,
  globalOctave,
  onScaleChange,
  onRootChange,
  onGlobalOctaveChange,
  onApplyScale
}: ScaleControlsProps) {
  const scales = [
    { value: 'major', label: 'Major (Ionian)' },
    { value: 'minor', label: 'Natural Minor (Aeolian)' },
    { value: 'dorian', label: 'Dorian' },
    { value: 'phrygian', label: 'Phrygian' },
    { value: 'lydian', label: 'Lydian' },
    { value: 'mixolydian', label: 'Mixolydian' },
    { value: 'locrian', label: 'Locrian' },
    { value: 'pentatonic-major', label: 'Pentatonic Major' },
    { value: 'pentatonic-minor', label: 'Pentatonic Minor' },
    { value: 'blues', label: 'Blues Scale' },
    { value: 'harmonic-minor', label: 'Harmonic Minor' },
    { value: 'melodic-minor', label: 'Melodic Minor' },
    { value: 'chromatic', label: 'Chromatic' }
  ];

  const roots = [
    'C', 'C#', 'D', 'D#', 'E', 'F', 
    'F#', 'G', 'G#', 'A', 'A#', 'B'
  ];

  const octaves = [1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Scale Generator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Root Note
          </label>
          <Select value={currentRoot} onValueChange={onRootChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select root note" />
            </SelectTrigger>
            <SelectContent>
              {roots.map((root) => (
                <SelectItem key={root} value={root}>
                  {root}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Scale Type
          </label>
          <Select value={currentScale} onValueChange={onScaleChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select scale" />
            </SelectTrigger>
            <SelectContent>
              {scales.map((scale) => (
                <SelectItem key={scale.value} value={scale.value}>
                  {scale.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Starting Octave
          </label>
          <Select value={globalOctave.toString()} onValueChange={(value) => onGlobalOctaveChange(parseInt(value))}>
            <SelectTrigger>
              <SelectValue placeholder="Select octave" />
            </SelectTrigger>
            <SelectContent>
              {octaves.map((octave) => (
                <SelectItem key={octave} value={octave.toString()}>
                  Octave {octave}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button 
          onClick={onApplyScale} 
          className="w-full"
          variant="default"
        >
          Apply Scale to Grid
        </Button>

        <div className="text-xs text-muted-foreground space-y-1">
          <div><strong>Current:</strong> {currentRoot} {scales.find(s => s.value === currentScale)?.label}</div>
          <div><strong>Starting Octave:</strong> {globalOctave}</div>
          <div className="mt-2">
            Click "Apply Scale to Grid" to populate all 16 cells with notes from the selected scale, 
            starting from the top-left at octave {globalOctave} and progressing through higher octaves.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}