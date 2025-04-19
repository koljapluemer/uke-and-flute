import { ref, onUnmounted } from 'vue';
import { YinAudioAdapter } from '../lib/audio/YinAudioAdapter';
import type { AudioAdapter, AudioDetectionResult } from '../lib/audio/types';

export interface AudioDetectionOptions {
  onNoteDetected?: (result: AudioDetectionResult) => void;
  autoStart?: boolean;
}

export function useAudioDetection(options: AudioDetectionOptions = {}) {
  const isDetecting = ref(false);
  const currentNote = ref<string | null>(null);
  const frequency = ref(0);
  const amplitude = ref(0);
  const amplitudeThreshold = ref(0.01);
  const maxValue = ref(0);

  let audioAdapter: AudioAdapter | null = null;

  const startDetection = async () => {
    try {
      audioAdapter = new YinAudioAdapter({
        onNoteDetected: (result) => {
          currentNote.value = result.note;
          frequency.value = result.frequency;
          amplitude.value = result.amplitude;
          maxValue.value = result.confidence;
          options.onNoteDetected?.(result);
        },
        amplitudeThreshold: amplitudeThreshold.value
      });

      await audioAdapter.start();
      isDetecting.value = true;
    } catch (error) {
      console.error('Error starting audio detection:', error);
    }
  };

  const stopDetection = () => {
    audioAdapter?.stop();
    audioAdapter = null;
    isDetecting.value = false;
    currentNote.value = null;
    frequency.value = 0;
    amplitude.value = 0;
    maxValue.value = 0;
  };

  // Watch for amplitude threshold changes
  const updateAmplitudeThreshold = (newThreshold: number) => {
    amplitudeThreshold.value = newThreshold;
    if (audioAdapter) {
      audioAdapter.setAmplitudeThreshold(newThreshold);
    }
  };

  // Auto-start if requested
  if (options.autoStart) {
    startDetection();
  }

  // Clean up on unmount
  onUnmounted(() => {
    stopDetection();
  });

  return {
    isDetecting,
    currentNote,
    frequency,
    amplitude,
    amplitudeThreshold,
    maxValue,
    startDetection,
    stopDetection,
    updateAmplitudeThreshold,
  };
} 