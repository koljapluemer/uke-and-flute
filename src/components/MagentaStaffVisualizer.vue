<template>
    <div class="p-4">
      <h1 class="text-xl font-bold mb-4">🎶 MIDI Staff Visualizer</h1>
      <input type="file" accept=".mid" @change="handleFileUpload" class="mb-4" />
  
      <div class="controls mb-4">
        <button @click="togglePlay" class="btn bg-green-500">{{ isPlaying ? 'Stop' : 'Play' }}</button>
      </div>
  
      <div class="mb-4">
        <label for="speed">Playback Speed: {{ (playbackSpeed * 100).toFixed(0) }}%</label>
        <input
          type="range"
          id="speed"
          min="0.2"
          max="1.5"
          step="0.01"
          v-model="playbackSpeed"
          @input="adjustPlaybackSpeed"
        />
      </div>
  
      <h2 class="text-lg font-semibold mb-2">Current Note: {{ currentNote }}</h2>
      <p class="text-sm text-gray-500">Next Notes: {{ nextNotes.join(', ') }}</p>
  
      <div ref="visualizerContainer" class="visualizer-container"></div>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, watch } from 'vue';
  import * as mm from '@magenta/music';
  
  const currentNote = ref<string>('None');
  const nextNotes = ref<string[]>([]);
  const visualizerContainer = ref<HTMLDivElement | null>(null);
  const isPlaying = ref(false);
  const playbackSpeed = ref(1); // Default speed: 100%
  
  let player: mm.SoundFontPlayer;
  let visualizer: mm.StaffSVGVisualizer | null = null;
  let noteSequence: mm.INoteSequence | null = null;
  
  player = new mm.SoundFontPlayer('https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus', undefined, undefined, undefined, {
    run: (note: mm.NoteSequence.INote) => {
      const currentNoteIndex = noteSequence?.notes.findIndex((n) => n.startTime === note.startTime) || 0;
      currentNote.value = getNoteName(note.pitch);
  
      // Display next two notes
      nextNotes.value = (noteSequence?.notes.slice(currentNoteIndex + 1, currentNoteIndex + 3) || [])
        .map((n) => getNoteName(n.pitch));
  
      visualizer?.redraw(note, true); // Highlight active notes and scroll
    },
    stop: () => {
      isPlaying.value = false;
      currentNote.value = 'None';
      nextNotes.value = [];
      visualizer?.clearActiveNotes();
    }
  });
  
  const handleFileUpload = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result instanceof ArrayBuffer) {
          const midiData = new Uint8Array(e.target.result);
          noteSequence = mm.midiToSequenceProto(midiData);
  
          if (visualizerContainer.value && noteSequence) {
            visualizerContainer.value.innerHTML = ''; // Clear previous visualization
            visualizer = new mm.StaffSVGVisualizer(noteSequence, visualizerContainer.value);
          }
        }
      };
      reader.readAsArrayBuffer(input.files[0]);
    }
  };
  
  const togglePlay = () => {
    if (isPlaying.value) {
      player.stop();
      isPlaying.value = false;
      currentNote.value = 'None';
      nextNotes.value = [];
    } else if (noteSequence) {
      player.start(noteSequence);
      isPlaying.value = true;
    }
  };
  
  const adjustPlaybackSpeed = () => {
    player.setTempo(120 * playbackSpeed.value); // Adjust tempo (assuming default 120 BPM)
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
    cursor: pointer;
  }
  
  .visualizer-container {
    border: 2px solid #ccc;
    padding: 10px;
    background: #f9f9f9;
    border-radius: 8px;
    max-width: 100%;
    min-height: 200px;
    overflow-x: auto;
  }
  
  input[type="range"] {
    width: 100%;
    margin-top: 5px;
  }
  
  .text-sm {
    font-size: 0.85rem;
  }
  </style>
  