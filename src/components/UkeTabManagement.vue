<template>
  <div class="p-4">
    <h1 class="text-2xl font-bold mb-6">Ukulele Tab Management</h1>

    <div class="flex flex-col gap-8">
      <!-- Song List -->
      <div class="w-full">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold">Your Songs</h2>
          <button @click="resetForm" class="btn btn-primary">
            <i class="fas fa-plus mr-2"></i>New Song
          </button>
        </div>

        <div class="grid gap-4">
          <div v-for="song in songs" :key="song.id" class="card bg-base-200">
            <div class="card-body">
              <div class="flex justify-between items-start">
                <div>
                  <h3 class="card-title">{{ song.title }}</h3>
                  <p class="text-sm text-base-content/70">Last modified: {{ formatDate(song.updatedAt) }}</p>
                </div>
                <div class="flex gap-2">
                  <RouterLink 
                    :to="{ name: 'tab-play', params: { id: song.id }}" 
                    class="btn btn-primary btn-sm"
                  >
                    <i class="fas fa-play mr-1"></i>Play
                  </RouterLink>
                  <button @click="editSong(song)" class="btn btn-secondary btn-sm">
                    <i class="fas fa-edit"></i>Edit
                  </button>
                  <button @click="deleteSong(song.id)" class="btn btn-error btn-sm">
                    <i class="fas fa-trash"></i>Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Song Editor -->
      <div class="card bg-base-200 w-full">
        <div class="card-body">
          <h2 class="card-title mb-4">{{ editingSong ? 'Edit Song' : 'New Song' }}</h2>
          
          <form @submit.prevent="saveSong" class="space-y-4 w-full">
            <div class="form-control w-full">
              <label class="label">
                <span class="label-text">Song Title</span>
              </label>
              <input 
                type="text" 
                v-model="currentSong.title" 
                class="input input-bordered w-full" 
                placeholder="Enter song title"
                required
              />
            </div>

            <div class="form-control w-full">
              <label class="label">
                <span class="label-text">Tab Content</span>
              </label>
              <div class="w-full overflow-x-auto">
                <textarea 
                  v-model="currentSong.tabContent" 
                  class="textarea textarea-bordered h-96 font-mono text-lg w-full min-w-[800px]" 
                  placeholder="Paste your tab here..."
                  @input="validateTab"
                  required
                ></textarea>
              </div>
              <label class="label" v-if="tabError">
                <span class="label-text-alt text-error">{{ tabError }}</span>
              </label>
            </div>

            <div class="flex justify-end gap-2">
              <button 
                type="button" 
                @click="resetForm" 
                class="btn"
              >
                Clear
              </button>
              <button 
                type="submit" 
                class="btn btn-primary"
                :disabled="!!tabError"
              >
                {{ editingSong ? 'Save Changes' : 'Create Song' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, RouterLink } from 'vue-router';

interface Song {
  id: string;
  title: string;
  tabContent: string;
  createdAt: Date;
  updatedAt: Date;
}

const songs = ref<Song[]>([]);
const editingSong = ref<Song | null>(null);
const currentSong = ref<Partial<Song>>({ title: '', tabContent: '' });
const tabError = ref<string | null>(null);
const router = useRouter();

// Load songs from localStorage on mount
onMounted(() => {
  const savedSongs = localStorage.getItem('ukeTabs');
  if (savedSongs) {
    songs.value = JSON.parse(savedSongs).map((song: any) => ({
      ...song,
      createdAt: new Date(song.createdAt),
      updatedAt: new Date(song.updatedAt)
    }));
  }
});

const validateTab = (event: Event) => {
  const textarea = event.target as HTMLTextAreaElement;
  const content = textarea.value;
  
  // Split into stanzas
  const stanzas = content.split('\n\n').filter(s => s.trim());
  
  for (const stanza of stanzas) {
    const lines = stanza.split('\n').filter(l => l.trim());
    if (lines.length !== 4) {
      tabError.value = 'Each stanza must have exactly 4 lines (one for each string)';
      return;
    }
    
    // Check if all lines in stanza have same length
    const firstLineLength = lines[0].length;
    for (const line of lines) {
      if (line.length !== firstLineLength) {
        tabError.value = 'All lines in a stanza must have the same length';
        return;
      }
    }
  }
  
  tabError.value = null;
};

const saveSong = () => {
  if (!currentSong.value.title || !currentSong.value.tabContent) return;
  
  const now = new Date();
  const song: Song = {
    id: editingSong.value?.id || crypto.randomUUID(),
    title: currentSong.value.title,
    tabContent: currentSong.value.tabContent,
    createdAt: editingSong.value?.createdAt || now,
    updatedAt: now
  };

  if (editingSong.value) {
    const index = songs.value.findIndex(s => s.id === song.id);
    songs.value[index] = song;
  } else {
    songs.value.push(song);
  }

  localStorage.setItem('ukeTabs', JSON.stringify(songs.value));
  resetForm();
};

const editSong = (song: Song) => {
  editingSong.value = song;
  currentSong.value = { ...song };
};

const deleteSong = (id: string) => {
  if (confirm('Are you sure you want to delete this song?')) {
    songs.value = songs.value.filter(song => song.id !== id);
    localStorage.setItem('ukeTabs', JSON.stringify(songs.value));
  }
};

const resetForm = () => {
  editingSong.value = null;
  currentSong.value = { title: '', tabContent: '' };
  tabError.value = null;
};

const formatDate = (date: Date) => {
  return new Date(date).toLocaleDateString();
};

const playSong = (song: Song) => {
  router.push(`/play/${song.id}`);
};
</script>

<style scoped>
.textarea {
  font-family: monospace;
  white-space: pre;
  overflow-x: auto;
  resize: both;
  min-width: 800px;
}

.card {
  width: 100%;
  max-width: 100%;
}
</style>
