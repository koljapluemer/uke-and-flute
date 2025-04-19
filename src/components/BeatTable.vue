<template>
  <div class="overflow-x-auto">
    <div class="flex justify-end mb-4">
      <label class="label cursor-pointer">
        <span class="label-text mr-2">Hide empty beats</span>
        <input 
          type="checkbox" 
          v-model="hideEmptyBeats"
          class="checkbox checkbox-primary"
        />
      </label>
    </div>
    
    <table class="table table-zebra w-full">
      <thead>
        <tr>
          <th>Beat</th>
          <th>String</th>
          <th>Value</th>
          <th>Expected Note</th>
          <th>Played Note</th>
          <th>Timing Difference</th>
        </tr>
      </thead>
      <tbody>
        <tr 
          v-for="beat in filteredBeats" 
          :key="`${beat.tabSheetCoordinateRow}-${beat.tabSheetCoordinateCol}`"
          :class="{
            'bg-base-200': beat.beatIndex === currentPosition,
            'text-success': beat.noteThatWasPlayed === beat.noteToBePlayed,
            'text-error': beat.noteThatWasPlayed && beat.noteThatWasPlayed !== beat.noteToBePlayed
          }"
        >
          <td>{{ beat.beatIndex + 1 }}</td>
          <td>{{ beat.noteLine }}</td>
          <td>{{ beat.value }}</td>
          <td>{{ beat.noteToBePlayed || '-' }}</td>
          <td>{{ beat.noteThatWasPlayed || '-' }}</td>
          <td>
            <template v-if="beat.timingDifference !== null">
              {{ Math.round(beat.timingDifference) }}ms
              {{ beat.timingDifference < -100 ? '(Early)' : beat.timingDifference > 100 ? '(Late)' : '(Good)' }}
            </template>
            <template v-else>-</template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface Beat {
  value: string;
  tabSheetCoordinateRow: number;
  tabSheetCoordinateCol: number;
  noteLine: 'G' | 'C' | 'E' | 'A';
  beatIndex: number;
  noteToBePlayed: string | null;
  noteThatWasPlayed: string | null;
  timingDifference: number | null;
}

const props = defineProps<{
  beats: Beat[];
  currentPosition: number;
}>();

const hideEmptyBeats = ref(false);

const filteredBeats = computed(() => {
  if (!hideEmptyBeats.value) return props.beats;
  return props.beats.filter(beat => beat.noteToBePlayed !== null);
});
</script> 