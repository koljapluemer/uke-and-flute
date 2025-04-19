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
      <p class="text-sm text-gray-500">Max FFT Value: {{ maxFftValue.toFixed(3) }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted, watch } from 'vue';
import * as Tone from 'tone';

const props = defineProps<{
  autoStart?: boolean;
}>();

const emit = defineEmits<{
  (e: 'noteDetected', note: string | null, frequency: number, amplitude: number): void;
}>();

const isDetecting = ref(false);
const currentNote = ref<string | null>(null);
const frequency = ref(0);
const amplitude = ref(0);
const amplitudeThreshold = ref(0.01);
const maxFftValue = ref(0);

let mic: Tone.UserMedia | null = null;
let analyser: Tone.Analyser | null = null;
let animationFrameId: number | null = null;
let lastDetectedNote: string | null = null;
let lastDetectionTime = 0;
const FREQUENCY_THRESHOLD = 20;
const DEBOUNCE_TIME = 150;
const MIN_CONFIDENCE = 0.1;
const VALID_OCTAVES = [3, 4, 5];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Watch for autoStart changes
watch(() => props.autoStart, (newValue) => {
  if (newValue && !isDetecting.value) {
    startDetection();
  } else if (!newValue && isDetecting.value) {
    stopDetection();
  }
});

const startDetection = async () => {
  try {
    await Tone.start();
    mic = new Tone.UserMedia();
    await mic.open();
    
    // Create analyzer with both waveform and fft
    analyser = new Tone.Analyser('waveform', 2048);
    const fft = new Tone.Analyser('fft', 2048);
    
    // Connect microphone to both analyzers
    mic.connect(analyser);
    mic.connect(fft);
    
    isDetecting.value = true;
    detectPitch(fft);
  } catch (error) {
    console.error('Error starting audio detection:', error);
  }
};

const detectPitch = (fft: Tone.Analyser) => {
  if (!analyser || !isDetecting.value) return;
  
  // Get the waveform data
  const waveform = analyser.getValue() as Float32Array;
  const fftData = fft.getValue() as Float32Array;
  
  // Calculate amplitude
  const rms = Math.sqrt(waveform.reduce((sum, val) => sum + val * val, 0) / waveform.length);
  amplitude.value = rms;
  
  // Only proceed if amplitude is above threshold
  if (rms < amplitudeThreshold.value) {
    currentNote.value = null;
    frequency.value = 0;
    maxFftValue.value = 0;
    emit('noteDetected', null, 0, rms);
    animationFrameId = requestAnimationFrame(() => detectPitch(fft));
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
  maxFftValue.value = confidence;
  
  // Basic frequency validation
  if (confidence < MIN_CONFIDENCE || detectedFreq < 80 || detectedFreq > 1200) {
    currentNote.value = null;
    frequency.value = 0;
    emit('noteDetected', null, 0, rms);
    animationFrameId = requestAnimationFrame(() => detectPitch(fft));
    return;
  }
  
  frequency.value = detectedFreq;
  
  // Convert frequency to note
  const note = Tone.Frequency(detectedFreq).toNote();
  const [noteName, octave] = note.split(/(\d+)/) as [string, string];
  
  // Basic octave validation
  if (!VALID_OCTAVES.includes(parseInt(octave))) {
    currentNote.value = null;
    frequency.value = 0;
    emit('noteDetected', null, 0, rms);
    animationFrameId = requestAnimationFrame(() => detectPitch(fft));
    return;
  }
  
  // Check if this is a new note
  const now = Date.now();
  const isNewNote = !lastDetectedNote || 
    now - lastDetectionTime > DEBOUNCE_TIME ||
    lastDetectedNote !== note;
  
  if (isNewNote) {
    // Round to nearest note and check cents deviation
    const roundedFreq = Tone.Frequency(note).toFrequency();
    const cents = 1200 * Math.log2(detectedFreq / roundedFreq);
    
    // More permissive cents threshold
    if (Math.abs(cents) < 35) {
      currentNote.value = note;
      lastDetectedNote = note;
      lastDetectionTime = now;
      emit('noteDetected', note, detectedFreq, confidence);
    }
  }
  
  animationFrameId = requestAnimationFrame(() => detectPitch(fft));
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
  amplitude.value = 0;
  lastDetectedNote = null;
  lastDetectionTime = 0;
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