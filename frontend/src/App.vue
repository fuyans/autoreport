<template>
  <div class="min-h-screen bg-slate-50">
    <header class="border-b border-slate-200 bg-white shadow-sm">
      <div class="mx-auto max-w-2xl px-4 py-6">
        <h1 class="text-2xl font-semibold text-slate-800">Batch DOCX Generator</h1>
        <p class="mt-1 text-sm text-slate-500">
          Upload a template DOCX and a CSV or XLSX file to generate one document per row.
        </p>
      </div>
    </header>
    <main class="mx-auto max-w-2xl px-4 py-8">
      <Generator />
    </main>
  </div>
</template>

<script setup>
import Generator from "./components/Generator.vue";
</script>
