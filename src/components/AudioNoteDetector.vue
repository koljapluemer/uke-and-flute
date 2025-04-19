<template>
  <div class="audio-detector p-4 bg-base-200 rounded-lg">
    <div class="flex items-center gap-4 mb-4">
      <div v-if="!autoStart" class="flex items-center gap-4">
        <button 
          @click="startDetection" 
          class="btn btn-primary"
          :disabled="isDetecting"
        >
          Start Detection
        </button>
        <button 
          @click="stopDetection" 
          class="btn btn-error"
          :disabled="!isDetecting"
        >
          Stop Detection
        </button>
      </div>
    </div>

    <div class="sensitivity-control mb-4">
      <div class="flex justify-between items-center mb-2">
        <span class="text-sm font-medium">Microphone Sensitivity</span>
        <span class="text-sm text-gray-500">Threshold: {{ amplitudeThreshold.toFixed(3) }}</span>
      </div>
      
      <div class="volume-meter relative h-8 bg-base-300 rounded-lg overflow-hidden mb-2">
        <!-- Background volume bar -->
        <div 
          class="absolute inset-y-0 left-0 bg-primary/30 transition-all duration-100"
          :style="{ width: `${(amplitude * 200).toFixed(1)}%` }"
        ></div>
        
        <!-- Threshold line -->
        <div 
          class="absolute inset-y-0 w-1 bg-error transition-all duration-100"
          :style="{ left: `${(amplitudeThreshold * 200).toFixed(1)}%` }"
        ></div>
        
        <!-- Peak indicator -->
        <div 
          v-if="amplitude > amplitudeThreshold"
          class="absolute inset-y-0 left-0 bg-primary transition-all duration-100"
          :style="{ width: `${(amplitude * 200).toFixed(1)}%` }"
        ></div>
      </div>

      <input 
        type="range" 
        min="0.001" 
        max="0.5" 
        step="0.001"
        v-model.number="amplitudeThreshold"
        @input="updateAmplitudeThreshold(amplitudeThreshold)"
        class="range range-primary w-full"
      />
      
      <p class="text-sm text-gray-500 mt-2">
        Adjust the threshold (red line) so it's just above your background noise level.
        Only sounds that go past the line will be detected as notes.
      </p>
    </div>
    
    <div v-if="isDetecting" class="detection-info p-4 bg-base-100 rounded-lg">
      <p class="text-lg">Current Note: {{ currentNote || 'No note detected' }}</p>
      <p class="text-sm text-gray-500">Frequency: {{ frequency.toFixed(1) }} Hz</p>
      <p class="text-sm text-gray-500">Amplitude: {{ amplitude.toFixed(3) }}</p>
      <p class="text-sm text-gray-500">Max FFT Value: {{ maxValue.toFixed(3) }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { useAudioDetection } from '../composables/useAudioDetection';
import type { AudioDetectionResult } from '../lib/audio/types';

const props = defineProps<{
  autoStart?: boolean;
}>();

const emit = defineEmits<{
  (e: 'noteDetected', note: string | null, frequency: number, amplitude: number): void;
}>();

const {
  isDetecting,
  currentNote,
  frequency,
  amplitude,
  amplitudeThreshold,
  maxValue,
  startDetection,
  stopDetection,
  updateAmplitudeThreshold,
} = useAudioDetection({
  autoStart: props.autoStart,
  onNoteDetected: (result: AudioDetectionResult) => {
    emit('noteDetected', result.note, result.frequency, result.amplitude);
  }
});

// Watch for autoStart changes
watch(() => props.autoStart, (newValue) => {
  if (newValue && !isDetecting.value) {
    startDetection();
  } else if (!newValue && isDetecting.value) {
    stopDetection();
  }
});
</script>

<style scoped>
.audio-detector {
  /* Base styles can be added here if needed */
}
</style> 