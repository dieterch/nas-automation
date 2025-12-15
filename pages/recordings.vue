<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import type { ParsedRecording } from "../utils/plex-recording";
import { parseRecording } from "../utils/plex-recording";

/* ------------------------------------------------------------------
   MINIMALE TYPHILFE
------------------------------------------------------------------ */
// type AnyRecord = Record<string, any>
type AnyRecord = Record<any, any>;

/* ------------------------------------------------------------------
   STATES
------------------------------------------------------------------ */
const items = ref<AnyRecord[]>([]);
const loading = ref<boolean>(true);
const error = ref<any>(null);
const config = ref<AnyRecord | null>(null);
const lastFetch = ref<string | null>(null);

/* ------------------------------------------------------------------
   HILFSFUNKTIONEN
------------------------------------------------------------------ */
function toDate(secs: number): Date {
  return new Date(secs * 1000);
}

function format(d: Date | null | undefined): string {
  if (!d) return "n/a";
  return d.toLocaleString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function format_time(d: Date | null | undefined): string {
  if (!d) return "n/a";
  return d.toLocaleString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const parsedAndSorted = computed<ParsedRecording[]>(() => {
  if (!config.value) return [];

  return items.value
    .map((r) => parseRecording(r, config.value))
    .filter((r): r is ParsedRecording => r !== null)
    .sort((a, b) => a.sendungsStart.getTime() - b.sendungsStart.getTime());
});

/* ------------------------------------------------------------------
   TIMELINE GENERIEREN
------------------------------------------------------------------ */
const timelineEntries = computed<AnyRecord[]>(() => {
  if (!config.value) return [];

  const list = parsedAndSorted.value;
  const entries: AnyRecord[] = [];

  for (let i = 0; i < list.length; i++) {
    const curr = list[i]!;
    const next = list[i + 1];

    let gapMinutes: number | null = null;
    let skipShutdown = false;
    let wiederstart: Date | null = null;

    if (next) {
      const diffMs = next.aufnahmeStart.getTime() - curr.aufnahmeEnde.getTime();
      gapMinutes = Math.round(diffMs / 60000);

      if (gapMinutes < config.value.GRACE_PERIOD_MIN) {
        skipShutdown = true;
      }

      wiederstart = new Date(
        next.aufnahmeStart.getTime() -
          config.value.VORLAUF_AUFWACHEN_MIN * 60000
      );
    }

    entries.push({
      type: "recording",
      index: i + 1,
      ...curr,
      gapMinutes,
      skipShutdown,
      wiederstart,
    });

    if (!skipShutdown && next && wiederstart) {
      entries.push({
        type: "shutdown",
        from: curr.ausschaltZeit,
        to: wiederstart,
      });
    }
  }

  return entries;
});

/* ------------------------------------------------------------------
   API LOAD
------------------------------------------------------------------ */
onMounted(async () => {
  try {
    loading.value = true;
    config.value = await $fetch("/api/config");

    // const res: AnyRecord = await $fetch("/api/plex/scheduled");
    // items.value = res.data?.MediaContainer?.MediaGrabOperation ?? [];

    // lastFetch.value = res.lastSuccessfulFetch ?? null;

    const res: AnyRecord = await $fetch("/api/plex/cache");

    items.value = res.data?.MediaContainer?.MediaGrabOperation ?? [];

    lastFetch.value = res.lastSuccessfulFetch ?? null;
  } catch (err) {
    error.value = err;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <v-container>
    <v-card>
      <v-card-title>Geplante Aufnahmen</v-card-title>
      <v-card-text>
        <v-progress-circular v-if="loading" indeterminate />

        <v-alert type="info" density="compact">
          Letzter erfolgreicher Abruf:
          {{ lastFetch ? format(new Date(lastFetch)) : "nie" }}
        </v-alert>

        <v-alert v-if="error" type="error">
          Fehler beim Laden der Daten
        </v-alert>

        <v-row dense v-if="!loading && !error">
          <v-col
            v-for="item in timelineEntries"
            :key="
              item.type === 'recording' ? item.rec?.id : item.from?.getTime()
            "
            cols="12"
          >
            <!-- AUFNAHME -->
            <v-card
              v-if="item.type === 'recording'"
              :color="
                item.skipShutdown ? 'green-lighten-5' : 'yellow-lighten-5'
              "
              class="pa-3"
              variant="flat"
            >
              <v-card-title>
                Aufnahme #{{ item.index }} – {{ item.displayTitle }}
              </v-card-title>

              <v-card-text>
                <v-table density="compact">
                  <tbody>
                    <tr>
                      <th></th>
                      <th><strong>Start</strong></th>
                      <th><strong>Ende</strong></th>
                    </tr>
                    <tr>
                      <td><strong>Geräte</strong></td>
                      <td>{{ format(item.einschaltZeit) }}</td>
                      <td>{{ format(item.ausschaltZeit) }}</td>
                    </tr>
                    <tr>
                      <td><strong>Aufnahme</strong></td>
                      <td>{{ format(item.aufnahmeStart) }}</td>
                      <td>{{ format(item.aufnahmeEnde) }}</td>
                    </tr>
                    <tr>
                      <td><strong>Sendung</strong></td>
                      <td>{{ format(item.sendungsStart) }}</td>
                      <td>{{ format(item.sendungsEnde) }}</td>
                    </tr>
                    <tr v-if="item.gapMinutes !== null">
                      <td><strong>Shutdown</strong></td>
                      <td>
                        {{
                          item.skipShutdown
                            ? "kein Shutdown"
                            : item.gapMinutes + " Min. Pause"
                        }}
                      </td>
                      <td>
                        {{ item.skipShutdown ? "-" : format(item.wiederstart) }}
                      </td>
                    </tr>
                    <tr v-if="item.wiederstart"></tr>
                  </tbody>
                </v-table>
              </v-card-text>
            </v-card>

            <!-- SHUTDOWN -->
            <!--v-card v-else color="yellow-lighten-4" class="pa-3" variant="flat">
              <v-card-title>Shutdown-Periode</v-card-title>
              <v-card-text>
                <v-table density="compact">
                  <tbody>
                    <tr>
                      <td><strong>Von</strong></td>
                      <td>{{ format(item.from) }}</td>
                    </tr>
                    <tr>
                      <td><strong>Bis</strong></td>
                      <td>{{ format(item.to) }}</td>
                    </tr>
                  </tbody>
                </v-table>
              </v-card-text>
            </v-card-->
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </v-container>
</template>
