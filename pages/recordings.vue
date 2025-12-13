<script setup lang="ts">
import { ref, onMounted, computed } from "vue"

/* ------------------------------------------------------------------
   MINIMALE TYPHILFE
------------------------------------------------------------------ */
type AnyRecord = Record<string, any>

/* ------------------------------------------------------------------
   STATES
------------------------------------------------------------------ */
const items = ref<AnyRecord[]>([])
const loading = ref<boolean>(true)
const error = ref<any>(null)
const config = ref<AnyRecord | null>(null)
const lastFetch = ref<string | null>(null)

/* ------------------------------------------------------------------
   HILFSFUNKTIONEN
------------------------------------------------------------------ */
function toDate(secs: number): Date {
  return new Date(secs * 1000)
}

function format(d: Date | null | undefined): string {
  if (!d) return "n/a"
  return d.toLocaleString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  })
}

function format_time(d: Date | null | undefined): string {
  if (!d) return "n/a"
  return d.toLocaleString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

/* ------------------------------------------------------------------
   RECORD PARSING
------------------------------------------------------------------ */
function parseRecording(rec: AnyRecord): AnyRecord | null {
  if (!config.value) return null

  const media = rec.Metadata?.Media?.[0]
  if (!media) return null

  const begins: number = media.beginsAt
  const ends: number = media.endsAt

  const startOffset = Number(media.startOffsetSeconds ?? 0)
  const endOffset = Number(media.endOffsetSeconds ?? 0)

  const aufnahmeStart = toDate(begins - startOffset)
  const aufnahmeEnde = toDate(ends + endOffset)

  const sendungsStart = toDate(begins)
  const sendungsEnde = toDate(ends)

  const einschaltZeit = new Date(
    aufnahmeStart.getTime() -
      config.value.VORLAUF_AUFWACHEN_MIN * 60000
  )

  const ausschaltZeit = new Date(
    aufnahmeEnde.getTime() +
      config.value.AUSSCHALT_NACHLAUF_MIN * 60000
  )

  return {
    rec,
    titel: rec.Metadata?.grandparentTitle || rec.Metadata?.title,
    aufnahmeStart,
    aufnahmeEnde,
    sendungsStart,
    sendungsEnde,
    startOffset,
    endOffset,
    einschaltZeit,
    ausschaltZeit,
  }
}

/* ------------------------------------------------------------------
   SORTIERUNG
------------------------------------------------------------------ */
const parsedAndSorted = computed<AnyRecord[]>(() => {
  return items.value
    .map(parseRecording)
    .filter((r): r is AnyRecord => r !== null)
    .sort((a, b) => a.sendungsStart.getTime() - b.sendungsStart.getTime())
})

/* ------------------------------------------------------------------
   TIMELINE GENERIEREN
------------------------------------------------------------------ */
const timelineEntries = computed<AnyRecord[]>(() => {
  if (!config.value) return []

  const list = parsedAndSorted.value
  const entries: AnyRecord[] = []

  for (let i = 0; i < list.length; i++) {
    const curr = list[i]!
    const next = list[i + 1]

    let gapMinutes: number | null = null
    let skipShutdown = false
    let wiederstart: Date | null = null

    if (next) {
      const diffMs =
        next.aufnahmeStart.getTime() - curr.aufnahmeEnde.getTime()
      gapMinutes = Math.round(diffMs / 60000)

      if (gapMinutes < config.value.GRACE_PERIOD_MIN) {
        skipShutdown = true
      }

      wiederstart = new Date(
        next.aufnahmeStart.getTime() -
          config.value.VORLAUF_AUFWACHEN_MIN * 60000
      )
    }

    entries.push({
      type: "recording",
      index: i + 1,
      ...curr,
      gapMinutes,
      skipShutdown,
      wiederstart,
    })

    if (!skipShutdown && next && wiederstart) {
      entries.push({
        type: "shutdown",
        from: curr.ausschaltZeit,
        to: wiederstart,
      })
    }
  }

  return entries
})

/* ------------------------------------------------------------------
   API LOAD
------------------------------------------------------------------ */
onMounted(async () => {
  try {
    loading.value = true
    config.value = await $fetch("/api/config")

    const res: AnyRecord = await $fetch("/api/plex/scheduled")
    items.value =
      res.data?.MediaContainer?.MediaGrabOperation ?? []

    lastFetch.value = res.lastSuccessfulFetch ?? null
  } catch (err) {
    error.value = err
  } finally {
    loading.value = false
  }
})
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
            :key="item.type === 'recording'
              ? item.rec?.id
              : item.from?.getTime()"
            cols="12"
          >
            <!-- AUFNAHME -->
            <v-card
              v-if="item.type === 'recording'"
              :color="item.skipShutdown
                ? 'green-lighten-5'
                : 'yellow-lighten-5'"
              class="pa-3"
              variant="flat"
            >
              <v-card-title>
                Aufnahme #{{ item.index }} – {{ item.titel }}
              </v-card-title>

              <v-card-text>
                <v-table density="compact">
                  <tbody>
                    <tr>
                      <td><strong>Aufnahme</strong></td>
                      <td>
                        {{ format(item.aufnahmeStart) }} –
                        {{ format_time(item.aufnahmeEnde) }}
                      </td>
                    </tr>
                    <tr>
                      <td><strong>Sendung</strong></td>
                      <td>
                        {{ format_time(item.sendungsStart) }} –
                        {{ format_time(item.sendungsEnde) }}
                      </td>
                    </tr>
                    <tr>
                      <td><strong>Einschalten</strong></td>
                      <td>{{ format(item.einschaltZeit) }}</td>
                    </tr>
                    <tr>
                      <td><strong>Ausschalten</strong></td>
                      <td>{{ format(item.ausschaltZeit) }}</td>
                    </tr>
                    <tr v-if="item.gapMinutes !== null">
                      <td><strong>Pause</strong></td>
                      <td>
                        {{ item.gapMinutes }} min →
                        {{ item.skipShutdown
                          ? "kein Shutdown"
                          : "Shutdown folgt" }}
                      </td>
                    </tr>
                    <tr v-if="item.wiederstart">
                      <td><strong>Wiederstart</strong></td>
                      <td>{{ format(item.wiederstart) }}</td>
                    </tr>
                  </tbody>
                </v-table>
              </v-card-text>
            </v-card>

            <!-- SHUTDOWN -->
            <v-card
              v-else
              color="yellow-lighten-4"
              class="pa-3"
              variant="flat"
            >
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
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </v-container>
</template>
