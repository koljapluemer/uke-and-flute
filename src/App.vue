<script setup lang="ts">
import { useViewManager } from './components/manageView';
import { Suspense } from 'vue';

const { views, currentView, setView } = useViewManager();
</script>

<template>
  <div class="min-h-screen bg-base-100">
    <!-- Header -->
    <header class="bg-base-200 shadow-md">
      <div class="container mx-auto px-4 py-4">
        <nav class="flex items-center justify-between">
          <h1 class="text-2xl font-bold">Uke & Flute</h1>
          <div class="flex gap-4">
            <button
              v-for="view in views"
              :key="view.id"
              @click="setView(view.id)"
              class="btn btn-ghost"
              :class="{ 'btn-primary': currentView.id === view.id }"
            >
              {{ view.name }}
            </button>
          </div>
        </nav>
      </div>
    </header>

    <!-- Main Content -->
    <main class="container mx-auto px-4 py-8">
      <Suspense>
        <component :is="currentView.component" />
      </Suspense>
    </main>
  </div>
</template>

<style>
.container {
  max-width: 1200px;
  margin: 0 auto;
}
</style>

