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

function formatTime(d: string | Date | null | undefined) {
  if (!d) return "–";
  return new Date(d).toLocaleString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const automationColor = computed(() =>
  data.value.automation.state === "ON"
    ? "rgba(46,125,50,.15)"
    : "rgba(198,40,40,.12)"
);

</script>

<template>
  <v-container>

    <v-progress-circular v-if="loading" indeterminate />
    <v-alert v-else-if="error" type="error">{{ error }}</v-alert>

    <template v-else-if="data">
      <!-- AUTOMATION -->
      <v-card v-if="data?.automation" class="mb-4" :color="automationColor" novariant="tonal">
        <v-card-title>Status</v-card-title>
        <v-card-text>
          {{ data.automation.state }} |
          Seit {{ format(data.automation.since) }}
          ({{ data.automation.sinceHuman }})
        </v-card-text>
      </v-card>

      <!-- COUNTS -->
      <v-card class="mb-4" color="blue-grey-darken-3" variant="tonal">
        <v-card-title>Ereignisse</v-card-title>
        <v-card-text>
          <table style="width: 50%">
            <tbody>
              <tr>
                <th style="width: 40%; text-align: left">Typ</th>
                <th style="width: 30%; text-align: left">laufend</th>
                <th style="width: 30%; text-align: left">geplant</th>
              </tr>
              <tr>
                <td><a href="/recordings">Aufnahmen</a></td>
                <td>{{ data.counts.recordingsRunning }}</td>
                <td>{{ data.counts.recordingsUpcoming }}</td>
              </tr>
              <tr>
                <td><a href="/settings">Zeitfenster</a></td>
                <td>{{ data.counts.windowsActive }}</td>
                <td>{{ data.counts.windowsTotal }}</td>
              </tr>
            </tbody>
          </table>
        </v-card-text>
      </v-card>

      <v-card v-if="data.runningRecordings.length > 0" class="mb-4" title="Laufende Aufnahme(n)" color="green-lighten-3"
        novariant="tonal">
        <v-list density="compact" class="py-0" bg-color="green-lighten-3">
          <v-list-item v-for="r in data.runningRecordings" :key="r.displayTitle">
            <v-list-item-title>
              {{ r.displayTitle }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{ formatTime(r.sendungsStart) }} – {{ formatTime(r.sendungsEnde) }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-card>

      <v-card v-if="data.next.recording" class="mb-4" color="rgba(46,125,50,.15)" novariant="tonal"
        title="Nächste Aufnahme" :nosubtitle=data.next.recording.title>
        <v-card-text v-if="data.next.recording">
          {{ data.next.recording.title }} |
          in {{ data.next.recording.inHuman }},
          {{ format(data.next.recording.at) }}
        </v-card-text>
      </v-card>

      <v-card
        v-if="data.activeWindows.length > 0"
        class="mb-4"
        title="Aktive Zeitfenster"
        color="blue-lighten-3"
        novariant="tonal"
      >
        <v-list density="compact" class="py-0" bg-color="blue-lighten-3">
          <v-list-item
            v-for="w in data.activeWindows"
            :key="w.id"
          >
            <v-list-item-title>
              {{ w.id ?? "Zeitfenster" }}
            </v-list-item-title>

            <v-list-item-subtitle>
              {{ w.start }} – {{ w.end }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-card>

      <v-card v-if="data.next.window" class="mb-4" color="rgba(33,150,243,.18)" novariant="tonal"
        title="Nächstes Zeitfenster" :nosubtitle=data.next.window.title>
        <v-card-text v-if="data.next.window">
          {{ data.next.window.title }} |
          in {{ data.next.window.inHuman }},
          {{ format(data.next.window.at) }}
        </v-card-text>

      </v-card>
      <pre>


























{{ data }}
</pre>
    </template>
  </v-container>
</template>
<style scoped>
a {
  text-decoration: none;
}
</style>