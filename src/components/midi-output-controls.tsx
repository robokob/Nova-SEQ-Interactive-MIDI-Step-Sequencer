import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Volume2, VolumeX, Clock, Zap, Activity, RefreshCw, AlertTriangle, CheckCircle, ChevronDown, Bug, Settings } from 'lucide-react';
import { globalMidiOutput, MidiOutputDevice } from '../utils/midi-output';
import { midiDiagnostics, MidiSystemInfo } from '../utils/midi-diagnostics';

interface MidiOutputControlsProps {
  isSequencerPlaying: boolean;
  bpm: number;
  onBpmChange: (bpm: number) => void;
  midiChannel?: number; // Current MIDI channel (1-16)
  onMidiChannelChange?: (channel: number) => void; // Callback when channel changes
}

export function MidiOutputControls({
  isSequencerPlaying,
  bpm,
  onBpmChange,
  midiChannel: externalMidiChannel,
  onMidiChannelChange
}: MidiOutputControlsProps) {
  const [availableOutputs, setAvailableOutputs] = useState<MidiOutputDevice[]>([]);
  const [selectedOutputId, setSelectedOutputId] = useState<string | null>(null);
  const [midiChannel, setMidiChannel] = useState<number>(externalMidiChannel || 1); // MIDI channel 1-16
  const [midiStatus, setMidiStatus] = useState({
    supported: false,
    available: false,
    selectedDevice: null as string | null,
    devicesCount: 0,
    clockRunning: false,
    activeNotesCount: 0,
    diagnostics: [] as string[],
    initAttempts: 0,
    lastError: null as string | null
  });
  const [isClockSyncEnabled, setIsClockSyncEnabled] = useState(true);
  const [isOutputEnabled, setIsOutputEnabled] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [systemInfo, setSystemInfo] = useState<MidiSystemInfo | null>(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);

  // Sync external MIDI channel with internal state
  useEffect(() => {
    if (externalMidiChannel !== undefined && externalMidiChannel !== midiChannel) {
      setMidiChannel(externalMidiChannel);
    }
  }, [externalMidiChannel]);

  // Update available outputs and status with enhanced monitoring
  useEffect(() => {
    const updateMidiStatus = () => {
      setAvailableOutputs(globalMidiOutput.getAvailableOutputs());
      setMidiStatus(globalMidiOutput.getStatus());
    };

    // Initial update
    updateMidiStatus();
    
    // More frequent updates initially, then slower
    let slowInterval: ReturnType<typeof setInterval> | null = null;
    const quickInterval = setInterval(updateMidiStatus, 500); // Every 500ms for first 10 seconds
    
    const transitionTimer = setTimeout(() => {
      clearInterval(quickInterval);
      slowInterval = setInterval(updateMidiStatus, 2000); // Then every 2 seconds
    }, 10000);

    return () => {
      clearInterval(quickInterval);
      clearTimeout(transitionTimer);
      if (slowInterval) clearInterval(slowInterval);
    };
  }, []);

  // Force refresh MIDI devices
  const handleRefreshDevices = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const deviceCount = await globalMidiOutput.forceScan();
      console.log(`MIDI refresh completed: ${deviceCount} devices found`);
    } catch (error) {
      console.error('MIDI refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Manual device refresh with user interaction
  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const success = await globalMidiOutput.refreshDevices();
      if (success) {
        console.log('Manual MIDI refresh successful');
      } else {
        console.log('Manual MIDI refresh failed');
      }
    } catch (error) {
      console.error('Manual MIDI refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Run comprehensive diagnostics
  const runFullDiagnostics = useCallback(async () => {
    setIsRunningDiagnostics(true);
    try {
      const diagnosticResults = await midiDiagnostics.runComprehensiveDiagnostics();
      setSystemInfo(diagnosticResults);
      
      // Print report to console
      const report = midiDiagnostics.generateReport();
      console.log('\n' + report);
      
    } catch (error) {
      console.error('Diagnostics failed:', error);
    } finally {
      setIsRunningDiagnostics(false);
    }
  }, []);

  // Handle output device selection
  const handleOutputSelect = useCallback((deviceId: string) => {
    if (deviceId === 'none') {
      globalMidiOutput.selectOutput(null);
      setSelectedOutputId(null);
      setIsOutputEnabled(false);
    } else {
      const success = globalMidiOutput.selectOutput(deviceId);
      if (success) {
        setSelectedOutputId(deviceId);
        setIsOutputEnabled(true);
      }
    }
  }, []);

  // Handle clock sync toggle
  const handleClockSyncToggle = useCallback((enabled: boolean) => {
    setIsClockSyncEnabled(enabled);
    if (!enabled && midiStatus.clockRunning) {
      globalMidiOutput.stopClock();
    }
  }, [midiStatus.clockRunning]);

  // Handle output enable/disable
  const handleOutputToggle = useCallback((enabled: boolean) => {
    setIsOutputEnabled(enabled);
    if (!enabled) {
      globalMidiOutput.stopClock();
      globalMidiOutput.stopAllNotes();
    }
  }, []);

  // Sync clock with sequencer playback
  useEffect(() => {
    if (!isOutputEnabled || !isClockSyncEnabled) return;

    if (isSequencerPlaying && !midiStatus.clockRunning) {
      globalMidiOutput.startClock(bpm);
    } else if (!isSequencerPlaying && midiStatus.clockRunning) {
      globalMidiOutput.stopClock();
    }
  }, [isSequencerPlaying, isOutputEnabled, isClockSyncEnabled, bpm, midiStatus.clockRunning]);

  // Sync BPM changes
  useEffect(() => {
    if (isOutputEnabled && midiStatus.clockRunning) {
      globalMidiOutput.setBPM(bpm);
    }
  }, [bpm, isOutputEnabled, midiStatus.clockRunning]);

  // Test MIDI output with enhanced feedback
  const testMidiOutput = useCallback(async () => {
    if (!isOutputEnabled) return;
    
    try {
      // First test device connectivity
      const connectivityTest = await globalMidiOutput.testDeviceOutput();
      if (!connectivityTest) {
        console.log('Device connectivity test failed');
        return;
      }
      
      // Play a test note sequence using the selected MIDI channel
      const testNotes = [
        { note: 'C', octave: 4, delay: 0 },
        { note: 'E', octave: 4, delay: 200 },
        { note: 'G', octave: 4, delay: 400 },
        { note: 'C', octave: 5, delay: 600 }
      ];

      console.log(`Playing MIDI test sequence on channel ${midiChannel}...`);
      testNotes.forEach(({ note, octave, delay }) => {
        setTimeout(() => {
          // Convert channel 1-16 to MIDI channel 0-15
          globalMidiOutput.playNote(note, octave, 100, midiChannel - 1, 300);
        }, delay);
      });
      
    } catch (error) {
      console.error('MIDI test failed:', error);
    }
  }, [isOutputEnabled, midiChannel]);

  // Panic - stop all notes
  const panicStop = useCallback(() => {
    globalMidiOutput.stopAllNotes();
  }, []);

  if (!midiStatus.supported) {
    return (
      <Card className="w-80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="w-5 h-5" />
            MIDI Output
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Web MIDI API not supported in this browser. MIDI output requires a modern browser with MIDI support.
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
          MIDI Output
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Device Detection Status */}
        {midiStatus.lastError && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span className="text-sm font-medium text-red-800 dark:text-red-200">MIDI Issue Detected</span>
            </div>
            <div className="text-xs text-red-700 dark:text-red-300">
              {midiStatus.lastError}
            </div>
          </div>
        )}

        {/* Output Device Selection with Enhanced Controls */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Output Device</label>
            <div className="flex gap-1">
              <Button
                onClick={handleRefreshDevices}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                onClick={() => setShowDiagnostics(!showDiagnostics)}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
              >
                <Bug className="w-3 h-3" />
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                  >
                    <Settings className="w-3 h-3" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>MIDI System Diagnostics</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Button 
                      onClick={runFullDiagnostics}
                      disabled={isRunningDiagnostics}
                      className="w-full"
                    >
                      {isRunningDiagnostics ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Running Diagnostics...
                        </>
                      ) : (
                        <>
                          <Bug className="w-4 h-4 mr-2" />
                          Run Full System Diagnostics
                        </>
                      )}
                    </Button>
                    
                    {systemInfo && (
                      <div className="space-y-4">
                        {/* Browser Support */}
                        <div className="p-3 bg-muted rounded">
                          <h4 className="font-medium mb-2">Browser Support</h4>
                          <div className="text-sm space-y-1">
                            <div>Browser: {systemInfo.browserSupport.browserName} {systemInfo.browserSupport.browserVersion}</div>
                            <div>Platform: {systemInfo.browserSupport.platform}</div>
                            <div className="flex items-center gap-2">
                              MIDI Support: 
                              {systemInfo.browserSupport.webMidiSupported ? (
                                <Badge variant="default" className="bg-green-600">✅ Supported</Badge>
                              ) : (
                                <Badge variant="destructive">❌ Not Supported</Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Permissions */}
                        <div className="p-3 bg-muted rounded">
                          <h4 className="font-medium mb-2">Permissions</h4>
                          <div className="text-sm space-y-1">
                            <div className="flex items-center gap-2">
                              MIDI Access: 
                              {systemInfo.permissions.midiAllowed ? (
                                <Badge variant="default" className="bg-green-600">✅ Granted</Badge>
                              ) : (
                                <Badge variant="destructive">❌ Denied</Badge>
                              )}
                            </div>
                            <div>Policy: {systemInfo.permissions.securityPolicy}</div>
                          </div>
                        </div>

                        {/* Device Information */}
                        <div className="p-3 bg-muted rounded">
                          <h4 className="font-medium mb-2">Devices</h4>
                          <div className="text-sm space-y-2">
                            <div>
                              Inputs: {systemInfo.devices.connectedInputs}/{systemInfo.devices.totalInputs} connected
                            </div>
                            <div>
                              Outputs: {systemInfo.devices.connectedOutputs}/{systemInfo.devices.totalOutputs} connected
                            </div>
                            
                            {systemInfo.devices.deviceDetails.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {systemInfo.devices.deviceDetails.map((device, index) => (
                                  <div key={index} className="flex items-center justify-between p-2 bg-background rounded text-xs">
                                    <div>
                                      <div className="font-medium">{device.name}</div>
                                      <div className="text-muted-foreground">
                                        {device.type} • {device.manufacturer} • {device.state}
                                        {device.isVirtual && ' • Virtual'}
                                      </div>
                                    </div>
                                    <Badge variant={device.isWorking ? "default" : "destructive"} className="text-xs">
                                      {device.isWorking ? "✅" : "❌"}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Recommendations */}
                        {systemInfo.recommendations.length > 0 && (
                          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                            <h4 className="font-medium mb-2 text-yellow-800 dark:text-yellow-200">Recommendations</h4>
                            <div className="text-sm space-y-1 text-yellow-700 dark:text-yellow-300">
                              {systemInfo.recommendations.map((rec, index) => (
                                <div key={index}>• {rec}</div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          
          <Select value={selectedOutputId || 'none'} onValueChange={handleOutputSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Select MIDI device" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Output</SelectItem>
              {availableOutputs.map((device) => (
                <SelectItem key={device.id} value={device.id}>
                  {device.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {availableOutputs.length === 0 ? 'No devices detected' : `${availableOutputs.length} device(s) found`}
            </span>
            {midiStatus.initAttempts > 1 && (
              <span className="text-muted-foreground">
                Init attempts: {midiStatus.initAttempts}
              </span>
            )}
          </div>

          {/* Manual Refresh Button for Problematic Cases */}
          {availableOutputs.length === 0 && midiStatus.supported && (
            <div className="space-y-2">
              <Button
                onClick={handleManualRefresh}
                variant="outline"
                size="sm"
                className="w-full"
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <>
                    <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3 mr-2" />
                    Manual Device Scan
                  </>
                )}
              </Button>
              <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                💡 If your MIDI interface isn't detected:
                <br />• Close other DAWs/music software
                <br />• Disconnect and reconnect the device
                <br />• Try the manual scan button above
                <br />• Check browser permissions
              </div>
            </div>
          )}
        </div>

        {/* MIDI Channel Selection - Always visible, disabled when no device selected */}
        <div className="space-y-2">
          <label className="text-sm font-medium">MIDI Channel</label>
          <Select 
            value={midiChannel.toString()} 
            onValueChange={(value) => {
              const newChannel = parseInt(value);
              setMidiChannel(newChannel);
              if (onMidiChannelChange) {
                onMidiChannelChange(newChannel);
              }
            }}
            disabled={!selectedOutputId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select channel" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 16 }, (_, i) => i + 1).map((ch) => (
                <SelectItem key={ch} value={ch.toString()}>
                  Channel {ch}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Current: CH {midiChannel}</span>
            <span>Channels: 1-16</span>
          </div>
        </div>

        {/* Output Enable Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">MIDI Output</label>
          <div className="flex items-center gap-2">
            {isOutputEnabled ? (
              <Volume2 className="w-3 h-3 text-green-600 dark:text-green-400" />
            ) : (
              <VolumeX className="w-3 h-3 text-gray-400" />
            )}
            <Switch
              checked={isOutputEnabled}
              onCheckedChange={handleOutputToggle}
              disabled={!selectedOutputId}
            />
          </div>
        </div>

        {/* Clock Synchronization */}
        {isOutputEnabled && (
          <div className="space-y-3 p-3 bg-accent rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">Clock Sync</span>
              </div>
              <Switch
                checked={isClockSyncEnabled}
                onCheckedChange={handleClockSyncToggle}
              />
            </div>
            {isClockSyncEnabled && (
              <div className="text-xs text-muted-foreground">
                MIDI clock automatically syncs with sequencer playback at {bpm} BPM
              </div>
            )}
          </div>
        )}

        {/* Status Indicators */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isOutputEnabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
            <span className="text-xs">
              Output: {isOutputEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          
          {midiStatus.selectedDevice && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-xs">Device: {midiStatus.selectedDevice}</span>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${midiStatus.clockRunning ? 'bg-orange-500 animate-pulse' : 'bg-gray-400'}`}></div>
            <span className="text-xs">
              Clock: {midiStatus.clockRunning ? 'Running' : 'Stopped'}
            </span>
          </div>

          {midiStatus.activeNotesCount > 0 && (
            <div className="flex items-center gap-2">
              <Activity className="w-3 h-3 text-red-500" />
              <span className="text-xs">Active Notes: {midiStatus.activeNotesCount}</span>
            </div>
          )}
        </div>

        {/* Test and Control Buttons */}
        {isOutputEnabled && (
          <div className="flex gap-2">
            <Button
              onClick={testMidiOutput}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <Zap className="w-3 h-3 mr-1" />
              Test
            </Button>
            <Button
              onClick={panicStop}
              variant="destructive"
              size="sm"
              className="flex-1"
            >
              Panic
            </Button>
          </div>
        )}

        {/* Technical Info */}
        {isOutputEnabled && (
          <div className="text-xs text-muted-foreground space-y-1">
            <div>
              <strong>Protocol:</strong> MIDI 1.0 standard
            </div>
            <div>
              <strong>Latency:</strong> Low-latency real-time streaming
            </div>
            <div>
              <strong>Channels:</strong> Dynamic routing (0-15)
            </div>
            <div>
              <strong>Clock:</strong> 24 PPQN synchronization
            </div>
          </div>
        )}

        {/* Diagnostics Panel */}
        {showDiagnostics && (
          <Collapsible open={showDiagnostics} onOpenChange={setShowDiagnostics}>
            <CollapsibleContent className="space-y-2">
              <div className="text-xs font-medium">MIDI Diagnostics</div>
              <div className="bg-muted p-2 rounded max-h-32 overflow-y-auto">
                {midiStatus.diagnostics.length > 0 ? (
                  <div className="space-y-1 font-mono text-xs">
                    {midiStatus.diagnostics.map((msg, index) => (
                      <div key={index} className={`
                        ${msg.includes('Error') ? 'text-red-600 dark:text-red-400' : ''}
                        ${msg.includes('success') ? 'text-green-600 dark:text-green-400' : ''}
                        ${msg.includes('Found') ? 'text-blue-600 dark:text-blue-400' : ''}
                      `}>
                        {msg}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No diagnostic data available</div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    const diagnostics = globalMidiOutput.getDiagnostics();
                    console.log('Full MIDI Diagnostics:', diagnostics);
                  }}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  Export to Console
                </Button>
                <Button
                  onClick={() => globalMidiOutput.clearDiagnostics()}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  Clear Log
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Connection Instructions and Troubleshooting */}
        {availableOutputs.length === 0 && !midiStatus.lastError && (
          <div className="space-y-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-700 dark:text-blue-300">
              💡 Connect a MIDI interface, synthesizer, or DAW to stream sequencer output in real-time.
            </div>
            
            <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs text-yellow-700 dark:text-yellow-300">
              <div className="font-medium mb-1">Troubleshooting MIDI Detection:</div>
              <div className="space-y-1">
                <div>• Ensure MIDI device drivers are installed</div>
                <div>• Check if other apps are using the device exclusively</div>
                <div>• Try connecting the device to a different USB port</div>
                <div>• Restart the browser after connecting the device</div>
                <div>• Enable "Use system MIDI" in browser settings if available</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}