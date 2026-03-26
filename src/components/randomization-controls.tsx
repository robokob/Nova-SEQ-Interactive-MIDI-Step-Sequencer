import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Shuffle, RotateCcw } from 'lucide-react';

interface RandomizationControlsProps {
  stepDirections: string[][];
  stepNotes: string[][];
  stepOctaves: number[][];
  onDirectionChange: (row: number, col: number, direction: string) => void;
  onNoteChange: (row: number, col: number, note: string) => void;
  onOctaveChange: (row: number, col: number, octave: number) => void;
  isPlaying: boolean;
}

export function RandomizationControls({
  stepDirections,
  stepNotes,
  stepOctaves,
  onDirectionChange,
  onNoteChange,
  onOctaveChange,
  isPlaying
}: RandomizationControlsProps) {
  const [directionRandomness, setDirectionRandomness] = useState(0);
  const [noteRandomness, setNoteRandomness] = useState(0);
  const [lastRandomizationTime, setLastRandomizationTime] = useState(0);

  // Available directions for randomization
  const directions = ['up', 'down', 'left', 'right', 'up-left', 'up-right', 'down-left', 'down-right'];
  
  // Available notes for randomization
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  // Available octaves for randomization
  const octaves = [1, 2, 3, 4, 5, 6, 7, 8];

  // Randomize directions based on percentage with proper arrow conflict prevention
  const randomizeDirections = useCallback(() => {
    if (directionRandomness === 0) return;

    // Create a copy of the current directions for analysis
    const currentDirections = [...stepDirections.map(row => [...row])];
    const updatedDirections = [...stepDirections.map(row => [...row])];

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        // Random chance based on percentage
        if (Math.random() * 100 < directionRandomness) {
          const currentDirection = currentDirections[row][col];
          let randomDirection;
          let attempts = 0;
          
          // Get valid directions that don't create immediate conflicts
          const getValidDirections = (r: number, c: number, currentDir: string) => {
            const validDirs = [];
            
            for (const dir of directions) {
              // Don't choose the same direction
              if (dir === currentDir) continue;
              
              // Check if this direction would cause a conflict with adjacent cells
              const directionMap: Record<string, [number, number]> = {
                'up': [-1, 0], 'down': [1, 0], 'left': [0, -1], 'right': [0, 1],
                'up-left': [-1, -1], 'up-right': [-1, 1], 'down-left': [1, -1], 'down-right': [1, 1]
              };
              
              const [deltaRow, deltaCol] = directionMap[dir];
              let [targetRow, targetCol] = [r + deltaRow, c + deltaCol];
              
              // Handle wrapping
              if (targetRow < 0) targetRow = 3;
              if (targetRow > 3) targetRow = 0;
              if (targetCol < 0) targetCol = 3;
              if (targetCol > 3) targetCol = 0;
              
              // Check if target cell points back to this cell (creates loop)
              const targetDirection = updatedDirections[targetRow][targetCol];
              const targetDelta = directionMap[targetDirection];
              let [backRow, backCol] = [targetRow + targetDelta[0], targetCol + targetDelta[1]];
              
              // Handle wrapping for back reference
              if (backRow < 0) backRow = 3;
              if (backRow > 3) backRow = 0;
              if (backCol < 0) backCol = 3;
              if (backCol > 3) backCol = 0;
              
              // Avoid creating immediate back-and-forth loops
              if (backRow === r && backCol === c) continue;
              
              validDirs.push(dir);
            }
            
            return validDirs.length > 0 ? validDirs : directions.filter(d => d !== currentDir);
          };
          
          // Get valid directions and pick one
          const validDirections = getValidDirections(row, col, currentDirection);
          randomDirection = validDirections[Math.floor(Math.random() * validDirections.length)];
          
          // Update both tracking arrays
          updatedDirections[row][col] = randomDirection;
          onDirectionChange(row, col, randomDirection);
        }
      }
    }
  }, [directionRandomness, directions, stepDirections, onDirectionChange]);

  // Randomize notes based on percentage
  const randomizeNotes = useCallback(() => {
    if (noteRandomness === 0) return;

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        // Random chance based on percentage
        if (Math.random() * 100 < noteRandomness) {
          const randomNote = notes[Math.floor(Math.random() * notes.length)];
          const randomOctave = octaves[Math.floor(Math.random() * octaves.length)];
          onNoteChange(row, col, randomNote);
          onOctaveChange(row, col, randomOctave);
        }
      }
    }
  }, [noteRandomness, notes, octaves, onNoteChange, onOctaveChange]);

  // Auto-randomization timer when playing
  useEffect(() => {
    if (!isPlaying || (directionRandomness === 0 && noteRandomness === 0)) return;

    const interval = setInterval(() => {
      const now = Date.now();
      // Only randomize every 2 seconds to avoid too much chaos
      if (now - lastRandomizationTime > 2000) {
        if (directionRandomness > 0) randomizeDirections();
        if (noteRandomness > 0) randomizeNotes();
        setLastRandomizationTime(now);
      }
    }, 500); // Check every 500ms

    return () => clearInterval(interval);
  }, [isPlaying, directionRandomness, noteRandomness, lastRandomizationTime, randomizeDirections, randomizeNotes]);

  // Manual randomization triggers
  const triggerDirectionRandomization = () => {
    randomizeDirections();
    setLastRandomizationTime(Date.now());
  };

  const triggerNoteRandomization = () => {
    randomizeNotes();
    setLastRandomizationTime(Date.now());
  };

  // Reset all randomness
  const resetRandomization = () => {
    setDirectionRandomness(0);
    setNoteRandomness(0);
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shuffle className="w-5 h-5" />
          Randomization Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Direction Randomization */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="font-medium">
              Direction Randomness: {directionRandomness}%
            </label>
            <Button
              onClick={triggerDirectionRandomization}
              variant="outline"
              size="sm"
              disabled={directionRandomness === 0}
            >
              <Shuffle className="w-3 h-3 mr-1" />
              Randomize Now
            </Button>
          </div>
          <Slider
            value={[directionRandomness]}
            onValueChange={([value]) => setDirectionRandomness(value)}
            max={100}
            min={0}
            step={5}
            className="w-full"
          />
          <div className="text-xs text-muted-foreground">
            {directionRandomness === 0 ? (
              'No randomization - directions stay as set'
            ) : (
              `${directionRandomness}% chance each cell changes direction every 2 seconds while playing`
            )}
          </div>
        </div>

        {/* Note Randomization */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="font-medium">
              Note Randomness: {noteRandomness}%
            </label>
            <Button
              onClick={triggerNoteRandomization}
              variant="outline"
              size="sm"
              disabled={noteRandomness === 0}
            >
              <Shuffle className="w-3 h-3 mr-1" />
              Randomize Now
            </Button>
          </div>
          <Slider
            value={[noteRandomness]}
            onValueChange={([value]) => setNoteRandomness(value)}
            max={100}
            min={0}
            step={5}
            className="w-full"
          />
          <div className="text-xs text-muted-foreground">
            {noteRandomness === 0 ? (
              'No randomization - notes stay as set'
            ) : (
              `${noteRandomness}% chance each cell changes note/octave every 2 seconds while playing`
            )}
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={resetRandomization}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset All (0%)
          </Button>
          <Button
            onClick={() => {
              setDirectionRandomness(25);
              setNoteRandomness(15);
            }}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            Gentle Chaos
          </Button>
          <Button
            onClick={() => {
              setDirectionRandomness(75);
              setNoteRandomness(50);
            }}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            Wild Mode
          </Button>
        </div>

        {/* Status Display */}
        <div className="p-2 bg-muted rounded text-xs space-y-1">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-green-500' : 'bg-gray-400'}`}></div>
            <span>Auto-randomization: {isPlaying && (directionRandomness > 0 || noteRandomness > 0) ? 'Active' : 'Inactive'}</span>
          </div>
          <div>
            <strong>Direction Chaos:</strong> {directionRandomness === 0 ? 'Off' : `${directionRandomness}% active`}
          </div>
          <div>
            <strong>Note Chaos:</strong> {noteRandomness === 0 ? 'Off' : `${noteRandomness}% active`}
          </div>
          {(directionRandomness > 0 || noteRandomness > 0) && isPlaying && (
            <div className="text-yellow-600 dark:text-yellow-400">
              ⚡ Randomization occurs every 2 seconds during playback
            </div>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          <strong>How it works:</strong> Set percentages above 0 to enable automatic randomization during playback. 
          Higher percentages = more chaos. Use "Randomize Now" buttons for manual triggering.
          Randomization affects the entire 4x4 grid based on the probability you set.
        </div>
      </CardContent>
    </Card>
  );
}