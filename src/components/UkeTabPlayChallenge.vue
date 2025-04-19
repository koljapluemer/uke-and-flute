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
        <div class="form-control">
          <label class="label cursor-pointer">
            <span class="label-text mr-2">Loop Song</span>
            <input 
              type="checkbox" 
              v-model="loopSong"
              disabled 
              class="checkbox checkbox-primary"
            />
          </label>
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

    <!-- Tab Sheet View -->
    <div class="tab-container bg-base-200 p-4 rounded-lg mb-8">
      <div class="tab-line font-mono text-lg" v-for="row in 4" :key="row-1">
        <span 
          v-for="(beatGroup, colIndex) in beatsByColumn" 
          :key="colIndex"
          :class="{ 
            'active-char': colIndex === currentPosition,
            'correct-note': beatGroup[row-1].noteThatWasPlayed === beatGroup[row-1].noteToBePlayed,
            'wrong-note': beatGroup[row-1].noteThatWasPlayed && beatGroup[row-1].noteThatWasPlayed !== beatGroup[row-1].noteToBePlayed
          }"
        >
          {{ beatGroup[row-1].value }}
        </span>
      </div>
    </div>

    <!-- Played Notes Table -->
    <PlayedNotesTable :played-notes="playedNotes" />

    <!-- Beat Data Table -->
    <BeatTable 
      :beats="beats"
      :current-position="currentPosition"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import AudioNoteDetector from './AudioNoteDetector.vue';
import BeatTable from './BeatTable.vue';
import PlayedNotesTable from './PlayedNotesTable.vue';
import * as Tone from 'tone';

interface Song {
  id: string;
  title: string;
  tabContent: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Beat {
  value: string;               // The actual character from tab (number or '-')
  tabSheetCoordinateRow: number;
  tabSheetCoordinateCol: number;
  noteLine: 'G' | 'C' | 'E' | 'A';
  beatIndex: number;
  noteToBePlayed: string | null;  // MIDI note name if value is a number
  noteThatWasPlayed: string | null;
  timingDifference: number | null; // ms difference from perfect timing
}

interface PlayedNote {
  timestamp: number;
  notePlayed: string;
  beatIndex: number;
  expectedNote: string | null;
  status: 'correct' | 'wrong-timing' | 'wrong-note';
  timingDifference: number;
}

// MIDI note mapping for ukulele strings (GCEA tuning)
const UKULELE_MIDI_NOTES = {
  'A': 69, // A4
  'E': 64, // E4
  'C': 60, // C4
  'G': 55  // G3
} as const;

const route = useRoute();
const currentSong = ref<Song | null>(null);
const isPlaying = ref(false);
const bpm = ref(120);
const currentPosition = ref(0);
const feedbackMessage = ref('');
const feedbackClass = ref('');
const loopSong = ref(false);
const beats = ref<Beat[]>([]);
const playedNotes = ref<PlayedNote[]>([]);

let playInterval: number | null = null;
let lastNoteTime = 0;
let lastDetectionTime = 0;
let recentDetections: { note: string; frequency: number; amplitude: number; }[] = [];
const DEBOUNCE_WINDOW = 150; // ms to wait before allowing new note detection
const DETECTION_BUFFER_WINDOW = 50; // ms to collect rapid detections

// Convert tab content to Beats array
const initializeBeats = (tabContent: string) => {
  const lines = tabContent.split('\n').filter(line => line.trim());
  const newBeats: Beat[] = [];
  
  for (let col = 0; col < lines[0].length; col++) {
    for (let row = 0; row < lines.length; row++) {
      const value = lines[row][col];
      const noteLine = ['G', 'C', 'E', 'A'][row] as 'G' | 'C' | 'E' | 'A';
      
      let noteToBePlayed: string | null = null;
      if (value >= '0' && value <= '9') {
        const fret = parseInt(value);
        const baseNote = UKULELE_MIDI_NOTES[noteLine];
        const noteNumber = baseNote + fret;
        noteToBePlayed = Tone.Frequency(noteNumber).toNote();
      }
      
      newBeats.push({
        value,
        tabSheetCoordinateRow: row,
        tabSheetCoordinateCol: col,
        noteLine,
        beatIndex: col,
        noteToBePlayed,
        noteThatWasPlayed: null,
        timingDifference: null
      });
    }
  }
  
  beats.value = newBeats;
};

// Group beats by column for rendering
const beatsByColumn = computed(() => {
  const grouped: Beat[][] = [];
  for (let i = 0; i < beats.value.length; i += 4) {
    grouped.push(beats.value.slice(i, i + 4));
  }
  return grouped;
});

const handleNoteDetected = (note: string | null, frequency: number, amplitude: number) => {
  if (!isPlaying.value || !note) return;
  
  const now = Date.now();
  
  // Add to recent detections
  recentDetections.push({ note, frequency, amplitude });
  
  // Only process if we're outside the debounce window
  if (now - lastDetectionTime < DEBOUNCE_WINDOW) {
    return;
  }
  
  // Clear old detections
  recentDetections = recentDetections.filter(d => now - d.timestamp > DETECTION_BUFFER_WINDOW);
  
  // Find the most common note in the recent detections
  const noteCounts = recentDetections.reduce((acc, det) => {
    acc[det.note] = (acc[det.note] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Get the note with highest count and highest average amplitude
  let dominantNote = note;
  let maxCount = 0;
  let maxAmplitude = 0;
  
  Object.entries(noteCounts).forEach(([detectedNote, count]) => {
    const avgAmplitude = recentDetections
      .filter(d => d.note === detectedNote)
      .reduce((sum, d) => sum + d.amplitude, 0) / count;
    
    if (count > maxCount || (count === maxCount && avgAmplitude > maxAmplitude)) {
      dominantNote = detectedNote;
      maxCount = count;
      maxAmplitude = avgAmplitude;
    }
  });
  
  // Clear recent detections
  recentDetections = [];
  lastDetectionTime = now;
  
  const timeSinceLastNote = now - lastNoteTime;
  const expectedTime = (60 * 1000) / bpm.value;
  const timeWindow = expectedTime * 0.5; // More generous 50% time window
  
  // Get current beat group (all notes at current position)
  const currentBeats = beats.value.filter(b => b.beatIndex === currentPosition.value);
  const expectedNotes = currentBeats.map(b => b.noteToBePlayed).filter(Boolean);
  
  // Create played note entry
  const playedNote: PlayedNote = {
    timestamp: now,
    notePlayed: dominantNote,
    beatIndex: currentPosition.value,
    expectedNote: expectedNotes.length > 0 ? expectedNotes[0] : null,
    status: 'wrong-note',
    timingDifference: timeSinceLastNote - expectedTime
  };

  // Update status based on timing and correctness
  if (expectedNotes.includes(dominantNote)) {
    if (Math.abs(timeSinceLastNote - expectedTime) < timeWindow) {
      playedNote.status = 'correct';
    } else {
      playedNote.status = 'wrong-timing';
    }
  }

  playedNotes.value.push(playedNote);
  
  // Update beats with played note and timing
  if (expectedNotes.includes(dominantNote)) {
    currentBeats.forEach(beat => {
      if (beat.noteToBePlayed === dominantNote) {
        beat.noteThatWasPlayed = dominantNote;
        beat.timingDifference = timeSinceLastNote - expectedTime;
      }
    });
    
    feedbackMessage.value = Math.abs(timeSinceLastNote - expectedTime) < timeWindow
      ? 'Correct note!'
      : timeSinceLastNote < expectedTime ? 'Too early, but correct note!' : 'Too late, but correct note!';
    feedbackClass.value = Math.abs(timeSinceLastNote - expectedTime) < timeWindow
      ? 'bg-success text-success-content'
      : 'bg-warning text-warning-content';
  } else {
    currentBeats.forEach(beat => {
      if (beat.noteToBePlayed) {
        beat.noteThatWasPlayed = dominantNote;
        beat.timingDifference = timeSinceLastNote - expectedTime;
      }
    });
    
    feedbackMessage.value = 'Wrong note!';
    feedbackClass.value = 'bg-error text-error-content';
  }
};

const startPlayback = () => {
  // Reset played notes when starting new playback
  playedNotes.value = [];
  beats.value.forEach(beat => {
    beat.noteThatWasPlayed = null;
    beat.timingDifference = null;
  });
  
  const msPerBeat = (60 * 1000) / bpm.value;
  
  playInterval = window.setInterval(() => {
    currentPosition.value++;
    lastNoteTime = Date.now();
    
    // Stop at the end if not looping
    if (currentPosition.value >= beatsByColumn.value.length) {
      if (loopSong.value) {
        currentPosition.value = 0;
      } else {
        stopPlayback();
      }
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
  // Don't reset feedbackState here so colors remain after stopping
};

const togglePlay = () => {
  isPlaying.value = !isPlaying.value;
  
  if (isPlaying.value) {
    startPlayback();
  } else {
    stopPlayback();
  }
};

onMounted(() => {
  const savedSongs = localStorage.getItem('ukeTabs');
  if (savedSongs) {
    const songs = JSON.parse(savedSongs);
    currentSong.value = songs.find((song: any) => song.id === route.params.id);
    if (currentSong.value) {
      initializeBeats(currentSong.value.tabContent);
    }
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
