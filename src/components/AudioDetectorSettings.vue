<template>
  <div class="settings p-4 bg-base-100 rounded-lg">
    <h3 class="text-lg font-semibold mb-4">Detection Settings</h3>
    
    <div class="grid gap-4">
      <div class="form-control">
        <label class="label">
          <span class="label-text">Amplitude Threshold</span>
          <span class="label-text-alt">{{ amplitudeThreshold.toFixed(3) }}</span>
        </label>
        <input 
          type="range" 
          min="0.001" 
          max="0.5" 
          step="0.001"
          v-model="amplitudeThreshold"
          class="range range-primary"
        />
        <div class="label">
          <span class="label-text-alt">Less sensitive</span>
          <span class="label-text-alt">More sensitive</span>
        </div>
      </div>

      <div class="form-control">
        <label class="label">
          <span class="label-text">Frequency Threshold (Hz)</span>
          <span class="label-text-alt">{{ frequencyThreshold }}Hz</span>
        </label>
        <input 
          type="range" 
          min="5" 
          max="50" 
          step="1"
          v-model="frequencyThreshold"
          class="range range-primary"
        />
        <div class="label">
          <span class="label-text-alt">More precise</span>
          <span class="label-text-alt">More forgiving</span>
        </div>
      </div>

      <div class="form-control">
        <label class="label">
          <span class="label-text">Debounce Time (ms)</span>
          <span class="label-text-alt">{{ debounceTime }}ms</span>
        </label>
        <input 
          type="range" 
          min="50" 
          max="500" 
          step="10"
          v-model="debounceTime"
          class="range range-primary"
        />
        <div class="label">
          <span class="label-text-alt">Faster response</span>
          <span class="label-text-alt">Less jitter</span>
        </div>
      </div>
    </div>

    <div class="mt-4 flex justify-end gap-2">
      <button @click="resetDefaults" class="btn btn-ghost">Reset to Defaults</button>
      <button @click="applySettings" class="btn btn-primary">Apply</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  initialAmplitudeThreshold?: number;
  initialFrequencyThreshold?: number;
  initialDebounceTime?: number;
}>();

const emit = defineEmits<{
  (e: 'settingsChanged', settings: {
    amplitudeThreshold: number;
    frequencyThreshold: number;
    debounceTime: number;
  }): void;
}>();

const DEFAULT_SETTINGS = {
  amplitudeThreshold: 0.01,
  frequencyThreshold: 20,
  debounceTime: 200
};

const amplitudeThreshold = ref(props.initialAmplitudeThreshold ?? DEFAULT_SETTINGS.amplitudeThreshold);
const frequencyThreshold = ref(props.initialFrequencyThreshold ?? DEFAULT_SETTINGS.frequencyThreshold);
const debounceTime = ref(props.initialDebounceTime ?? DEFAULT_SETTINGS.debounceTime);

const resetDefaults = () => {
  amplitudeThreshold.value = DEFAULT_SETTINGS.amplitudeThreshold;
  frequencyThreshold.value = DEFAULT_SETTINGS.frequencyThreshold;
  debounceTime.value = DEFAULT_SETTINGS.debounceTime;
  applySettings();
};

const applySettings = () => {
  emit('settingsChanged', {
    amplitudeThreshold: amplitudeThreshold.value,
    frequencyThreshold: frequencyThreshold.value,
    debounceTime: debounceTime.value
  });
};
</script>

<style scoped>
.settings {
  max-width: 600px;
}
</style> 