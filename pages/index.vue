<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useSystemStatus } from "~/composables/useSystemStatus"

const { plexStatus, nasReady } = useSystemStatus()

const plexColor = computed(() => {
  if (plexStatus.value === "green") return "green"
  if (plexStatus.value === "yellow") return "yellow"
  return "red"
})
const nasColor  = computed(() => nasReady.value  ? "green" : "red")

type Any = any;

const loading = ref(true);
const error = ref<string | null>(null);
const data = ref<Any | null>(null);

function format(d: string | Date | null) {
  if (!d) return "–";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

onMounted(async () => {
  try {
    loading.value = true;
    data.value = await $fetch("/api/automation/status");
  } catch {
    error.value = "Dashboard konnte nicht geladen werden";
  } finally {
    loading.value = false;
  }
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
      <v-alert
        class="mb-4"
        variant="tonal"
        :type="
          data.automation.state === 'ERROR'
            ? 'error'
            : data.automation.state === 'SHUTTING_DOWN'
            ? 'warning'
            : data.automation.state === 'RUNNING'
            ? 'success'
            : 'info'
        "
      >
        <strong>{{ data.explanation.title }}</strong
        ><br />
        {{ data.explanation.description }}
      </v-alert>

      <!-- DEVICES -->
      <v-row class="mb-4">
        <v-col cols="12" md="4">
          <v-card variant="tonal">
            <v-card-title>NAS</v-card-title>
            <v-card-text>
              <v-chip
                size="small"
                label
              >
                <v-icon :color="nasColor" size="18">mdi-circle</v-icon>
              </v-chip>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="4">
          <v-card variant="tonal">
            <v-card-title>Vu+</v-card-title>
            <v-card-text>
              <v-chip
                size="small"
                label
              >
              <v-icon v-if="data.devices.vuplus === 'off'" color='red' size="18">mdi-circle</v-icon>
              <v-icon v-if="data.devices.vuplus === 'on'"color="green" size="18">mdi-circle</v-icon>
              </v-chip>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- PLEX STATUS -->
        <v-col cols="12" md="4">
          <v-card variant="tonal">
            <v-card-title>Plex</v-card-title>
            <v-card-text>
              <v-chip size="small" label>
                <v-icon :color="plexColor" size="18">mdi-circle</v-icon>
              </v-chip>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- ACTIVE WINDOW -->
      <v-card v-if="data.activeWindow" variant="tonal" class="mb-4">
        <v-card-title>Aktives Zeitfenster</v-card-title>
        <v-card-text>
          <strong>{{ data.activeWindow.label }}</strong
          ><br />
          {{ data.activeWindow.start }} – {{ data.activeWindow.end }}
        </v-card-text>
      </v-card>

      <!-- STATUS -->
      <v-card variant="tonal" class="mb-4">
        <v-card-title>Status</v-card-title>
        <v-card-text>
          <v-table density="compact">
            <tbody>
              <tr>
                <td><strong>Automation State</strong></td>
                <td>
                  <v-chip
                    size="small"
                    label
                    :color="
                      data.automation.state === 'RUNNING'
                        ? 'green'
                        : data.automation.state === 'STARTING'
                        ? 'blue'
                        : data.automation.state === 'SHUTTING_DOWN'
                        ? 'orange'
                        : data.automation.state === 'ERROR'
                        ? 'red'
                        : data.automation.state === 'DRY_RUN'
                        ? 'brown'
                        : 'grey'
                    "
                  >
                    {{ data.automation.state }}
                  </v-chip>
                </td>
              </tr>

              <tr>
                <td><strong>Seit</strong></td>
                <td>{{ format(data.automation.since) }}</td>
              </tr>

              <tr>
                <td><strong>Letzte Decision</strong></td>
                <td>{{ data.automation.lastDecision ?? "–" }}</td>
              </tr>

              <tr>
                <td><strong>Grund (intern)</strong></td>
                <td>{{ data.automation.reason ?? "–" }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>

      <!-- NEXT EVENT -->
      <v-card variant="tonal" class="mb-4">
        <v-card-title>Nächstes Ereignis</v-card-title>
        <v-card-text>
          <v-alert
            v-if="data.nextEvent?.type === 'none'"
            type="info"
            density="compact"
          >
            Kein kommendes Ereignis
          </v-alert>

          <v-table v-else density="compact">
            <tbody>
              <tr>
                <td><strong>Titel</strong></td>
                <td>{{ data.nextEvent.title }}</td>
              </tr>
              <tr>
                <td><strong>Einschalten</strong></td>
                <td>{{ format(data.nextEvent.einschaltZeit) }}</td>
              </tr>
              <tr>
                <td><strong>Aufnahme</strong></td>
                <td>
                  {{ format(data.nextEvent.aufnahmeStart) }} –
                  {{ format(data.nextEvent.aufnahmeEnde) }}
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>

      <!-- QUICK ACTIONS -->
      <v-row>
        <v-col cols="12" md="6">
          <v-btn block color="primary" to="/automation">
            Details / Automation
          </v-btn>
        </v-col>
        <v-col cols="12" md="6">
          <v-btn block color="secondary" to="/settings"> Einstellungen </v-btn>
        </v-col>
      </v-row>
    </template>
  </v-container>
</template>
