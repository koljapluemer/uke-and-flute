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

    <AudioNoteDetector 
      class="mb-6" 
      :auto-start="isPlaying"
      @note-detected="handleNoteDetected"
    />

    <div class="feedback mb-4 p-4 rounded-lg" :class="feedbackClass">
      {{ feedbackMessage }}
    </div>

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
            :class="{ 
              'active-char': charIndex === currentPosition,
              'correct-note': lastDetectedNote && isCorrectNote(char, charIndex),
              'wrong-note': lastDetectedNote && isWrongNote(char, charIndex)
            }"
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
import * as Tone from 'tone';

interface Song {
  id: string;
  title: string;
  tabContent: string;
  createdAt: Date;
  updatedAt: Date;
}

// MIDI note mapping for ukulele strings (GCEA tuning)
const UKULELE_MIDI_NOTES = {
  'A': 69, // A4
  'E': 64, // E4
  'C': 60, // C4
  'G': 55  // G3
};

const route = useRoute();
const currentSong = ref<Song | null>(null);
const isPlaying = ref(false);
const bpm = ref(120);
const currentPosition = ref(0);
const feedbackMessage = ref('');
const feedbackClass = ref('');
let playInterval: number | null = null;
let lastNoteTime = 0;
let expectedNotes: string[] = [];

// Add feedback state tracking
interface NoteFeedback {
  isCorrect: boolean;
  timestamp: number;
}

const feedbackState = ref<Record<number, NoteFeedback>>({});

const tabStanzas = computed(() => {
  if (!currentSong.value?.tabContent) return [];
  return currentSong.value.tabContent
    .split('\n\n')
    .map(stanza => stanza.split('\n').filter(line => line.trim()));
});

// Get the expected note for a given position
const getExpectedNote = (char: string, stringName: string): string | null => {
  if (char >= '0' && char <= '9') {
    const fret = parseInt(char);
    const baseNote = UKULELE_MIDI_NOTES[stringName as keyof typeof UKULELE_MIDI_NOTES];
    const noteNumber = baseNote + fret;
    return Tone.Frequency(noteNumber).toNote();
  }
  return null;
};

const lastDetectedNote = ref<string | null>(null);

const isCorrectNote = (char: string, charIndex: number) => {
  // Return stored feedback state if it exists
  if (feedbackState.value[charIndex]?.isCorrect) {
    return true;
  }

  // Only check current position for active highlighting
  if (charIndex !== currentPosition.value) return false;
  if (!lastDetectedNote.value) return false;
  
  const lineIndex = Math.floor(charIndex / 4);
  const stringName = ['G', 'C', 'E', 'A'][lineIndex];
  
  if (char >= '0' && char <= '9') {
    const expectedNote = getExpectedNote(char, stringName);
    return expectedNote === lastDetectedNote.value;
  }
  
  return false;
};

const isWrongNote = (char: string, charIndex: number) => {
  // Return stored feedback state if it exists
  if (feedbackState.value[charIndex]?.isCorrect === false) {
    return true;
  }

  // Only check current position for active highlighting
  if (charIndex !== currentPosition.value) return false;
  if (!lastDetectedNote.value) return false;
  
  const lineIndex = Math.floor(charIndex / 4);
  const stringName = ['G', 'C', 'E', 'A'][lineIndex];
  
  if (char >= '0' && char <= '9') {
    const expectedNote = getExpectedNote(char, stringName);
    return expectedNote !== null && expectedNote !== lastDetectedNote.value;
  }
  
  return false;
};

const handleNoteDetected = (note: string | null, frequency: number) => {
  lastDetectedNote.value = note;
  
  if (!isPlaying.value) return;
  
  const now = Date.now();
  const timeSinceLastNote = now - lastNoteTime;
  const expectedTime = (60 * 1000) / bpm.value;
  const timeWindow = expectedTime * 0.5; // More generous 50% time window
  
  // Check if we're in the right time window (±50% of expected time)
  const isInTimeWindow = Math.abs(timeSinceLastNote - expectedTime) < timeWindow;
  
  if (note) {
    // Check if the note matches any of the expected notes
    const isCorrect = expectedNotes.includes(note);
    
    // Store feedback state for current position
    if (isCorrect) {
      feedbackState.value[currentPosition.value] = {
        isCorrect: true,
        timestamp: now
      };
      feedbackMessage.value = isInTimeWindow ? 'Correct note!' : (
        timeSinceLastNote < expectedTime * 0.5 ? 'Too early, but correct note!' : 'Too late, but correct note!'
      );
      feedbackClass.value = isInTimeWindow ? 'bg-success text-success-content' : 'bg-warning text-warning-content';
    } else {
      feedbackState.value[currentPosition.value] = {
        isCorrect: false,
        timestamp: now
      };
      feedbackMessage.value = 'Wrong note!';
      feedbackClass.value = 'bg-error text-error-content';
    }
  }
};

const togglePlay = () => {
  isPlaying.value = !isPlaying.value;
  
  if (isPlaying.value) {
    startPlayback();
  } else {
    stopPlayback();
  }
};

const startPlayback = () => {
  // Reset feedback state when starting new playback
  feedbackState.value = {};
  
  // Calculate milliseconds per beat based on BPM
  const msPerBeat = (60 * 1000) / bpm.value;
  
  playInterval = window.setInterval(() => {
    currentPosition.value++;
    lastNoteTime = Date.now();
    
    // Get expected notes for current position
    expectedNotes = [];
    const currentStanza = tabStanzas.value[0]; // For now, just use first stanza
    currentStanza.forEach((line, index) => {
      const stringName = ['G', 'C', 'E', 'A'][index];
      const char = line[currentPosition.value];
      const expectedNote = getExpectedNote(char, stringName);
      if (expectedNote) {
        expectedNotes.push(expectedNote);
      }
    });
    
    // Reset position when reaching the end of the first line
    if (currentPosition.value >= tabStanzas.value[0][0].length) {
      currentPosition.value = 0;
      // Optionally reset feedback state when looping
      // feedbackState.value = {};
    }
  }, msPerBeat);
};

const stopPlayback = () => {
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
  }
  currentPosition.value = 0;
  feedbackMessage.value = '';
  feedbackClass.value = '';
  expectedNotes = [];
  // Don't reset feedbackState here so colors remain after stopping
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
  color: #3b82f6; /* blue-500 */
  font-weight: bold;
  position: relative;
}

.active-char::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -2px;
  height: 2px;
  background-color: #3b82f6; /* blue-500 */
}

.correct-note {
  color: #22c55e; /* green-500 */
  font-weight: bold;
}

.wrong-note {
  color: #ef4444; /* red-500 */
  font-weight: bold;
  text-decoration: underline;
}

.input {
  text-align: center;
}

.feedback {
  transition: all 0.3s ease;
}
</style>
