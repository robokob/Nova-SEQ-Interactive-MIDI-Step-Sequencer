import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';

interface EuclideanControlsProps {
  stepsPerBar: number;
  customStepsPerBar: number;
  quantizeCombineMode: 'and' | 'or';
  advanceOnDivider: boolean;
  onStepsPerBarChange: (steps: number) => void;
  onCustomStepsPerBarChange: (steps: number) => void;
  onQuantizeCombineModeChange: (mode: 'and' | 'or') => void;
  onAdvanceOnDividerChange: (enabled: boolean) => void;
}

export function EuclideanControls({
  stepsPerBar,
  customStepsPerBar,
  quantizeCombineMode,
  advanceOnDivider,
  onStepsPerBarChange,
  onCustomStepsPerBarChange,
  onQuantizeCombineModeChange,
  onAdvanceOnDividerChange
}: EuclideanControlsProps) {
  const presetSteps = [6, 8, 9, 12, 16, 32, 64];

  const handleCustomStepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0 && value <= 128) {
      onCustomStepsPerBarChange(value);
    }
  };

  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Sequence Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Steps Per Bar */}
        <div className="space-y-3">
          <Label>Steps Per Bar</Label>
          <div className="flex flex-wrap gap-2">
            {presetSteps.map((steps) => (
              <Button
                key={steps}
                variant={stepsPerBar === steps ? "default" : "outline"}
                size="sm"
                onClick={() => onStepsPerBarChange(steps)}
              >
                {steps}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="customSteps" className="text-sm">Custom:</Label>
            <Input
              id="customSteps"
              type="number"
              min="1"
              max="128"
              value={customStepsPerBar}
              onChange={handleCustomStepChange}
              className="w-20"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStepsPerBarChange(customStepsPerBar)}
            >
              Apply
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Current: <Badge variant="secondary">{stepsPerBar} steps</Badge>
          </div>
        </div>

        {/* Quantize + Divider Behavior */}
        <div className="space-y-4">
          <Label>Quantize & Divider</Label>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-medium">Combine Mode</div>
              <div className="text-xs text-muted-foreground">
                {quantizeCombineMode === 'and'
                  ? 'Trigger only when both fire (AND)'
                  : 'Trigger when either fires (OR)'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono">AND</span>
              <Switch
                checked={quantizeCombineMode === 'or'}
                onCheckedChange={(checked) =>
                  onQuantizeCombineModeChange(checked ? 'or' : 'and')
                }
              />
              <span className="text-xs font-mono">OR</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-medium">Advance Step on Divider</div>
              <div className="text-xs text-muted-foreground">
                {advanceOnDivider
                  ? 'Step advances only on divider trigger'
                  : 'Step advances every base tick'}
              </div>
            </div>
            <Switch
              checked={advanceOnDivider}
              onCheckedChange={onAdvanceOnDividerChange}
            />
          </div>
        </div>

        {/* Clock Divider Info */}
        <div className="space-y-2">
          <Label>Clock Divider Values</Label>
          <div className="text-xs text-muted-foreground">
            <div className="grid grid-cols-3 gap-1">
              <div>÷1 = Every step</div>
              <div>÷2 = Every 2nd</div>
              <div>÷3 = Every 3rd</div>
              <div>÷4 = Every 4th</div>
              <div>÷6 = Every 6th</div>
              <div>÷8 = Every 8th</div>
              <div>÷9 = Every 9th</div>
              <div>÷12 = Every 12th</div>
              <div>÷16 = Every 16th</div>
            </div>
            <div className="mt-2 text-xs">
              Right-click any cell → Clock Div to set per-step dividers
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}