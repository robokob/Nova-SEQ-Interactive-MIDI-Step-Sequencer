import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Input } from './ui/input';
import { type StepCCConfig, type ModulationSource } from '../utils/cc-modulation';

interface MidiDevice {
  id: string;
  name: string;
}

interface StepMidiSettingsProps {
  // MIDI device/channel settings
  stepMidiDevice: string | null;
  stepMidiChannel: number | null;
  onMidiDeviceChange: (deviceId: string | null) => void;
  onMidiChannelChange: (channel: number | null) => void;
  
  // CC settings
  ccConfig: StepCCConfig;
  onCCConfigChange: (config: StepCCConfig) => void;
  
  // Available devices
  availableDevices: MidiDevice[];
  globalDeviceName: string | null;
  globalChannel: number;
}

interface CCKnobProps {
  label: string;
  ccNumber: number;
  value: number;
  modulationSource: ModulationSource;
  modulationAmount: number;
  onCCNumberChange: (ccNumber: number) => void;
  onValueChange: (value: number) => void;
  onModulationSourceChange: (source: ModulationSource) => void;
  onModulationAmountChange: (amount: number) => void;
}

function CCKnob({
  label,
  ccNumber,
  value,
  modulationSource,
  modulationAmount,
  onCCNumberChange,
  onValueChange,
  onModulationSourceChange,
  onModulationAmountChange,
}: CCKnobProps) {
  const [inputValue, setInputValue] = useState(value.toString());
  const [isDragging, setIsDragging] = useState(false);
  const [isModDragging, setIsModDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartValue = useRef(0);

  const handleValueInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    const num = parseInt(e.target.value, 10);
    if (!isNaN(num) && num >= 0 && num <= 127) {
      onValueChange(num);
    }
  };

  const handleValueInputBlur = () => {
    setInputValue(value.toString());
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    const newValue = Math.max(0, Math.min(127, value + delta));
    onValueChange(newValue);
    setInputValue(newValue.toString());
  };

  // Main knob drag handlers
  const handleKnobMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartValue.current = value;
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = dragStartY.current - e.clientY;
      const sensitivity = 0.5; // Adjust for feel
      const newValue = Math.max(0, Math.min(127, Math.round(dragStartValue.current + deltaY * sensitivity)));
      onValueChange(newValue);
      setInputValue(newValue.toString());
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onValueChange]);

  // Modulation knob drag handlers
  const handleModMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsModDragging(true);
    dragStartY.current = e.clientY;
    dragStartValue.current = modulationAmount;
  };

  useEffect(() => {
    if (!isModDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = dragStartY.current - e.clientY;
      const sensitivity = 0.5;
      const newValue = Math.max(0, Math.min(100, Math.round(dragStartValue.current + deltaY * sensitivity)));
      onModulationAmountChange(newValue);
    };

    const handleMouseUp = () => {
      setIsModDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isModDragging, onModulationAmountChange]);

  return (
    <div className="flex flex-col gap-2 p-3 border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="flex items-center gap-1">
          <Label className="text-xs text-muted-foreground">CC#</Label>
          <Input
            type="number"
            min={0}
            max={127}
            value={ccNumber}
            onChange={(e) => onCCNumberChange(Math.max(0, Math.min(127, parseInt(e.target.value, 10) || 0)))}
            className="w-14 h-7 text-xs text-center"
          />
        </div>
      </div>

      {/* Main value knob area */}
      <div className="flex items-center gap-3">
        <div 
          className={`relative w-16 h-16 rounded-full bg-gradient-to-b from-gray-700 to-gray-900 border-2 ${isDragging ? 'border-blue-400' : 'border-gray-600'} cursor-ns-resize flex items-center justify-center shadow-inner select-none`}
          onWheel={handleWheel}
          onMouseDown={handleKnobMouseDown}
          title="Scroll or drag to change value"
        >
          {/* Knob indicator */}
          <div 
            className="absolute w-1 h-6 bg-blue-400 rounded-full origin-bottom"
            style={{
              transform: `rotate(${(value / 127) * 270 - 135}deg)`,
              bottom: '50%',
            }}
          />
          <Input
            type="text"
            value={inputValue}
            onChange={handleValueInputChange}
            onBlur={handleValueInputBlur}
            className="w-10 h-6 text-xs text-center bg-transparent border-none focus:ring-0 text-white font-mono"
          />
        </div>

        <div className="flex-1">
          <Slider
            min={0}
            max={127}
            step={1}
            value={[value]}
            onValueChange={([v]: number[]) => {
              onValueChange(v);
              setInputValue(v.toString());
            }}
            className="w-full"
          />
        </div>
      </div>

      {/* Modulation section */}
      <div className="flex items-center gap-2 pt-2 border-t">
        <div className="flex items-center gap-2 flex-1">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Mod:</Label>
          <Select
            value={modulationSource}
            onValueChange={(v: string) => onModulationSourceChange(v as ModulationSource)}
          >
            <SelectTrigger className="h-7 text-xs w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Off</SelectItem>
              <SelectItem value="velocity">Vel</SelectItem>
              <SelectItem value="pitch">Pitch</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {modulationSource !== 'none' && (
          <div className="flex items-center gap-1">
            <div 
              className={`relative w-8 h-8 rounded-full bg-gradient-to-b from-gray-600 to-gray-800 border ${isModDragging ? 'border-green-400' : 'border-gray-500'} cursor-ns-resize flex items-center justify-center select-none`}
              onWheel={(e) => {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -5 : 5;
                onModulationAmountChange(Math.max(0, Math.min(100, modulationAmount + delta)));
              }}
              onMouseDown={handleModMouseDown}
              title="Modulation amount - drag or scroll"
            >
              <div 
                className="absolute w-0.5 h-3 bg-green-400 rounded-full origin-bottom"
                style={{
                  transform: `rotate(${(modulationAmount / 100) * 270 - 135}deg)`,
                  bottom: '50%',
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-8">{modulationAmount}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function StepMidiSettings({
  stepMidiDevice,
  stepMidiChannel,
  onMidiDeviceChange,
  onMidiChannelChange,
  ccConfig,
  onCCConfigChange,
  availableDevices,
  globalDeviceName,
  globalChannel,
}: StepMidiSettingsProps) {
  const handleCCChange = useCallback((
    ccKey: 'cc1' | 'cc2' | 'cc3' | 'cc4',
    field: 'ccNumber' | 'value' | 'modulationSource' | 'modulationAmount',
    newValue: number | ModulationSource
  ) => {
    const newConfig = { ...ccConfig };
    if (field === 'ccNumber') {
      newConfig[ccKey] = { ...newConfig[ccKey], ccNumber: newValue as number };
    } else if (field === 'value') {
      newConfig[ccKey] = { ...newConfig[ccKey], value: newValue as number };
    } else if (field === 'modulationSource') {
      newConfig[ccKey] = { 
        ...newConfig[ccKey], 
        modulation: { ...newConfig[ccKey].modulation, source: newValue as ModulationSource }
      };
    } else if (field === 'modulationAmount') {
      newConfig[ccKey] = { 
        ...newConfig[ccKey], 
        modulation: { ...newConfig[ccKey].modulation, amount: newValue as number }
      };
    }
    onCCConfigChange(newConfig);
  }, [ccConfig, onCCConfigChange]);

  const channels = Array.from({ length: 16 }, (_, i) => i + 1);

  return (
    <div className="flex flex-col gap-4 p-2">
      {/* MIDI Device & Channel Selection */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">MIDI Device</Label>
          <Select
            value={stepMidiDevice || 'global'}
            onValueChange={(v: string) => onMidiDeviceChange(v === 'global' ? null : v)}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global">
                Global ({globalDeviceName || 'None'})
              </SelectItem>
              {availableDevices.map((device) => (
                <SelectItem key={device.id} value={device.id}>
                  {device.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">MIDI Channel</Label>
          <Select
            value={stepMidiChannel?.toString() || 'global'}
            onValueChange={(v: string) => onMidiChannelChange(v === 'global' ? null : parseInt(v, 10))}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global">
                Global (Ch {globalChannel})
              </SelectItem>
              {channels.map((ch) => (
                <SelectItem key={ch} value={ch.toString()}>
                  Channel {ch}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* CC Knobs - 2x2 grid */}
      <div className="grid grid-cols-2 gap-3">
        <CCKnob
          label="CC 1"
          ccNumber={ccConfig.cc1.ccNumber}
          value={ccConfig.cc1.value}
          modulationSource={ccConfig.cc1.modulation.source}
          modulationAmount={ccConfig.cc1.modulation.amount}
          onCCNumberChange={(v) => handleCCChange('cc1', 'ccNumber', v)}
          onValueChange={(v) => handleCCChange('cc1', 'value', v)}
          onModulationSourceChange={(v) => handleCCChange('cc1', 'modulationSource', v)}
          onModulationAmountChange={(v) => handleCCChange('cc1', 'modulationAmount', v)}
        />
        <CCKnob
          label="CC 2"
          ccNumber={ccConfig.cc2.ccNumber}
          value={ccConfig.cc2.value}
          modulationSource={ccConfig.cc2.modulation.source}
          modulationAmount={ccConfig.cc2.modulation.amount}
          onCCNumberChange={(v) => handleCCChange('cc2', 'ccNumber', v)}
          onValueChange={(v) => handleCCChange('cc2', 'value', v)}
          onModulationSourceChange={(v) => handleCCChange('cc2', 'modulationSource', v)}
          onModulationAmountChange={(v) => handleCCChange('cc2', 'modulationAmount', v)}
        />
        <CCKnob
          label="CC 3"
          ccNumber={ccConfig.cc3.ccNumber}
          value={ccConfig.cc3.value}
          modulationSource={ccConfig.cc3.modulation.source}
          modulationAmount={ccConfig.cc3.modulation.amount}
          onCCNumberChange={(v) => handleCCChange('cc3', 'ccNumber', v)}
          onValueChange={(v) => handleCCChange('cc3', 'value', v)}
          onModulationSourceChange={(v) => handleCCChange('cc3', 'modulationSource', v)}
          onModulationAmountChange={(v) => handleCCChange('cc3', 'modulationAmount', v)}
        />
        <CCKnob
          label="CC 4"
          ccNumber={ccConfig.cc4.ccNumber}
          value={ccConfig.cc4.value}
          modulationSource={ccConfig.cc4.modulation.source}
          modulationAmount={ccConfig.cc4.modulation.amount}
          onCCNumberChange={(v) => handleCCChange('cc4', 'ccNumber', v)}
          onValueChange={(v) => handleCCChange('cc4', 'value', v)}
          onModulationSourceChange={(v) => handleCCChange('cc4', 'modulationSource', v)}
          onModulationAmountChange={(v) => handleCCChange('cc4', 'modulationAmount', v)}
        />
      </div>
    </div>
  );
}
