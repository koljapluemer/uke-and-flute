<template>
    <div class="p-4">
      <h1 class="text-xl font-bold mb-4">MIDI Player Example</h1>
      <input type="file" accept=".mid" @change="handleFileChange" class="mb-4" />
      <div>
        <button @click="play" class="px-4 py-2 bg-green-500 text-white rounded mr-2">Play</button>
        <button @click="pause" class="px-4 py-2 bg-yellow-500 text-white rounded mr-2">Pause</button>
        <button @click="stop" class="px-4 py-2 bg-red-500 text-white rounded">Stop</button>
      </div>
      <div v-if="currentEvent" class="mt-4">
        <p><strong>Current Event:</strong> {{ currentEvent }}</p>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref } from 'vue';
  import MIDIPlayer from 'midi-player-js';
  
  const player = new MIDIPlayer.Player((event) => {
    currentEvent.value = JSON.stringify(event);
  });
  
  const currentEvent = ref<string | null>(null);
  
  const handleFileChange = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
  
      reader.onload = (e) => {
        const arrayBuffer = e.target?.result;
        if (arrayBuffer instanceof ArrayBuffer) {
          const byteArray = new Uint8Array(arrayBuffer);
          player.loadArrayBuffer(byteArray);
        }
      };
  
      reader.readAsArrayBuffer(file);
    }
  };
  
  const play = () => {
    player.play();
  };
  
  const pause = () => {
    player.pause();
  };
  
  const stop = () => {
    player.stop();
    currentEvent.value = null;
  };
  </script>
  
  <style scoped>
  button {
    transition: background-color 0.3s ease;
  }
  button:hover {
    opacity: 0.9;
  }
  </style>
  