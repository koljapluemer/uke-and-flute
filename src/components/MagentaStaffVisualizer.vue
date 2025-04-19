<template>
    <div class="p-4">
      <h1 class="text-xl font-bold mb-4">🎶 MIDI Staff Visualizer</h1>
      
      <!-- File Manager Component -->
      <div class="card bg-base-200 shadow-xl mb-4">
        <div class="card-body">
          <div v-if="!currentFileName" class="text-center">
            <p class="text-base-content/70 mb-4">No MIDI file loaded</p>
            <input type="file" accept=".mid" @change="handleFileUpload" class="file-input file-input-bordered file-input-primary w-full" />
          </div>
          
          <div v-else class="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div class="flex-1">
              <p class="text-sm text-base-content/70">Currently loaded:</p>
              <p class="font-medium text-lg">{{ currentFileName }}</p>
            </div>
            <div class="flex gap-2">
              <button @click="clearFile" class="btn btn-error">Clear</button>
              <button @click="replaceFile" class="btn btn-primary">Replace</button>
            </div>
          </div>
        </div>
      </div>
  
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
  import { ref, watch, onMounted } from 'vue';
  import * as mm from '@magenta/music';
  
  const currentNote = ref<string>('None');
  const nextNotes = ref<string[]>([]);
  const visualizerContainer = ref<HTMLDivElement | null>(null);
  const isPlaying = ref(false);
  const playbackSpeed = ref(1); // Default speed: 100%
  const currentFileName = ref<string>('');
  
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
      const fileName = input.files[0].name;
      currentFileName.value = fileName;
      localStorage.setItem('currentFileName', fileName);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result instanceof ArrayBuffer) {
          const midiData = new Uint8Array(e.target.result);
          localStorage.setItem('cachedMidiData', JSON.stringify(Array.from(midiData)));
          noteSequence = mm.midiToSequenceProto(midiData);
  
          if (visualizerContainer.value && noteSequence) {
            visualizerContainer.value.innerHTML = '';
            visualizer = new mm.StaffSVGVisualizer(noteSequence, visualizerContainer.value, {
              noteHeight: 24,
              noteSpacing: 24,
              pixelsPerTimeStep: 300,
              noteRGB: '8, 41, 64',
              activeNoteRGB: '0, 0, 0'
            });
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
  
  // Load cached MIDI data on component mount
  onMounted(() => {
    const cachedFileName = localStorage.getItem('currentFileName');
    if (cachedFileName) {
      currentFileName.value = cachedFileName;
    }
    
    const cachedMidiData = localStorage.getItem('cachedMidiData');
    if (cachedMidiData) {
      const midiData = new Uint8Array(JSON.parse(cachedMidiData));
      noteSequence = mm.midiToSequenceProto(midiData);
      
      if (visualizerContainer.value && noteSequence) {
        visualizerContainer.value.innerHTML = '';
        visualizer = new mm.StaffSVGVisualizer(noteSequence, visualizerContainer.value, {
          noteHeight: 24,
          noteSpacing: 24,
          pixelsPerTimeStep: 300,
          noteRGB: '8, 41, 64',
          activeNoteRGB: '0, 0, 0'
        });
      }
    }
  });
  
  const clearFile = () => {
    localStorage.removeItem('cachedMidiData');
    localStorage.removeItem('currentFileName');
    currentFileName.value = '';
    noteSequence = null;
    if (visualizerContainer.value) {
      visualizerContainer.value.innerHTML = '';
    }
    if (isPlaying.value) {
      player.stop();
      isPlaying.value = false;
    }
  };
  
  const replaceFile = () => {
    clearFile();
    // Trigger file input click
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
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
  