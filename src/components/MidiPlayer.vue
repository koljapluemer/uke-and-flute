<template>
    <div class="p-4">
      <h1 class="text-xl font-bold mb-4">MIDI Visualizer 🎵</h1>
      <input type="file" accept=".mid" @change="handleFileChange" class="mb-4" />
      <div>
        <button @click="play" class="btn bg-green-500">Play</button>
        <button @click="pause" class="btn bg-yellow-500">Pause</button>
        <button @click="stop" class="btn bg-red-500">Stop</button>
      </div>
      <NoteVisualizer :notes="notes" :currentTick="currentTick" />
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref } from 'vue';
  import MIDIPlayer from 'midi-player-js';
  import NoteVisualizer from './NoteVisualizer.vue';
  
  interface NoteEvent {
    pitch: number;
    startTick: number;
    duration: number;
    velocity: number;
  }
  
  const notes = ref<NoteEvent[]>([]);
  const currentTick = ref(0);
  
  const player = new MIDIPlayer.Player((event) => {
    currentTick.value = event.tick;
  
    if (event.name === 'Note on' && event.velocity > 0) {
      notes.value.push({
        pitch: event.noteNumber,
        startTick: event.tick,
        duration: 0,
        velocity: event.velocity,
      });
    }
  
    if (event.name === 'Note off' || (event.name === 'Note on' && event.velocity === 0)) {
      const note = notes.value.find((n) => n.pitch === event.noteNumber && n.duration === 0);
      if (note) note.duration = event.tick - note.startTick;
    }
  });
  
  const handleFileChange = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result instanceof ArrayBuffer) {
          player.loadArrayBuffer(new Uint8Array(e.target.result));
        }
      };
      reader.readAsArrayBuffer(input.files[0]);
    }
  };
  
  const play = () => player.play();
  const pause = () => player.pause();
  const stop = () => {
    player.stop();
    currentTick.value = 0;
  };
  </script>
  
  <style scoped>
  .btn {
    padding: 0.5rem 1rem;
    color: white;
    margin-right: 0.5rem;
    border-radius: 0.25rem;
  }
  </style>
  