<template>
  <div class="overflow-x-auto mb-8">
    <h3 class="text-lg font-semibold mb-4">Played Notes Timeline</h3>
    <table class="table table-zebra w-full">
      <thead>
        <tr>
          <th>Time</th>
          <th>Note Played</th>
          <th>Beat Window</th>
          <th>Expected Note</th>
          <th>Status</th>
          <th>Timing</th>
        </tr>
      </thead>
      <tbody>
        <tr 
          v-for="(note, index) in playedNotes" 
          :key="index"
          :class="{
            'text-success': note.status === 'correct',
            'text-warning': note.status === 'wrong-timing',
            'text-error': note.status === 'wrong-note'
          }"
        >
          <td class="font-mono">{{ formatTimestamp(note.timestamp) }}</td>
          <td>{{ note.notePlayed }}</td>
          <td>{{ note.beatIndex + 1 }}</td>
          <td>{{ note.expectedNote || '-' }}</td>
          <td>
            <span class="badge" :class="{
              'badge-success': note.status === 'correct',
              'badge-warning': note.status === 'wrong-timing',
              'badge-error': note.status === 'wrong-note'
            }">
              {{ formatStatus(note.status) }}
            </span>
          </td>
          <td>
            <template v-if="note.timingDifference !== null">
              <span :class="{
                'text-success': Math.abs(note.timingDifference) <= 100,
                'text-warning': Math.abs(note.timingDifference) > 100
              }">
                {{ formatTiming(note.timingDifference) }}
              </span>
            </template>
          </td>
        </tr>
        <tr v-if="playedNotes.length === 0">
          <td colspan="6" class="text-center text-gray-500">No notes played yet</td>
        </tr>
      </tbody>
      <tfoot v-if="playedNotes.length > 0">
        <tr class="font-semibold">
          <td colspan="4">Summary</td>
          <td colspan="2">
            Correct: {{ stats.correct }},
            Wrong Timing: {{ stats.wrongTiming }},
            Wrong Notes: {{ stats.wrongNote }}
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface PlayedNote {
  timestamp: number;
  notePlayed: string;
  beatIndex: number;
  expectedNote: string | null;
  status: 'correct' | 'wrong-timing' | 'wrong-note';
  timingDifference: number;
}

const props = defineProps<{
  playedNotes: PlayedNote[];
}>();

const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  });
};

const formatStatus = (status: PlayedNote['status']) => {
  switch (status) {
    case 'correct': return 'Correct';
    case 'wrong-timing': return 'Wrong Timing';
    case 'wrong-note': return 'Wrong Note';
  }
};

const formatTiming = (diff: number) => {
  const abs = Math.abs(diff);
  if (abs <= 100) return `${diff.toFixed(0)}ms (Good)`;
  return `${diff.toFixed(0)}ms (${diff < 0 ? 'Early' : 'Late'})`;
};

const stats = computed(() => {
  return {
    correct: props.playedNotes.filter(n => n.status === 'correct').length,
    wrongTiming: props.playedNotes.filter(n => n.status === 'wrong-timing').length,
    wrongNote: props.playedNotes.filter(n => n.status === 'wrong-note').length
  };
});
</script> 