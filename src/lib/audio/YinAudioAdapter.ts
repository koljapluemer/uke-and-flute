import type { AudioAdapter, AudioDetectionResult } from './types';

export class YinAudioAdapter implements AudioAdapter {
  private analyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private isRunning = false;
  private onNoteDetected: (result: AudioDetectionResult) => void;
  private amplitudeThreshold: number;
  private buffer: Float32Array;
  private sampleRate: number;

  constructor(options: {
    onNoteDetected: (result: AudioDetectionResult) => void;
    amplitudeThreshold: number;
  }) {
    this.onNoteDetected = options.onNoteDetected;
    this.amplitudeThreshold = options.amplitudeThreshold;
    this.buffer = new Float32Array(2048); // Buffer size for analysis
    this.sampleRate = 44100; // Default sample rate
  }

  async start(): Promise<void> {
    try {
      // Set up audio context and analyser
      this.audioContext = new AudioContext();
      this.sampleRate = this.audioContext.sampleRate;
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      
      // Get microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.analyser);
      
      this.isRunning = true;
      this.processAudio();
    } catch (error) {
      console.error('Error starting YIN audio detection:', error);
      throw error;
    }
  }

  stop(): void {
    this.isRunning = false;
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    this.mediaStream = null;
    this.audioContext = null;
    this.analyser = null;
  }

  setAmplitudeThreshold(threshold: number): void {
    this.amplitudeThreshold = threshold;
  }

  private async processAudio(): Promise<void> {
    if (!this.isRunning || !this.analyser) return;

    // Get time domain data
    this.analyser.getFloatTimeDomainData(this.buffer);
    
    // Calculate amplitude
    const amplitude = Math.max(...Array.from(this.buffer).map(Math.abs));
    
    if (amplitude > this.amplitudeThreshold) {
      // Apply YIN algorithm
      const frequency = this.yinPitchDetection();
      
      if (frequency > 0) {
        const note = this.frequencyToNote(frequency);
        const confidence = this.calculateConfidence(frequency);
        
        this.onNoteDetected({
          note,
          frequency,
          amplitude,
          confidence,
          timestamp: Date.now()
        });
      }
    }

    // Schedule next frame
    requestAnimationFrame(() => this.processAudio());
  }

  private yinPitchDetection(): number {
    const tauMin = Math.floor(this.sampleRate / 1000); // Minimum period (1ms)
    const tauMax = Math.floor(this.sampleRate / 50);   // Maximum period (20ms)
    
    // Calculate difference function
    const difference = new Float32Array(tauMax);
    for (let tau = 0; tau < tauMax; tau++) {
      let sum = 0;
      for (let j = 0; j < this.buffer.length - tau; j++) {
        const delta = this.buffer[j] - this.buffer[j + tau];
        sum += delta * delta;
      }
      difference[tau] = sum;
    }
    
    // Calculate cumulative mean normalized difference function
    const cmndf = new Float32Array(tauMax);
    cmndf[0] = 1;
    let runningSum = 0;
    
    for (let tau = 1; tau < tauMax; tau++) {
      runningSum += difference[tau];
      cmndf[tau] = difference[tau] * tau / runningSum;
    }
    
    // Find the first minimum below threshold
    const threshold = 0.1;
    let tau = tauMin;
    while (tau < tauMax - 1) {
      if (cmndf[tau] < threshold) {
        while (tau + 1 < tauMax - 1 && cmndf[tau + 1] < cmndf[tau]) {
          tau++;
        }
        return this.sampleRate / tau;
      }
      tau++;
    }
    
    return 0; // No pitch detected
  }

  private calculateConfidence(frequency: number): number {
    // Simple confidence calculation based on signal-to-noise ratio
    const signalEnergy = this.buffer.reduce((sum, x) => sum + x * x, 0) / this.buffer.length;
    const noiseFloor = 0.001; // Arbitrary noise floor
    return Math.min(1, signalEnergy / noiseFloor);
  }

  private frequencyToNote(frequency: number): string | null {
    if (frequency <= 0) return null;
    
    // Calculate MIDI note number
    const noteNum = Math.round(12 * Math.log2(frequency / 440) + 69);
    
    // Get note name and octave
    const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const noteName = noteNames[noteNum % 12];
    const octave = Math.floor(noteNum / 12) - 1;
    
    return `${noteName}${octave}`;
  }
} 