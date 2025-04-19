<template>
  <div class="ukulele-tab-container">
    <canvas ref="canvas" class="tab-canvas"></canvas>
    <div class="debug-info">
      Showing {{ notes.length }} notes
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import * as mm from '@magenta/music';

interface TabNote {
  fret: number;
  string: number;
  position: number;
  isActive: boolean;
}

const props = defineProps<{
  currentNote: mm.NoteSequence.INote | null;
  noteSequence: mm.INoteSequence | null;
  pixelsPerTimeStep: number;
}>();

const strings = [
  { name: 'A', openNote: 69 }, // A4
  { name: 'E', openNote: 64 }, // E4
  { name: 'C', openNote: 60 }, // C4
  { name: 'G', openNote: 67 }  // G4
];

const notes = ref<TabNote[]>([]);
const canvas = ref<HTMLCanvasElement | null>(null);
const ctx = ref<CanvasRenderingContext2D | null>(null);

// Convert MIDI note to ukulele tab position
const getTabPosition = (midiNote: number): { string: number; fret: number } => {
  let bestString = 0;
  let bestFret = 0;
  let minFret = Infinity;

  for (let i = 0; i < strings.length; i++) {
    const fret = midiNote - strings[i].openNote;
    if (fret >= 0 && fret < minFret) {
      minFret = fret;
      bestString = i;
      bestFret = fret;
    }
  }

  return { string: bestString, fret: bestFret };
};

const drawTab = () => {
  if (!canvas.value || !ctx.value) return;

  const canvasWidth = canvas.value.width;
  const canvasHeight = canvas.value.height;
  const lineSpacing = canvasHeight / 5;
  const stringNames = ['A', 'E', 'C', 'G'];
  const leftPadding = 20;

  // Clear canvas
  ctx.value.clearRect(0, 0, canvasWidth, canvasHeight);

  // Draw tab lines
  ctx.value.strokeStyle = '#333';
  ctx.value.lineWidth = 2;
  
  for (let i = 0; i < 4; i++) {
    const y = lineSpacing * (i + 1);
    ctx.value.beginPath();
    ctx.value.moveTo(leftPadding, y);
    ctx.value.lineTo(canvasWidth - 20, y);
    ctx.value.stroke();

    // Draw string name
    ctx.value.fillStyle = '#333';
    ctx.value.font = '16px Arial';
    ctx.value.fillText(stringNames[i], 5, y + 5);
  }

  // Draw notes
  notes.value.forEach(note => {
    const x = note.position + leftPadding;
    const y = lineSpacing * (note.string + 1);
    
    // Draw background circle
    ctx.value.fillStyle = note.isActive ? '#0000ff' : '#ff0000';
    ctx.value.beginPath();
    ctx.value.arc(x, y, 15, 0, Math.PI * 2);
    ctx.value.fill();

    // Draw fret number
    ctx.value.fillStyle = '#ffffff';
    ctx.value.font = 'bold 20px Arial';
    ctx.value.textAlign = 'center';
    ctx.value.textBaseline = 'middle';
    ctx.value.fillText(note.fret.toString(), x, y);
  });
};

// Update tab visualization when note sequence changes
watch(() => props.noteSequence, (newSequence) => {
  if (!newSequence) {
    notes.value = [];
    return;
  }

  notes.value = newSequence.notes.map(note => {
    const { string, fret } = getTabPosition(note.pitch);
    return {
      fret,
      string,
      position: note.startTime * props.pixelsPerTimeStep,
      isActive: false
    };
  });
  drawTab();
}, { immediate: true });

// Update active notes when current note changes
watch(() => props.currentNote, (newNote) => {
  if (!newNote) return;

  notes.value = notes.value.map(note => ({
    ...note,
    isActive: note.position === newNote.startTime * props.pixelsPerTimeStep
  }));
  drawTab();
});

// Initialize canvas
onMounted(() => {
  if (canvas.value) {
    canvas.value.width = canvas.value.offsetWidth;
    canvas.value.height = 200;
    ctx.value = canvas.value.getContext('2d');
    drawTab();
  }
});

// Scroll tab content in sync with staff notation
const scrollToNote = (note: mm.NoteSequence.INote) => {
  if (canvas.value) {
    const position = note.startTime * props.pixelsPerTimeStep;
    canvas.value.scrollLeft = position - canvas.value.clientWidth / 2;
  }
};

defineExpose({
  scrollToNote
});
</script>

<style scoped>
.ukulele-tab-container {
  border: 2px solid #ccc;
  padding: 10px;
  background: #f9f9f9;
  border-radius: 8px;
  max-width: 100%;
  min-height: 200px;
  overflow-x: auto;
  margin-top: 20px;
  position: relative;
}

.tab-canvas {
  width: 100%;
  height: 200px;
}

.debug-info {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(0,0,0,0.1);
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 12px;
}
</style> 