<template>
    <div class="p-4">
      <h1 class="text-xl font-bold mb-4">🎶 MIDI Staff Visualizer</h1>
      <input type="file" accept=".mid" @change="handleFileUpload" class="mb-4" />
  
      <div class="controls mb-4">
        <button @click="play" class="btn bg-green-500">Play</button>
        <button @click="pause" class="btn bg-yellow-500">Pause</button>
        <button @click="stop" class="btn bg-red-500">Stop</button>
      </div>
  
      <h2 class="text-lg font-semibold mb-2">Current Note: {{ currentNote }}</h2>
      <div ref="visualizerContainer" class="visualizer"></div>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref } from 'vue';
  import * as mm from '@magenta/music';
  
  const currentNote = ref<string>('None');
  const visualizerContainer = ref<HTMLDivElement | null>(null);
  
  let player: mm.Player | null = null;
  let visualizer: mm.StaffSVGVisualizer | null = null;
  let noteSequence: mm.INoteSequence | null = null;
  
  const handleFileUpload = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result instanceof ArrayBuffer) {
          const midiData = new Uint8Array(e.target.result);
          noteSequence = mm.midiToSequenceProto(midiData);  // Correct method
  
          // Initialize the visualizer
          if (visualizerContainer.value && noteSequence) {
            visualizerContainer.value.innerHTML = ''; // Clear previous visualizer
            visualizer = new mm.StaffSVGVisualizer(noteSequence, visualizerContainer.value);
          }
  
          // Initialize the player
          player = new mm.Player();
          player.callbackObject = {
            run: (note: mm.NoteSequence.INote) => {
              if (note.pitch) {
                currentNote.value = getNoteName(note.pitch);
                visualizer?.redraw(noteSequence!, note.startTime);
              }
            },
          };
        }
      };
      reader.readAsArrayBuffer(input.files[0]);
    }
  };
  
  const play = () => {
    if (noteSequence && player) {
      player.start(noteSequence);
    }
  };
  
  const pause = () => {
    if (player) player.pause();
  };
  
  const stop = () => {
    if (player) {
      player.stop();
      currentNote.value = 'None';
    }
  };
  
  const getNoteName = (pitch: number) => {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const note = noteNames[pitch % 12];
    const octave = Math.floor(pitch / 12) - 1;
    return `${note}${octave}`;
  };
  </script>
  
  <style scoped>
  .btn {
    padding: 0.5rem 1rem;
    color: white;
    margin-right: 0.5rem;
    border-radius: 0.25rem;
    transition: background-color 0.3s;
  }
  
  .visualizer {
    border: 2px solid #ccc;
    padding: 10px;
    overflow-x: auto;
    background: #f9f9f9;
    border-radius: 8px;
    max-width: 100%;
    min-height: 200px;
  }
  </style>
  