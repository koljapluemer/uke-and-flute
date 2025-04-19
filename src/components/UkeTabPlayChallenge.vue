<template>
  <div class="p-4">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold">{{ currentSong?.title || 'Loading...' }}</h1>
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2">
          <label class="label">
            <span class="label-text">BPM:</span>
          </label>
          <input 
            type="number" 
            min="40" 
            max="200" 
            v-model="bpm" 
            class="input input-bordered w-24"
          />
        </div>
        <button @click="togglePlay" class="btn btn-primary">
          <i :class="isPlaying ? 'fas fa-pause' : 'fas fa-play'" class="mr-2"></i>
          {{ isPlaying ? 'Pause' : 'Play' }}
        </button>
      </div>
    </div>

    <AudioNoteDetector class="mb-6" />

    <div class="tab-container bg-base-200 p-4 rounded-lg">
      <div 
        v-for="(stanza, index) in tabStanzas" 
        :key="index"
        class="stanza mb-8"
      >
        <div 
          v-for="(line, lineIndex) in stanza" 
          :key="lineIndex"
          class="tab-line font-mono text-lg"
        >
          <span v-for="(char, charIndex) in line" 
            :key="charIndex"
            :class="{ 'active-char': charIndex === currentPosition }"
          >
            {{ char }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import AudioNoteDetector from './AudioNoteDetector.vue';

interface Song {
  id: string;
  title: string;
  tabContent: string;
  createdAt: Date;
  updatedAt: Date;
}

const route = useRoute();
const currentSong = ref<Song | null>(null);
const isPlaying = ref(false);
const bpm = ref(120);
const currentPosition = ref(0);
let playInterval: number | null = null;

const tabStanzas = computed(() => {
  if (!currentSong.value?.tabContent) return [];
  return currentSong.value.tabContent
    .split('\n\n')
    .map(stanza => stanza.split('\n').filter(line => line.trim()));
});

const togglePlay = () => {
  isPlaying.value = !isPlaying.value;
  
  if (isPlaying.value) {
    startPlayback();
  } else {
    stopPlayback();
  }
};

const startPlayback = () => {
  // Calculate milliseconds per beat based on BPM
  const msPerBeat = (60 * 1000) / bpm.value;
  
  playInterval = window.setInterval(() => {
    currentPosition.value++;
    // Reset position when reaching the end of the first line
    if (currentPosition.value >= tabStanzas.value[0][0].length) {
      currentPosition.value = 0;
    }
  }, msPerBeat);
};

const stopPlayback = () => {
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
  }
  currentPosition.value = 0;
};

onMounted(() => {
  const savedSongs = localStorage.getItem('ukeTabs');
  if (savedSongs) {
    const songs = JSON.parse(savedSongs);
    currentSong.value = songs.find((song: any) => song.id === route.params.id);
  }
});

onUnmounted(() => {
  stopPlayback();
});
</script>

<style scoped>
.tab-container {
  font-family: monospace;
  white-space: pre;
  overflow-x: auto;
}

.tab-line {
  line-height: 1.5;
  padding: 0.25rem 0;
}

.stanza {
  transition: background-color 0.3s ease;
}

.active-stanza {
  background-color: rgba(0, 0, 0, 0.1);
}

.active-char {
  color: red;
  font-weight: bold;
}

.input {
  text-align: center;
}
</style>
