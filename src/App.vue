<script setup lang="ts">
import { useRoute } from 'vue-router';
import { RouterLink, RouterView } from 'vue-router';

const route = useRoute();
</script>

<template>
  <div class="min-h-screen bg-base-100">
    <!-- Header -->
    <header class="bg-base-200 shadow-md">
      <div class="container mx-auto px-4 py-4">
        <nav class="flex items-center justify-between">
          <h1 class="text-2xl font-bold">Uke & Flute</h1>
          <div class="flex gap-4">
            <RouterLink :to="{ name: 'tab-management' }" class="btn btn-ghost">
              Tab Management
            </RouterLink>
          </div>
        </nav>
      </div>
    </header>

    <!-- Main Content -->
    <main class="container mx-auto px-4 py-8">
      <RouterView />
    </main>
  </div>
</template>

<style>
.container {
  max-width: 1200px;
  margin: 0 auto;
}
</style>

