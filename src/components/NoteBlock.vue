<template>
    <div
      class="note-block absolute bg-blue-400 rounded"
      :style="{
        left: `${startTick * pixelsPerTick}px`,
        width: `${duration * pixelsPerTick}px`,
        bottom: `${(pitch - 20) * 4}px`,
        height: '12px',
      }"
    ></div>
  </template>
  
  <script setup lang="ts">
  const props = defineProps<{
    pitch: number;
    startTick: number;
    duration: number;
  }>();
  
  const pixelsPerTick = 0.1;
  </script>
  
  <style scoped>
  .note-block {
    transition: transform 0.05s linear;
  }
  </style>
  