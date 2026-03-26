# Interactive MIDI Step Sequencer - User Manual

## Table of Contents
1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Step Grid](#step-grid)
4. [Transport Controls](#transport-controls)
5. [MIDI Settings](#midi-settings)
6. [Scale & Pitch](#scale--pitch)
7. [Advanced Features](#advanced-features)
8. [Per-Step Controls](#per-step-controls)
9. [Tips & Tricks](#tips--tricks)

---

## Overview

This is a powerful 4x4 MIDI step sequencer with advanced features including:
- Dynamic step directions and routing
- Per-step delays, probabilities, and clock divisions
- Multiple scales and microtuning support
- Euclidean rhythm generation
- Real-time MIDI recording
- MIDI file export
- Restart/loop control

---

## Getting Started

### Quick Start
1. **Start Playing**: Click the Play button (▶) or click any step on the grid
2. **Adjust Tempo**: Use the BPM slider (60-200 BPM)
3. **Change Notes**: Hover over a step and use mouse wheel to scroll through notes
4. **Stop**: Click the Stop button (■)

### First Pattern
1. Click Play to start the sequencer at [0,0]
2. While playing, click different steps to jump to them
3. Try clicking the state button (top-left corner of a step) to toggle between:
   - **N** (Normal) - Step plays
   - **R** (Restart) - Jumps back to start position
   - **S** (Skip) - Step is skipped

---

## Step Grid

### Main Grid (4x4)
- Each cell represents one step in the sequence
- The **blue highlighted cell** shows the current playing step
- Click any step while playing to jump to it

### Step Information Display
Each step shows:
- **Note & Octave** (top): E.g., "C4", "F#5"
- **Velocity** (bottom): MIDI velocity (64-127)

### Step Colors
- **White to Red gradient**: Intensity based on velocity (controlled by MIDI CC slider)
- **Blue border**: Currently playing step
- **Yellow background**: Skip state (step is bypassed)
- **Red ring**: Step recording target (when recording is active)

---

## Transport Controls

### Playback
- **Play (▶)**: Start/resume playback from current position
- **Pause (⏸)**: Pause playback
- **Stop (■)**: Stop and reset to beginning

### BPM Control
- **Range**: 60-200 BPM
- **Live adjustment**: Change tempo while playing (no restart needed)
- Changes apply smoothly after 400ms debounce

---

## MIDI Settings

### MIDI CC Value (0-127)
Controls the visual intensity and can be mapped to external parameters
- **0**: White (minimum)
- **127**: Red (maximum)

### MIDI Output Channel
- **Range**: 1-16
- Select which MIDI channel to send notes on
- View available MIDI output ports

### Swing
- **MPC ← 0 → Linear**: -75% to +75%
- **Left (negative)**: Classic MPC swing curve
- **Right (positive)**: Linear swing timing
- **MPC Tightness**: 0-100, adjusts swing intensity

---

## Scale & Pitch

### Scale Selection
**Available Scales**:
- Major, Minor, Harmonic Minor, Melodic Minor
- Dorian, Phrygian, Lydian, Mixolydian, Locrian
- Pentatonic Major/Minor
- Blues, Whole Tone, Chromatic
- Hungarian Minor, Persian, Japanese

### Root Note
Select from C, C#, D, D#, E, F, F#, G, G#, A, A#, B

### Starting Octave
- **Range**: -1 to 8
- Determines the base octave for the scale

### Apply Scale
Click "Apply Scale" to update all steps with the selected scale

---

## Advanced Features

### Restart Mode (3 Options)
Control how "R" (Restart) steps behave:

1. **Hybrid (waits for delay)** - Default
   - Plays the note with its delay
   - Then jumps back after the delay completes
   - Musical and smooth

2. **Immediate (instant jump)**
   - Jumps back instantly
   - Ignores step delay for restart timing
   - Tight, precise loops

3. **Next Tick (one step later)**
   - Advances to next step first
   - Then jumps back on following tick
   - Creates syncopated feel

### Export & Recording

#### MIDI File Export
1. Click "Record & Export"
2. Sequencer waits for next bar boundary
3. Records exactly 4 bars
4. Automatically downloads MIDI 1.0 file
5. Perfect timing guaranteed

### Euclidean Rhythms

#### Steps Per Bar
- **Presets**: 6, 8, 9, 12, 16, 32, 64
- **Custom**: Enter any value
- Determines bar length for export

#### Quantize + Divider Mode
- **AND**: Both conditions must be true
- **OR**: Either condition triggers

#### Advance on Divider
- **Off**: Step always advances (default)
- **On**: Step only advances when divider triggers

---

## Per-Step Controls

### Right-Click Menu
Right-click any step for detailed controls:

#### Step State
- **On (N)**: Normal playback
- **Restart (R)**: Jump back to start position
- **Skip (S)**: Bypass this step

#### Direction
Set movement direction:
- **Cardinal**: Up, Down, Left, Right
- **Diagonal**: Up-Left, Up-Right, Down-Left, Down-Right

#### Note & Octave
- **Note**: C through B (with sharps)
- **Octave**: -1 to 8

#### Velocity (64-127)
MIDI note velocity for this step

#### Probability (0-100%)
- **100%**: Always plays
- **50%**: Plays 50% of the time
- **0%**: Never plays (like skip)

#### Clock Divider
Trigger frequency: 1, 2, 3, 4, 6, 8, 9, 12, 16
- **1**: Every tick (default)
- **2**: Every 2 ticks
- **3**: Every 3 ticks (triplets)
- etc.

#### Quantize Value
Musical note values: 1/16, 1/8, 1/4, 1/2, 1/1

#### Delay
- **Delay (ms)**: 0-500ms
- **Enable**: Checkbox to activate
- Delays MIDI note output (not sequencer timing)

---

## Tips & Tricks

### Creating Patterns

**Simple Loop**
1. Set all steps to "Right" direction
2. Place "R" (Restart) at the last step
3. Creates repeating 4-step loop

**Ping Pong**
1. Row 1: Right direction, last step "Down"
2. Row 2: Left direction, last step "R"
3. Sequence bounces back and forth

**Random Walk**
1. Set random directions on each step
2. Add "R" steps to keep it contained
3. Never repeats the same way

### Using Probability
- **75%**: Occasional variation
- **50%**: Half-time feel
- **25%**: Sparse accents

### Clock Dividers
- **Divide by 2**: Half-speed steps
- **Divide by 3**: Triplet feel
- **Divide by 4**: Quarter-note spacing

### Delays for Humanization
- Add small delays (10-30ms) for groove
- Larger delays (100-200ms) for echo effects
- Vary delays across steps for swing

### Euclidean Rhythms
1. Set steps per bar to pattern length
2. Use clock dividers to create polyrhythms
3. Combine with probability for variation

---

## Keyboard Shortcuts

### While Hovering Over a Step
- **Mouse Wheel**: Scroll through notes chromatically
- **Click**: Jump to step (if playing) or start playing
- **Right-Click**: Open detailed controls menu

### Direction Control
- **Arrow Keys**: Change step direction (when hovering)

---

## MIDI Setup

### Output
1. Connect MIDI device or software
2. Select output port in MIDI Output Controls
3. Set MIDI channel (1-16)
4. Notes will be sent to selected output

### Input (Step Recording)
1. Connect MIDI keyboard
2. Select input device
3. Enable step recording
4. Play notes on keyboard to record to steps

---

## Troubleshooting

### No Sound
- Check MIDI output device is selected
- Verify MIDI channel matches receiving device
- Ensure steps are not all in "Skip" state
- Check velocity is above 0

### Timing Issues
- Use "Immediate" restart mode for tightest loops
- Disable delays if experiencing latency
- Check BPM is set correctly

### Pattern Not Looping
- Add "R" (Restart) step at desired loop end
- Check directions lead back to start
- Verify no "Stop" transport states

### Click Not Starting Playback
- Make sure you're clicking the center of the step (not controls)
- Avoid dragging while clicking
- Red ring indicates step recording mode (click sets recording position)

---

## Advanced Concepts

### Restart Target Tracking
- Restart jumps to the last position you started from
- Click a new step while playing to update restart target
- Useful for live performance variations

### Quantized Updates
- Direction changes apply on next clock tick
- Velocity changes apply on next clock tick
- Jump requests are quantized to BPM
- Prevents timing drift and jitter

### Clock System
- Base clock: 1/16 notes
- Clock dividers multiply interval
- Quantize values group triggers
- Both can combine (AND/OR mode)

---

## Credits & Version

**Version**: 3.0 (Restart Toggle Edition)
**Features**: 4x4 Grid, MIDI I/O, Scales, Euclidean, Export, Microtuning

For more information, see the project README files.

---

*Happy Sequencing! 🎵*
