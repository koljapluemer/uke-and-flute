import * as tf from '@tensorflow/tfjs';
import type { AudioAdapter, AudioDetectionResult } from './types';

export class TensorFlowAudioAdapter implements AudioAdapter {
  private model: tf.LayersModel | null = null;
  private analyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private isRunning = false;
  private onNoteDetected: (result: AudioDetectionResult) => void;
  private amplitudeThreshold: number;

  constructor(options: {
    onNoteDetected: (result: AudioDetectionResult) => void;
    amplitudeThreshold: number;
  }) {
    this.onNoteDetected = options.onNoteDetected;
    this.amplitudeThreshold = options.amplitudeThreshold;
  }

  async start(): Promise<void> {
    try {
      // Initialize TensorFlow.js
      await tf.ready();
      
      // Load or create the model
      this.model = await this.loadOrCreateModel();
      
      // Set up audio context and analyser
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      
      // Get microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.analyser);
      
      this.isRunning = true;
      this.processAudio();
    } catch (error) {
      console.error('Error starting TensorFlow audio detection:', error);
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

  private async loadOrCreateModel(): Promise<tf.LayersModel> {
    // TODO: Implement model loading/creation
    // For now, return a simple placeholder model
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 1, inputShape: [1024] }));
    return model;
  }

  private async processAudio(): Promise<void> {
    if (!this.isRunning || !this.analyser || !this.model) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    
    this.analyser.getFloatTimeDomainData(dataArray);
    
    // Calculate amplitude
    const amplitude = Math.max(...Array.from(dataArray).map(Math.abs));
    
    if (amplitude > this.amplitudeThreshold) {
      // Convert audio data to tensor
      const input = tf.tensor1d(dataArray).reshape([1, bufferLength]);
      
      // Get prediction
      const prediction = this.model.predict(input) as tf.Tensor;
      const [frequency, confidence] = await prediction.data();
      
      // Convert frequency to note
      const note = this.frequencyToNote(frequency);
      
      this.onNoteDetected({
        note,
        frequency,
        amplitude,
        confidence,
        timestamp: Date.now()
      });
    }

    // Schedule next frame
    requestAnimationFrame(() => this.processAudio());
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