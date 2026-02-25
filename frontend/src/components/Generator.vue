<template>
  <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <form @submit.prevent="submit" class="space-y-6">
      <div>
        <label class="block text-sm font-medium text-slate-700">Template DOCX</label>
        <input
          ref="templateInput"
          type="file"
          accept=".docx"
          class="mt-2 block w-full text-sm text-slate-500 file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
          @change="templateFile = $event.target.files?.[0] ?? null"
        />
        <p v-if="templateFile" class="mt-1 text-xs text-slate-500">{{ templateFile.name }}</p>
      </div>

      <div>
        <label class="block text-sm font-medium text-slate-700">Data (CSV or XLSX)</label>
        <input
          ref="dataInput"
          type="file"
          accept=".csv,.xlsx"
          class="mt-2 block w-full text-sm text-slate-500 file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
          @change="dataFile = $event.target.files?.[0] ?? null"
        />
        <p v-if="dataFile" class="mt-1 text-xs text-slate-500">{{ dataFile.name }}</p>
      </div>

      <div>
        <label class="block text-sm font-medium text-slate-700">Output format</label>
        <div class="mt-2 flex flex-wrap gap-4">
          <label class="inline-flex items-center gap-2">
            <input v-model="outputFormat" type="radio" value="docx" class="h-4 w-4 text-slate-800" />
            <span class="text-sm text-slate-700">DOCX only</span>
          </label>
          <label class="inline-flex items-center gap-2">
            <input v-model="outputFormat" type="radio" value="pdf" class="h-4 w-4 text-slate-800" />
            <span class="text-sm text-slate-700">PDF only</span>
          </label>
          <label class="inline-flex items-center gap-2">
            <input v-model="outputFormat" type="radio" value="both" class="h-4 w-4 text-slate-800" />
            <span class="text-sm text-slate-700">Both DOCX and PDF</span>
          </label>
        </div>
        <p class="mt-1 text-xs text-slate-500">
          Each file is named using the first column value in your data. PDF requires LibreOffice on the server.
        </p>
      </div>

      <p class="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
        Column names in your CSV/XLSX must match the placeholders in the template. For example, a
        placeholder <code class="rounded bg-amber-100 px-1">{{ placeholderExample }}</code> in the template
        should have a column named <code class="rounded bg-amber-100 px-1">name</code> in the data
        file. Use UTF-8 encoding for CSV. The first column is used as the output file name for each report.
      </p>

      <div v-if="error" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
        {{ error }}
      </div>

      <button
        type="submit"
        :disabled="!canSubmit || loading"
        class="w-full rounded-md bg-slate-800 px-4 py-3 text-sm font-medium text-white shadow hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span v-if="loading">Generating…</span>
        <span v-else>Generate files</span>
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { generate as generateApi } from "../api.js";

const placeholderExample = "\u007b\u007bname\u007d\u007d";

const templateInput = ref(null);
const dataInput = ref(null);
const templateFile = ref(null);
const dataFile = ref(null);
const outputFormat = ref("docx");
const loading = ref(false);
const error = ref(null);

const canSubmit = computed(() => templateFile.value && dataFile.value && !loading.value);

async function submit() {
  if (!templateFile.value || !dataFile.value || loading.value) return;
  error.value = null;
  loading.value = true;
  try {
    const formData = new FormData();
    formData.append("template", templateFile.value);
    formData.append("data", dataFile.value);
    const blob = await generateApi(formData, { outputFormat: outputFormat.value });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reports.zip";
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    error.value = e.message || "Download failed.";
  } finally {
    loading.value = false;
  }
}
</script>
