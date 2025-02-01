<template>
    <div class="visualizer relative overflow-hidden border mt-4">
      <div class="playback-indicator absolute top-0 bottom-0 w-1 bg-red-500" :style="{ left: '50%' }"></div>
      <div class="notes-container" :style="{ transform: `translateX(${scrollOffset}px)` }">
        <NoteBlock
          v-for="(note, index) in notes"
          :key="index"
          :pitch="note.pitch"
          :startTick="note.startTick"
          :duration="note.duration"
        />
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue';
  import NoteBlock from './NoteBlock.vue';
  
  interface NoteEvent {
    pitch: number;
    startTick: number;
    duration: number;
  }
  
  const props = defineProps<{
    notes: NoteEvent[];
    currentTick: number;
  }>();
  
  const pixelsPerTick = 0.1;
  const scrollOffset = ref(0);
  
  watch(
    () => props.currentTick,
    (newTick) => {
      scrollOffset.value = -(newTick * pixelsPerTick) + window.innerWidth / 2;
    }
  );
  </script>
  
  <style scoped>
  .visualizer {
    height: 200px;
    background: #f9f9f9;
    position: relative;
    border: 2px solid #ccc;
  }
  .playback-indicator {
    left: 50%;
    transform: translateX(-50%);
  }
  .notes-container {
    display: flex;
    position: absolute;
    top: 0;
    height: 100%;
  }
  </style>
  