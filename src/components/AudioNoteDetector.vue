<template>
  <div class="audio-detector p-4 bg-base-200 rounded-lg">
    <div class="flex items-center gap-4 mb-4">
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
    
    <div v-if="isDetecting" class="detection-info mt-4 p-4 bg-base-100 rounded-lg">
      <p class="text-lg">Current Note: {{ currentNote || 'No note detected' }}</p>
      <p class="text-sm text-gray-500">Frequency: {{ frequency.toFixed(1) }} Hz</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import * as Tone from 'tone';

const isDetecting = ref(false);
const currentNote = ref<string | null>(null);
const frequency = ref(0);

let mic: Tone.UserMedia | null = null;
let analyser: Tone.Analyser | null = null;
let animationFrameId: number | null = null;

const startDetection = async () => {
  try {
    // Initialize Tone.js
    await Tone.start();
    
    // Create microphone input
    mic = new Tone.UserMedia();
    await mic.open();
    
    // Create analyzer
    analyser = new Tone.Analyser('waveform', 2048);
    
    // Connect microphone to analyzer
    mic.connect(analyser);
    
    // Start detection loop
    isDetecting.value = true;
    detectPitch();
  } catch (error) {
    console.error('Error starting audio detection:', error);
  }
};

const stopDetection = () => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  
  if (mic) {
    mic.close();
    mic = null;
  }
  
  if (analyser) {
    analyser.dispose();
    analyser = null;
  }
  
  isDetecting.value = false;
  currentNote.value = null;
  frequency.value = 0;
};

const detectPitch = () => {
  if (!analyser || !isDetecting.value) return;
  
  // Get the waveform data
  const waveform = analyser.getValue();
  
  // Find the dominant frequency using autocorrelation
  const ac = new Float32Array(waveform.length);
  for (let lag = 0; lag < waveform.length; lag++) {
    for (let i = 0; i < waveform.length - lag; i++) {
      ac[lag] += waveform[i] * waveform[i + lag];
    }
  }
  
  // Find the first peak after the first trough
  let peak = 0;
  let peakIndex = 0;
  let troughFound = false;
  
  for (let i = 1; i < ac.length / 2; i++) {
    if (!troughFound && ac[i] < ac[i - 1]) {
      troughFound = true;
    } else if (troughFound && ac[i] > ac[i - 1] && ac[i] > peak) {
      peak = ac[i];
      peakIndex = i;
    }
  }
  
  // Convert peak index to frequency
  if (peakIndex > 0) {
    const detectedFreq = Tone.context.sampleRate / peakIndex;
    frequency.value = detectedFreq;
    currentNote.value = Tone.Frequency(detectedFreq).toNote();
  } else {
    frequency.value = 0;
    currentNote.value = null;
  }
  
  animationFrameId = requestAnimationFrame(detectPitch);
};

// Clean up on component unmount
onUnmounted(() => {
  stopDetection();
});
</script>

<style scoped>
.audio-detector {
  /* Base styles can be added here if needed */
}
</style> 