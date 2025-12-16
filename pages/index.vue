<script setup lang="ts">
import { config } from "node:process";
import { ref, onMounted, onUnmounted ,computed } from "vue";
import type { v } from "vue-router/dist/router-CWoNjPRp.mjs";
import { useSystemStatus } from "~/composables/useSystemStatus";

const { plexStatus, nasReady } = useSystemStatus();

const plexColor = computed(() => {
  if (plexStatus.value?.status === "green") return "green";
  if (plexStatus.value?.status === "yellow") return "yellow";
  return "red";
});
const nasColor = computed(() => (nasReady.value ? "green" : "red"));

type Any = any;

const loading = ref(true);
const error = ref<string | null>(null);
const data = ref<Any | null>(null);
const cfg = ref({});
const status = ref({});

function format(d: string | Date | null | undefined) {
  if (!d) return "–";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year:"numeric"
  });
}

function formatTime(d: string | Date | null | undefined) {
  if (!d) return "–";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

let timer: number | undefined;

async function loadStatus() {
  try {
    data.value = await $fetch("/api/automation/status", { cache: "no-store" });
    cfg.value = await $fetch("/api/config", { cache: "no-store" });
    status.value = await $fetch("/api/automation/status", { cache: "no-store" });
  } catch {
    error.value = "Dashboard konnte nicht geladen werden";
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
loadStatus();

  timer = window.setInterval(() => {
  loadStatus();
}, 10_000); // 10 Sekunden
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<template>
  <v-container>
    <!-- TITLE -->
    <v-row class="mb-4">
      <v-col>
        <h1>NAS Automation</h1>
        <div class="text-medium-emphasis">
          Überblick über Systemzustand und Automatik
        </div>
      </v-col>
    </v-row>

    <!-- LOADING / ERROR -->
    <v-progress-circular v-if="loading" indeterminate />
    <v-alert v-if="error" type="error">{{ error }}</v-alert>

    <template v-if="!loading && !error && data">
      <!-- SYSTEM STATUS -->
      <v-alert class="mb-4" variant="tonal" type="info">
        <strong>{{ data.explanation.title }}</strong><br />
        {{ data.explanation.description }}
      </v-alert>

      <!-- ACTIVE WINDOW -->
      <v-card v-if="data.activeWindow" variant="tonal" class="mb-4">
        <v-card-title>Aktives Zeitfenster</v-card-title>
        <v-card-text>
          <strong>{{ data.activeWindow.label }}</strong><br />
          {{ data.activeWindow.start }} – {{ data.activeWindow.end }}
        </v-card-text>
      </v-card>

      <!-- NEXT EVENT -->
      <v-card variant="tonal" class="mb-4">
        <v-card-title>Nächstes Ereignis</v-card-title>
        <v-card-text>
          <!-- IDLE -->
          <v-alert
            v-if="data.nextEvent.type === 'IDLE'"
            type="info"
            density="compact"
          >
            Kein aktuelles oder kommendes Aufnahmeereignis
          </v-alert>

          <!-- RECORDING RUNNING -->
          <template v-else-if="data.nextEvent.type === 'RECORDING_RUNNING'">
            <v-alert type="success" density="compact" class="mb-2">
              {{ data.nextEvent.count }} Aufnahme<span
                v-if="data.nextEvent.count > 1"
                >n</span
              >
              laufen gerade
            </v-alert>

            <v-table density="compact">
              <tbody>
                <tr
                  v-for="(r, i) in data.nextEvent.recordings"
                  :key="i"
                >
                  <td>{{ r.title }}</td>
                  <td class="text-right">
                    {{ formatTime(r.from) }} – {{ formatTime(r.to) }}
                  </td>
                </tr>
              </tbody>
            </v-table>
          </template>

          <!-- RECORDING START -->
          <v-alert
            v-else-if="data.nextEvent.type === 'RECORDING_START'"
            type="info"
            density="compact"
          >
            Nächste Aufnahme beginnt am
            <strong>{{ format(data.nextEvent.at) }}</strong
            ><br />
            {{ data.nextEvent.title }}
          </v-alert>

          <!-- RECORDING END -->
          <v-alert
            v-else-if="data.nextEvent.type === 'RECORDING_END'"
            type="warning"
            density="compact"
          >
            Aufnahmen im Nachlauf ({{ data.nextEvent.count }})
          </v-alert>
        </v-card-text>
      </v-card>
      <v-card>
        <v-card-text>
          <pre>
{{ new Date() }}
{{ cfg.SCHEDULED_ON_PERIODS }}
{{ status }}
          </pre>
        </v-card-text>
      </v-card>
    </template>
  </v-container>
</template>
