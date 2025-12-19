<script setup lang="ts">
import { ref, onMounted, watch } from "vue";

const data = ref<any | null>(null);
const debugData = ref<any | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

/**
 * v-expansion-panels erwartet ein Array (mehrere Panels möglich)
 */
const debugPanels = ref<number[]>([]);

async function load(debug = false) {
  try {
    const url = "/api/automation/status";
    const res = await $fetch(url, { cache: "no-store" });
    data.value = res;
  } catch {
    error.value = "Dashboard konnte nicht geladen werden";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  load();
  setInterval(load, 10_000);
});

/**
 * Lazy Debug Fetch – erst wenn Panel geöffnet wird
 */
watch(debugPanels, (panels) => {
  if (panels.length > 0 && !debugData.value) {
    load(true);
  }
});

function format(d: string | Date | null | undefined) {
  if (!d) return "–";
  return new Date(d).toLocaleString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
</script>

<template>
  <v-container>
    <h1 class="mb-1">NAS Automation</h1>

    <v-progress-circular v-if="loading" indeterminate />
    <v-alert v-else-if="error" type="error">{{ error }}</v-alert>

    <template v-else-if="data">
      <!-- AUTOMATION -->
      <v-card class="mb-4" :color="data.automation.uiVariant" variant="tonal">
        <v-card-title>Automatik</v-card-title>
        <v-card-text>
          <strong>{{ data.automation.state }}</strong
          ><br />
          Seit {{ format(data.automation.since) }} ({{
            data.automation.sinceHuman
          }})
        </v-card-text>
      </v-card>

      <!-- COUNTS -->
      <v-card class="mb-4">
        <v-card-title>Übersicht</v-card-title>
        <v-card-text>
          <table style="width: 50%">
            <tr>
              <th style="width: 40%; text-align: left">Typ</th>
              <th style="width: 30%; text-align: left">laufend</th>
              <th style="width: 30%; text-align: left">geplant</th>
            </tr>
            <tr>
              <td>Aufnahmen</td>
              <td>{{ data.counts.recordingsRunning }}</td>
              <td>{{ data.counts.recordingsUpcoming }}</td>
            </tr>
            <tr>
              <td>Zeitfenster</td>
              <td>{{ data.counts.windowsActive }}</td>
              <td>{{ data.counts.windowsTotal }}</td>
            </tr>
          </table>
        </v-card-text>
      </v-card>

      <!-- WHY (nur wenn aktiv) -->
      <v-card v-if="data.why.active" class="mb-4">
        <v-card-title>Aktiv</v-card-title>
        <v-card-text>
          <ul>
            <div v-for="(r, i) in data.why.reasons" :key="i">
              {{ r }}
            </div>
          </ul>
        </v-card-text>
      </v-card>

      <!-- NEXT -->
      <v-card class="mb-4">
        <v-card-title>Nächste Ereignisse</v-card-title>
        <v-card-text>
          <div v-if="data.next.window">
            Zeitfenster:
            {{ data.next.window.label }} |
            {{ format(data.next.window.at) }}
            ({{ data.next.window.inHuman }})
          </div>

          <div v-if="data.next.recording" class="mt-1">
            Aufnahme:
            {{ data.next.recording.title }} |
            {{ format(data.next.recording.at) }}
            ({{ data.next.recording.inHuman }})
          </div>

          <div class="text-medium-emphasis mt-2">
            Automatik:
            {{ data.next.automation.type }}
          </div>
        </v-card-text>
      </v-card>

      <v-card v-if="data.last">
        <v-card-title>Letzte Ereignisse</v-card-title>

        <v-card-text v-if="data.last.window">
          Zeitfenster:
          {{ data.last.window.label }} |
          {{ format(data.last.window.endedAt) }}
        </v-card-text>

        <v-card-text v-if="data.last.recording">
          Aufnahme:
          {{ data.last.recording.title }} |
          {{ format(data.last.recording.endedAt) }}
          ({{ data.last.recording.result }})
        </v-card-text>
      </v-card>

      <!-- DEBUG>
      <v-expansion-panels v-model="debugPanels">
        <v-expansion-panel>
          <v-expansion-panel-title>
            Debug
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <pre>
            </pre>
          </v-expansion-panel-text>
        </v-expansion-panel>
        </v-expansion-panels-->
      <pre>


























{{ data }}
</pre
      >
    </template>
  </v-container>
</template>
