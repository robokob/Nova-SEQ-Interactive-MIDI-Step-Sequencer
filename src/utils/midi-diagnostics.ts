/**
 * Advanced MIDI Diagnostics and Troubleshooting Utilities
 * Provides comprehensive system-level MIDI analysis and conflict resolution
 */

export interface MidiSystemInfo {
  browserSupport: {
    webMidiSupported: boolean;
    browserName: string;
    browserVersion: string;
    platform: string;
    userAgent: string;
  };
  permissions: {
    midiAllowed: boolean | null;
    securityPolicy: string;
    permissionsAPI: boolean;
  };
  devices: {
    totalInputs: number;
    totalOutputs: number;
    connectedInputs: number;
    connectedOutputs: number;
    deviceDetails: MidiDeviceInfo[];
  };
  conflicts: {
    exclusiveAccess: boolean;
    otherAppsDetected: string[];
    browserTabsUsing: number;
  };
  recommendations: string[];
}

export interface MidiDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
  version: string;
  type: 'input' | 'output';
  state: string;
  connection: string;
  isVirtual: boolean;
  isWorking: boolean;
  lastError?: string;
}

export class MidiDiagnosticsEngine {
  private systemInfo: Partial<MidiSystemInfo> = {};
  private testResults: Map<string, boolean> = new Map();

  async runComprehensiveDiagnostics(): Promise<MidiSystemInfo> {
    console.log('🔍 Starting comprehensive MIDI diagnostics...');
    
    // Reset system info
    this.systemInfo = {};
    this.testResults.clear();

    // Run all diagnostic checks
    await this.analyzeBrowserSupport();
    await this.checkPermissions();
    await this.scanAllDevices();
    await this.detectConflicts();
    this.generateRecommendations();

    return this.systemInfo as MidiSystemInfo;
  }

  private async analyzeBrowserSupport() {
    console.log('📊 Analyzing browser support...');
    
    const browserInfo = this.getBrowserInfo();
    
    this.systemInfo.browserSupport = {
      webMidiSupported: 'requestMIDIAccess' in navigator,
      browserName: browserInfo.name,
      browserVersion: browserInfo.version,
      platform: navigator.platform,
      userAgent: navigator.userAgent
    };

    console.log('Browser Info:', this.systemInfo.browserSupport);
  }

  private getBrowserInfo(): { name: string; version: string } {
    const ua = navigator.userAgent;
    let name = 'Unknown';
    let version = 'Unknown';

    if (ua.includes('Chrome')) {
      name = 'Chrome';
      const match = ua.match(/Chrome\/(\d+)/);
      version = match ? match[1] : 'Unknown';
    } else if (ua.includes('Firefox')) {
      name = 'Firefox';
      const match = ua.match(/Firefox\/(\d+)/);
      version = match ? match[1] : 'Unknown';
    } else if (ua.includes('Safari')) {
      name = 'Safari';
      const match = ua.match(/Version\/(\d+)/);
      version = match ? match[1] : 'Unknown';
    } else if (ua.includes('Edge')) {
      name = 'Edge';
      const match = ua.match(/Edg\/(\d+)/);
      version = match ? match[1] : 'Unknown';
    }

    return { name, version };
  }

  private async checkPermissions() {
    console.log('🔐 Checking MIDI permissions...');
    
    let midiAllowed: boolean | null = null;
    let securityPolicy = 'Unknown';
    let permissionsAPI = false;

    try {
      // Check if permissions API is available
      if ('permissions' in navigator) {
        permissionsAPI = true;
        try {
          // Note: 'midi' permission query might not be supported in all browsers
          const result = await (navigator.permissions as any).query({ name: 'midi' });
          midiAllowed = result.state === 'granted';
          securityPolicy = result.state;
        } catch (permError) {
          console.log('MIDI permission query not supported:', permError);
        }
      }

      // Attempt MIDI access to check actual permissions
      try {
        const midiAccess = await (navigator as any).requestMIDIAccess({ sysex: false });
        midiAllowed = true;
        securityPolicy = 'Granted';
        console.log('✅ MIDI access permission: Granted');
      } catch (accessError: any) {
        midiAllowed = false;
        if (accessError.name === 'SecurityError') {
          securityPolicy = 'Blocked by security policy';
        } else if (accessError.name === 'NotSupportedError') {
          securityPolicy = 'Not supported';
        } else {
          securityPolicy = `Error: ${accessError.message}`;
        }
        console.log('❌ MIDI access permission:', securityPolicy);
      }

    } catch (error) {
      console.log('Permission check failed:', error);
      securityPolicy = `Check failed: ${error}`;
    }

    this.systemInfo.permissions = {
      midiAllowed,
      securityPolicy,
      permissionsAPI
    };
  }

  private async scanAllDevices() {
    console.log('🎹 Scanning all MIDI devices...');
    
    let totalInputs = 0;
    let totalOutputs = 0;
    let connectedInputs = 0;
    let connectedOutputs = 0;
    const deviceDetails: MidiDeviceInfo[] = [];

    try {
      const midiAccess = await (navigator as any).requestMIDIAccess({ 
        sysex: false,
        software: true 
      });

      // Scan inputs
      for (const [id, input] of midiAccess.inputs) {
        totalInputs++;
        if (input.state === 'connected') connectedInputs++;
        
        const deviceInfo = await this.analyzeDevice(input, 'input');
        deviceDetails.push(deviceInfo);
      }

      // Scan outputs
      for (const [id, output] of midiAccess.outputs) {
        totalOutputs++;
        if (output.state === 'connected') connectedOutputs++;
        
        const deviceInfo = await this.analyzeDevice(output, 'output');
        deviceDetails.push(deviceInfo);
      }

    } catch (error) {
      console.log('Device scan failed:', error);
    }

    this.systemInfo.devices = {
      totalInputs,
      totalOutputs,
      connectedInputs,
      connectedOutputs,
      deviceDetails
    };

    console.log(`📱 Device summary: ${totalInputs} inputs, ${totalOutputs} outputs`);
  }

  private async analyzeDevice(port: any, type: 'input' | 'output'): Promise<MidiDeviceInfo> {
    const virtualPatterns = [
      'virtual', 'software', 'iac', 'loop', 'network', 'daw', 'internal'
    ];
    
    const isVirtual = virtualPatterns.some(pattern => 
      port.name?.toLowerCase().includes(pattern.toLowerCase())
    );

    let isWorking = false;
    let lastError: string | undefined;

    // Test device functionality
    try {
      if (type === 'output') {
        // Test with a safe MIDI message (timing clock)
        port.send([0xF8]); // MIDI timing clock
        isWorking = true;
      } else {
        // For inputs, just check if we can set up a listener
        const testListener = () => {};
        port.addEventListener('midimessage', testListener);
        port.removeEventListener('midimessage', testListener);
        isWorking = true;
      }
    } catch (error: any) {
      lastError = error.message;
      console.log(`Device test failed for ${port.name}:`, error);
    }

    return {
      id: port.id,
      name: port.name || 'Unknown Device',
      manufacturer: port.manufacturer || 'Unknown',
      version: port.version || 'Unknown',
      type,
      state: port.state,
      connection: port.connection,
      isVirtual,
      isWorking,
      lastError
    };
  }

  private async detectConflicts() {
    console.log('⚠️ Detecting potential conflicts...');
    
    let exclusiveAccess = false;
    const otherAppsDetected: string[] = [];
    let browserTabsUsing = 0;

    // Check for common DAW processes (this is limited in web environment)
    const commonDAWs = [
      'Ableton Live', 'Pro Tools', 'Logic Pro', 'Cubase', 'Studio One',
      'FL Studio', 'Reaper', 'Reason', 'GarageBand'
    ];

    // In web environment, we can't directly detect other processes
    // But we can check for signs of exclusive access issues
    try {
      const midiAccess = await (navigator as any).requestMIDIAccess({ sysex: false });
      
      // Check if devices appear connected but don't respond
      for (const [id, output] of midiAccess.outputs) {
        if (output.state === 'connected') {
          try {
            output.send([0xF8]); // Test message
          } catch (error: any) {
            if (error.message.includes('exclusive') || error.message.includes('busy')) {
              exclusiveAccess = true;
            }
          }
        }
      }
      
    } catch (error) {
      console.log('Conflict detection limited:', error);
    }

    // Estimate browser tabs using MIDI (very rough heuristic)
    try {
      const estimate = this.estimateMidiUsage();
      browserTabsUsing = estimate;
    } catch (error) {
      console.log('Usage estimation failed:', error);
    }

    this.systemInfo.conflicts = {
      exclusiveAccess,
      otherAppsDetected,
      browserTabsUsing
    };
  }

  private estimateMidiUsage(): number {
    // This is a very rough estimate based on various factors
    // In a web environment, we have limited visibility
    
    let estimate = 0;
    
    // Check if we're in a music production context
    if (window.location.href.includes('music') || 
        window.location.href.includes('midi') || 
        window.location.href.includes('daw')) {
      estimate += 1;
    }
    
    return estimate;
  }

  private generateRecommendations() {
    const recommendations: string[] = [];
    
    if (!this.systemInfo.browserSupport?.webMidiSupported) {
      recommendations.push('Use a modern browser with Web MIDI API support (Chrome, Edge, Opera)');
    }
    
    if (this.systemInfo.permissions?.midiAllowed === false) {
      recommendations.push('Check browser permissions and allow MIDI access');
      recommendations.push('Disable any browser extensions that might block MIDI');
    }
    
    if (this.systemInfo.devices?.connectedOutputs === 0) {
      recommendations.push('Connect a MIDI interface or enable virtual MIDI ports');
      recommendations.push('Check device drivers and USB connections');
    }
    
    if (this.systemInfo.conflicts?.exclusiveAccess) {
      recommendations.push('Close other music software that might have exclusive MIDI access');
      recommendations.push('Try disconnecting and reconnecting the MIDI device');
    }
    
    if ((this.systemInfo.devices?.totalOutputs || 0) > 0 && (this.systemInfo.devices?.connectedOutputs || 0) === 0) {
      recommendations.push('Detected devices but none are connected - check device power and connections');
    }

    // Add general troubleshooting
    recommendations.push('Try refreshing the page after connecting/disconnecting devices');
    recommendations.push('Ensure MIDI device is not in use by other applications');
    
    this.systemInfo.recommendations = recommendations;
  }

  // Get a human-readable diagnostic report
  generateReport(): string {
    const info = this.systemInfo as MidiSystemInfo;
    
    let report = '=== MIDI System Diagnostic Report ===\n\n';
    
    if (info.browserSupport) {
      report += `Browser: ${info.browserSupport.browserName} ${info.browserSupport.browserVersion}\n`;
      report += `Platform: ${info.browserSupport.platform}\n`;
      report += `MIDI Support: ${info.browserSupport.webMidiSupported ? '✅ Yes' : '❌ No'}\n\n`;
    }
    
    if (info.permissions) {
      report += `MIDI Permission: ${info.permissions.midiAllowed ? '✅ Granted' : '❌ Denied'}\n`;
      report += `Security Policy: ${info.permissions.securityPolicy}\n\n`;
    }
    
    if (info.devices) {
      report += `MIDI Devices Found:\n`;
      report += `- Inputs: ${info.devices.connectedInputs}/${info.devices.totalInputs}\n`;
      report += `- Outputs: ${info.devices.connectedOutputs}/${info.devices.totalOutputs}\n\n`;
      
      if (info.devices.deviceDetails.length > 0) {
        report += 'Device Details:\n';
        info.devices.deviceDetails.forEach(device => {
          report += `- ${device.name} (${device.type}): ${device.state} ${device.isWorking ? '✅' : '❌'}\n`;
        });
        report += '\n';
      }
    }
    
    if (info.recommendations && info.recommendations.length > 0) {
      report += 'Recommendations:\n';
      info.recommendations.forEach((rec, index) => {
        report += `${index + 1}. ${rec}\n`;
      });
    }
    
    return report;
  }
}

// Global diagnostics instance
export const midiDiagnostics = new MidiDiagnosticsEngine();