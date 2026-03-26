import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { RotateCcw, Music } from 'lucide-react';
import { globalSynth, MICROTUNING_PRESETS, MicrotuningPreset } from '../utils/websynths';

interface MicrotuningControlsProps {
  onMicrotuningChange: (preset: MicrotuningPreset) => void;
}

export function MicrotuningControls({ onMicrotuningChange }: MicrotuningControlsProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>('Equal Temperament');
  const [customDeviations, setCustomDeviations] = useState<number[]>(
    MICROTUNING_PRESETS[0].deviations
  );
  const [activeTab, setActiveTab] = useState<string>('presets');

  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  // Apply preset when selected
  useEffect(() => {
    const preset = MICROTUNING_PRESETS.find(p => p.name === selectedPreset);
    if (preset) {
      globalSynth.setMicrotuning(preset);
      setCustomDeviations([...preset.deviations]);
      onMicrotuningChange(preset);
    }
  }, [selectedPreset, onMicrotuningChange]);

  // Apply custom deviations when they change
  useEffect(() => {
    if (activeTab === 'custom') {
      const customPreset: MicrotuningPreset = {
        name: 'Custom',
        description: 'User-defined microtuning',
        deviations: customDeviations
      };
      globalSynth.setCustomMicrotuning(customDeviations);
      onMicrotuningChange(customPreset);
    }
  }, [customDeviations, activeTab, onMicrotuningChange]);

  const handlePresetChange = (presetName: string) => {
    setSelectedPreset(presetName);
    setActiveTab('presets');
  };

  const handleCustomDeviationChange = (noteIndex: number, cents: number) => {
    const newDeviations = [...customDeviations];
    newDeviations[noteIndex] = cents;
    setCustomDeviations(newDeviations);
  };

  const resetCustomTuning = () => {
    setCustomDeviations(MICROTUNING_PRESETS[0].deviations);
  };

  const loadPresetToCustom = () => {
    const preset = MICROTUNING_PRESETS.find(p => p.name === selectedPreset);
    if (preset) {
      setCustomDeviations([...preset.deviations]);
      setActiveTab('custom');
    }
  };

  // Test a specific note with current microtuning
  const testNote = (noteIndex: number) => {
    const note = noteNames[noteIndex];
    globalSynth.playNote(note, 4, 100, 0.5);
  };

  const currentPreset = MICROTUNING_PRESETS.find(p => p.name === selectedPreset);

  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="w-5 h-5" />
          Microtuning System
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="presets">Presets</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>
          
          <TabsContent value="presets" className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                Tuning System
              </label>
              <Select value={selectedPreset} onValueChange={handlePresetChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tuning system" />
                </SelectTrigger>
                <SelectContent>
                  {MICROTUNING_PRESETS.map((preset) => (
                    <SelectItem key={preset.name} value={preset.name}>
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {currentPreset && (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  {currentPreset.description}
                </div>

                {/* Deviation Display */}
                <div className="grid grid-cols-3 gap-1 text-xs">
                  {currentPreset.deviations.map((cents, index) => (
                    <button
                      key={noteNames[index]}
                      onClick={() => testNote(index)}
                      className="flex flex-col items-center p-1 bg-muted rounded hover:bg-accent transition-colors"
                      title={`${noteNames[index]}: ${cents > 0 ? '+' : ''}${cents} cents (click to test)`}
                    >
                      <div className="font-mono">{noteNames[index]}</div>
                      <Badge 
                        variant={cents === 0 ? 'secondary' : cents > 0 ? 'destructive' : 'default'}
                        className="text-xs"
                      >
                        {cents > 0 ? '+' : ''}{cents}
                      </Badge>
                    </button>
                  ))}
                </div>

                <Button 
                  onClick={loadPresetToCustom}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  Edit as Custom
                </Button>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="custom" className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Custom Tuning</h4>
              <Button 
                onClick={resetCustomTuning}
                variant="outline"
                size="sm"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset
              </Button>
            </div>

            <div className="space-y-3">
              {customDeviations.map((cents, index) => (
                <div key={noteNames[index]} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => testNote(index)}
                      className="text-sm font-mono hover:text-primary transition-colors"
                      title="Click to test note"
                    >
                      {noteNames[index]}
                    </button>
                    <Badge 
                      variant={cents === 0 ? 'secondary' : cents > 0 ? 'destructive' : 'default'}
                      className="text-xs"
                    >
                      {cents > 0 ? '+' : ''}{cents}¢
                    </Badge>
                  </div>
                  <Slider
                    value={[cents]}
                    onValueChange={([value]) => handleCustomDeviationChange(index, value)}
                    min={-100}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>
              ))}
            </div>

            <div className="text-xs text-muted-foreground">
              <strong>Cents:</strong> Logarithmic pitch units. 100 cents = 1 semitone.
              Positive values = sharper, negative = flatter.
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-4 p-2 bg-muted rounded text-xs space-y-1">
          <div><strong>Active System:</strong> {activeTab === 'presets' ? selectedPreset : 'Custom'}</div>
          <div><strong>Deviation Range:</strong> {Math.min(...(activeTab === 'presets' ? currentPreset?.deviations || [0] : customDeviations))}¢ to {Math.max(...(activeTab === 'presets' ? currentPreset?.deviations || [0] : customDeviations))}¢</div>
          <div className="text-xs text-muted-foreground mt-2">
            Click any note name to test the tuning. Microtuning affects all audio playback.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}