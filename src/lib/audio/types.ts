export interface AudioDetectionResult {
  note: string | null;
  frequency: number;
  amplitude: number;
  confidence: number;
  timestamp: number;
}

export interface AudioAdapterOptions {
  onNoteDetected: (result: AudioDetectionResult) => void;
  amplitudeThreshold: number;
}

export interface AudioAdapter {
  start(): Promise<void>;
  stop(): void;
  setAmplitudeThreshold(threshold: number): void;
} 