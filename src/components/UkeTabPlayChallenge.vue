<template>
  <div class="p-4">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold">{{ currentSong?.title || 'Loading...' }}</h1>
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2">
          <label class="label">
            <span class="label-text">Speed:</span>
          </label>
          <input 
            type="range" 
            min="0.5" 
            max="2" 
            step="0.1" 
            v-model="playbackSpeed" 
            class="range range-primary w-48"
          />
          <span class="text-sm">{{ (playbackSpeed * 100).toFixed(0) }}%</span>
        </div>
        <button @click="togglePlay" class="btn btn-primary">
          <i :class="isPlaying ? 'fas fa-pause' : 'fas fa-play'" class="mr-2"></i>
          {{ isPlaying ? 'Pause' : 'Play' }}
        </button>
      </div>
    </div>

    <div class="tab-container bg-base-200 p-4 rounded-lg">
      <div 
        v-for="(stanza, index) in tabStanzas" 
        :key="index"
        class="stanza mb-8"
        :class="{ 'active-stanza': currentStanzaIndex === index }"
      >
        <div 
          v-for="(line, lineIndex) in stanza" 
          :key="lineIndex"
          class="tab-line font-mono text-lg"
        >
          {{ line }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';

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
const playbackSpeed = ref(1);
const currentStanzaIndex = ref(0);
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
  const baseInterval = 1000; // 1 second per stanza at 100% speed
  const interval = baseInterval / playbackSpeed.value;
  
  playInterval = window.setInterval(() => {
    currentStanzaIndex.value = (currentStanzaIndex.value + 1) % tabStanzas.value.length;
  }, interval);
};

const stopPlayback = () => {
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
  }
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

.range {
  --range-shdw: var(--primary);
}
</style>
