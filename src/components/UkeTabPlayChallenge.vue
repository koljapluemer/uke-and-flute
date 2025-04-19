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

// Note mapping for each string (0-based fret positions)
const STRING_NOTE_MAPPING = {
  'G': ['G', 'G#/Ab', 'A', 'A#/Bb', 'B', 'C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb'],
  'C': ['C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B'],
  'E': ['E', 'F', 'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B', 'C', 'C#/Db', 'D', 'D#/Eb'],
  'A': ['A', 'A#/Bb', 'B', 'C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab']
} as const;

// MIDI note mapping for ukulele strings (GCEA tuning)
const UKULELE_MIDI_NOTES = {
  'G': 67, // G4 (starting note, fret 0)
  'C': 60, // C4 (starting note, fret 0)
  'E': 64, // E4 (starting note, fret 0)
  'A': 69  // A4 (starting note, fret 0)
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
let lastPlayedNote: string | null = null;
let recentDetections: { note: string; frequency: number; amplitude: number; timestamp: number }[] = [];
let isInPluck = false;
let pluckStartTime = 0;
let pluckPeakAmplitude = 0;
let lastAmplitude = 0;

const MIN_DETECTIONS = 2;           // Minimum detections needed to confirm a note
const DETECTION_WINDOW = 100;       // Time window to collect detections for analysis
const NOTE_CHANGE_THRESHOLD = 150;  // Minimum time between different notes
const PLUCK_DECAY_THRESHOLD = 0.7;  // How much amplitude should drop to consider pluck finished
const MIN_PLUCK_AMPLITUDE = 0.01;   // Minimum amplitude to start considering a pluck
const AMPLITUDE_RISE_THRESHOLD = 3; // How many times louder signal needs to be to consider it a new pluck

// Convert tab content to Beats array
const initializeBeats = (tabContent: string) => {
  const lines = tabContent.split('\n').filter(line => line.trim());
  const newBeats: Beat[] = [];
  
  // First, extract the string names from the start of each line
  const stringLines = lines.map(line => {
    const stringName = line[0] as 'G' | 'C' | 'E' | 'A';
    const tabContent = line.slice(1); // Remove the string name
    return { stringName, tabContent };
  });
  
  // Now process each column
  for (let col = 0; col < stringLines[0].tabContent.length; col++) {
    for (let row = 0; row < stringLines.length; row++) {
      const value = stringLines[row].tabContent[col];
      const noteLine = stringLines[row].stringName;
      
      let noteToBePlayed: string | null = null;
      if (value >= '0' && value <= '9') {
        const fret = parseInt(value);
        // Get the note name from the mapping
        const noteName = STRING_NOTE_MAPPING[noteLine][fret % 12];
        // For pitch detection, we'll use the first note name (before the slash)
        const pitchName = noteName.split('/')[0];
        // Calculate the octave adjustment
        const baseOctave = Math.floor(UKULELE_MIDI_NOTES[noteLine] / 12) - 1;
        const newOctave = baseOctave + Math.floor(fret / 12) + 1;
        noteToBePlayed = `${pitchName}${newOctave}`;
        
        // Debug each step of the conversion
        console.log('Note calculation debug:', {
          value,
          noteLine,
          fret,
          fullNoteName: noteName,
          pitchName,
          baseOctave,
          newOctave,
          finalNote: noteToBePlayed
        });
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

  // Pluck detection logic
  const isSignificantRise = amplitude > lastAmplitude * AMPLITUDE_RISE_THRESHOLD;
  
  if (!isInPluck && amplitude > MIN_PLUCK_AMPLITUDE && isSignificantRise) {
    // Start of a new pluck
    isInPluck = true;
    pluckStartTime = now;
    pluckPeakAmplitude = amplitude;
    recentDetections = []; // Clear previous detections
  } else if (isInPluck) {
    // Update peak amplitude if we're still in attack phase
    if (amplitude > pluckPeakAmplitude) {
      pluckPeakAmplitude = amplitude;
    }
    
    // Check if we've decayed enough to end the pluck
    if (amplitude < pluckPeakAmplitude * PLUCK_DECAY_THRESHOLD) {
      isInPluck = false;
      // Process the pluck only after we've seen it decay
      processPluck(now);
    }
  }
  
  // Add to recent detections if we're in a pluck
  if (isInPluck) {
    recentDetections.push({ note, frequency, amplitude, timestamp: now });
  }
  
  lastAmplitude = amplitude;
};

const processPluck = (now: number) => {
  // Remove old detections outside our analysis window
  recentDetections = recentDetections.filter(d => now - d.timestamp <= DETECTION_WINDOW);
  
  // Require minimum detections
  if (recentDetections.length < MIN_DETECTIONS) {
    return;
  }
  
  // If it's a different note, ensure minimum time has passed
  const mostFrequentNote = findDominantNote(recentDetections);
  if (mostFrequentNote !== lastPlayedNote && now - lastDetectionTime < NOTE_CHANGE_THRESHOLD) {
    return;
  }
  
  // Update state
  lastPlayedNote = mostFrequentNote;
  lastDetectionTime = now;
  
  const timeSinceLastNote = now - lastNoteTime;
  const expectedTime = (60 * 1000) / bpm.value;
  const timeWindow = expectedTime * 0.5;
  
  // Get current beat group (all notes at current position)
  const currentBeats = beats.value.filter(b => b.beatIndex === currentPosition.value);
  const expectedNotes = currentBeats.map(b => b.noteToBePlayed).filter(Boolean);
  
  // Create played note entry
  const playedNote: PlayedNote = {
    timestamp: now,
    notePlayed: mostFrequentNote,
    beatIndex: currentPosition.value,
    expectedNote: expectedNotes.length > 0 ? expectedNotes[0] : null,
    status: 'wrong-note',
    timingDifference: timeSinceLastNote - expectedTime
  };

  // Rest of the existing note processing logic...
  if (expectedNotes.includes(mostFrequentNote)) {
    if (Math.abs(timeSinceLastNote - expectedTime) < timeWindow) {
      playedNote.status = 'correct';
    } else {
      playedNote.status = 'wrong-timing';
    }
  }

  playedNotes.value.push(playedNote);
  updateFeedback(playedNote, currentBeats, timeSinceLastNote, expectedTime, timeWindow);
};

const findDominantNote = (detections: typeof recentDetections): string => {
  const noteCounts = new Map<string, { count: number; totalAmplitude: number }>();
  
  detections.forEach(detection => {
    const entry = noteCounts.get(detection.note) || { count: 0, totalAmplitude: 0 };
    entry.count++;
    entry.totalAmplitude += detection.amplitude;
    noteCounts.set(detection.note, entry);
  });
  
  let dominantNote = detections[0].note;
  let maxCount = 0;
  let maxAvgAmplitude = 0;
  
  noteCounts.forEach((data, detectedNote) => {
    const avgAmplitude = data.totalAmplitude / data.count;
    if (data.count > maxCount || (data.count === maxCount && avgAmplitude > maxAvgAmplitude)) {
      dominantNote = detectedNote;
      maxCount = data.count;
      maxAvgAmplitude = avgAmplitude;
    }
  });
  
  return dominantNote;
};

const updateFeedback = (
  playedNote: PlayedNote,
  currentBeats: Beat[],
  timeSinceLastNote: number,
  expectedTime: number,
  timeWindow: number
) => {
  if (playedNote.status === 'correct' || playedNote.status === 'wrong-timing') {
    currentBeats.forEach(beat => {
      if (beat.noteToBePlayed === playedNote.notePlayed) {
        beat.noteThatWasPlayed = playedNote.notePlayed;
        beat.timingDifference = timeSinceLastNote - expectedTime;
      }
    });
    
    feedbackMessage.value = playedNote.status === 'correct'
      ? 'Correct note!'
      : timeSinceLastNote < expectedTime ? 'Too early, but correct note!' : 'Too late, but correct note!';
    feedbackClass.value = playedNote.status === 'correct'
      ? 'bg-success text-success-content'
      : 'bg-warning text-warning-content';
  } else {
    currentBeats.forEach(beat => {
      if (beat.noteToBePlayed) {
        beat.noteThatWasPlayed = playedNote.notePlayed;
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
