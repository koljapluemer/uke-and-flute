import * as Tone from 'tone';
import type { AudioAdapter, AudioAdapterOptions, AudioDetectionResult } from './types';

export class ToneJsAudioAdapter implements AudioAdapter {
  private mic: Tone.UserMedia | null = null;
  private analyser: Tone.Analyser | null = null;
  private fft: Tone.Analyser | null = null;
  private animationFrameId: number | null = null;
  private lastDetectedNote: string | null = null;
  private lastDetectionTime = 0;
  private options: AudioAdapterOptions;

  // Constants for pitch detection
  private readonly DEBOUNCE_TIME = 150;
  private readonly MIN_CONFIDENCE = 0.1;
  private readonly VALID_OCTAVES = [3, 4, 5];
  private readonly CENTS_THRESHOLD = 35;

  constructor(options: AudioAdapterOptions) {
    this.options = options;
  }

  async start(): Promise<void> {
    await Tone.start();
    this.mic = new Tone.UserMedia();
    await this.mic.open();

    // Create analyzers
    this.analyser = new Tone.Analyser('waveform', 2048);
    this.fft = new Tone.Analyser('fft', 2048);

    // Connect microphone to analyzers
    this.mic.connect(this.analyser);
    this.mic.connect(this.fft);

    // Start detection loop
    this.detectPitch();
  }

  stop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.mic) {
      this.mic.close();
      this.mic = null;
    }

    if (this.analyser) {
      this.analyser.dispose();
      this.analyser = null;
    }

    if (this.fft) {
      this.fft.dispose();
      this.fft = null;
    }

    this.lastDetectedNote = null;
    this.lastDetectionTime = 0;
  }

  setAmplitudeThreshold(threshold: number): void {
    this.options.amplitudeThreshold = threshold;
  }

  private detectPitch = (): void => {
    if (!this.analyser || !this.fft) return;

    // Get the waveform data
    const waveform = this.analyser.getValue() as Float32Array;
    const fftData = this.fft.getValue() as Float32Array;

    // Calculate amplitude
    const rms = Math.sqrt(waveform.reduce((sum, val) => sum + val * val, 0) / waveform.length);

    // Only proceed if amplitude is above threshold
    if (rms < this.options.amplitudeThreshold) {
      this.emitResult(null, 0, rms, 0);
      this.animationFrameId = requestAnimationFrame(this.detectPitch);
      return;
    }

    // Find the strongest frequency in the ukulele range
    let maxAmplitude = 0;
    let peakIndex = 0;

    // Convert frequency range to FFT indices
    const fftStartIndex = Math.floor(80 * fftData.length / Tone.context.sampleRate);
    const fftEndIndex = Math.ceil(1200 * fftData.length / Tone.context.sampleRate);

    for (let i = fftStartIndex; i < fftEndIndex; i++) {
      const amplitude = Math.abs(fftData[i]);
      if (amplitude > maxAmplitude) {
        maxAmplitude = amplitude;
        peakIndex = i;
      }
    }

    // Convert index to frequency
    const detectedFreq = (peakIndex * Tone.context.sampleRate) / fftData.length;

    // Calculate confidence based on relative amplitude
    const confidence = maxAmplitude / Math.max(...Array.from(fftData).map(Math.abs));

    // Basic frequency validation
    if (confidence < this.MIN_CONFIDENCE || detectedFreq < 80 || detectedFreq > 1200) {
      this.emitResult(null, 0, rms, confidence);
      this.animationFrameId = requestAnimationFrame(this.detectPitch);
      return;
    }

    // Convert frequency to note
    const note = Tone.Frequency(detectedFreq).toNote();
    const [noteName, octave] = note.split(/(\d+)/) as [string, string];

    // Basic octave validation
    if (!this.VALID_OCTAVES.includes(parseInt(octave))) {
      this.emitResult(null, detectedFreq, rms, confidence);
      this.animationFrameId = requestAnimationFrame(this.detectPitch);
      return;
    }

    // Check if this is a new note
    const now = Date.now();
    const isNewNote = !this.lastDetectedNote ||
      now - this.lastDetectionTime > this.DEBOUNCE_TIME ||
      this.lastDetectedNote !== note;

    if (isNewNote) {
      // Round to nearest note and check cents deviation
      const roundedFreq = Tone.Frequency(note).toFrequency();
      const cents = 1200 * Math.log2(detectedFreq / roundedFreq);

      if (Math.abs(cents) < this.CENTS_THRESHOLD) {
        this.lastDetectedNote = note;
        this.lastDetectionTime = now;
        this.emitResult(note, detectedFreq, rms, confidence);
      }
    }

    this.animationFrameId = requestAnimationFrame(this.detectPitch);
  };

  private emitResult(
    note: string | null,
    frequency: number,
    amplitude: number,
    confidence: number
  ): void {
    this.options.onNoteDetected({
      note,
      frequency,
      amplitude,
      confidence,
      timestamp: Date.now()
    });
  }
} 