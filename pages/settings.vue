<script setup lang="ts">
import { ref, onMounted } from "vue";

type Any = any;

const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const success = ref<string | null>(null);

const config = ref<Any | null>(null);

/* ---------------------------------------
   Helpers
--------------------------------------- */
function resetMessages() {
  error.value = null;
  success.value = null;
}

/* ---------------------------------------
   Load config
--------------------------------------- */
onMounted(async () => {
  try {
    loading.value = true;
    config.value = await $fetch("/api/config");
  } catch {
    error.value = "Konfiguration konnte nicht geladen werden";
  } finally {
    loading.value = false;
  }
});

/* ---------------------------------------
   Save config
--------------------------------------- */
async function saveConfig() {
  if (!config.value) return;

  resetMessages();
  saving.value = true;

  try {
    await $fetch("/api/config", {
      method: "POST",
      body: config.value,
    });

    success.value = "Konfiguration gespeichert";
  } catch {
    error.value = "Fehler beim Speichern der Konfiguration";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <v-container>
    <v-card>
      <v-card-title>Einstellungen</v-card-title>
      <v-card-text>
        <!-- LOADING -->
        <v-progress-circular v-if="loading" indeterminate />

        <!-- ERROR -->
        <v-alert v-if="error" type="error" class="mb-4">
          {{ error }}
        </v-alert>

        <!-- SUCCESS -->
        <v-alert v-if="success" type="success" class="mb-4">
          {{ success }}
        </v-alert>

        <template v-if="config">
          <!-- ---------------------------------------
               ZEITEN / OFFSETS
          ---------------------------------------- -->
          <v-card variant="tonal" class="mb-4">
            <v-card-title>Aufnahme-Zeiten</v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model.number="config.VORLAUF_AUFWACHEN_MIN"
                    label="Vorlauf Aufwachen (Min)"
                    type="number"
                  />
                </v-col>

                <v-col cols="12" md="4">
                  <v-text-field
                    v-model.number="config.AUSSCHALT_NACHLAUF_MIN"
                    label="Ausschalt-Nachlauf (Min)"
                    type="number"
                  />
                </v-col>

                <v-col cols="12" md="4">
                  <v-text-field
                    v-model.number="config.GRACE_PERIOD_MIN"
                    label="Grace Period (Min)"
                    type="number"
                  />
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- ---------------------------------------
               AUTOMATION
          ---------------------------------------- -->
          <v-card variant="tonal" class="mb-4">
            <v-card-title>Automation</v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="config.REC_SCHEDULE_INTERVALL"
                    label="Automation-Intervall (Sekunden)"
                    type="number"
                  />
                </v-col>

                <v-col cols="12" md="6">
                  <v-switch
                    v-model="config.AUTOMATION_ACTIONS_ENABLED"
                    label="Automation scharf schalten"
                    inset
                  />
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- ---------------------------------------
               NIGHT PERIOD
          ---------------------------------------- -->
          <v-card variant="tonal" class="mb-4">
            <v-card-title>Nachtperiode</v-card-title>
            <v-card-text>
              <v-switch
                v-model="config.NIGHT_PERIOD.enabled"
                label="Nachtmodus aktiv"
                inset
                class="mb-4"
              />

              <v-row v-if="config.NIGHT_PERIOD.enabled">
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="config.NIGHT_PERIOD.start"
                    label="Start (HH:MM)"
                  />
                </v-col>

                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="config.NIGHT_PERIOD.end"
                    label="Ende (HH:MM)"
                  />
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- ---------------------------------------
     FIXE ZEITFENSTER
---------------------------------------- -->
          <v-card variant="tonal" class="mb-4">
            <v-card-title>Geplante Zeitfenster</v-card-title>
            <v-card-text>
              <v-alert density="compact" type="info" class="mb-3">
                Diese Zeitfenster halten das System unabhängig von Aufnahmen
                aktiv (z. B. Proxmox-Backups).
              </v-alert>

              <v-card
                v-for="(p, idx) in config.SCHEDULED_ON_PERIODS"
                :key="idx"
                class="mb-3"
                variant="outlined"
              >
                <v-card-text>
                  <v-row align="center">
                    <!-- AKTIV -->
                    <v-col cols="12" md="2">
                      <v-switch
                        v-model="p.active"
                        label="Aktiv"
                        inset
                        density="compact"
                      />
                    </v-col>

                    <!-- TYP -->
                    <v-col cols="12" md="2">
                      <v-select
                        v-model="p.type"
                        :items="['daily', 'weekly', 'once']"
                        label="Typ"
                      />
                    </v-col>

                    <!-- START -->
                    <v-col cols="6" md="2">
                      <v-text-field
                        v-model="p.start"
                        label="Start"
                        type="time"
                      />
                    </v-col>

                    <!-- ENDE -->
                    <v-col cols="6" md="2">
                      <v-text-field v-model="p.end" label="Ende" type="time" />
                    </v-col>

                    <!-- WEEKLY -->
                    <v-col cols="12" md="3" v-if="p.type === 'weekly'">
                      <v-select
                        v-model="p.weekdays"
                        multiple
                        label="Wochentage"
                        :items="[
                          { title: 'Mo', value: 1 },
                          { title: 'Di', value: 2 },
                          { title: 'Mi', value: 3 },
                          { title: 'Do', value: 4 },
                          { title: 'Fr', value: 5 },
                          { title: 'Sa', value: 6 },
                          { title: 'So', value: 0 },
                        ]"
                      />
                    </v-col>

                    <!-- ONCE -->
                    <v-col cols="12" md="3" v-if="p.type === 'once'">
                      <v-text-field
                        v-model="p.date"
                        label="Datum"
                        type="date"
                      />
                    </v-col>

                    <!-- DELETE -->
                    <v-col cols="12" md="1">
                      <v-btn
                        icon="mdi-delete"
                        color="red"
                        variant="text"
                        @click="config.SCHEDULED_ON_PERIODS.splice(idx, 1)"
                      />
                    </v-col>
                  </v-row>
                </v-card-text>
              </v-card>

              <v-btn
                variant="outlined"
                @click="
                  config.SCHEDULED_ON_PERIODS.push({
                    active: true,
                    type: 'daily',
                    start: '00:00',
                    end: '00:00',
                  })
                "
              >
                Zeitfenster hinzufügen
              </v-btn>
            </v-card-text>
          </v-card>

          <!-- ---------------------------------------
               DEVICES
          ---------------------------------------- -->
          <v-card variant="tonal" class="mb-4">
            <v-card-title>Geräte</v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12" md="4">
                  <v-switch
                    v-model="config.SHELLY.NAS.enabled"
                    label="NAS Shelly aktiv"
                    inset
                  />
                </v-col>

                <v-col cols="12" md="4">
                  <v-switch
                    v-model="config.SHELLY.VUPLUS.enabled"
                    label="Vu+ Shelly aktiv"
                    inset
                  />
                </v-col>

                <v-col cols="12" md="4">
                  <v-switch
                    v-model="config.PROXMOX.enabled"
                    label="Proxmox berücksichtigen"
                    inset
                  />
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- ---------------------------------------
               SAVE
          ---------------------------------------- -->
          <v-btn color="primary" :loading="saving" @click="saveConfig">
            Konfiguration speichern
          </v-btn>
        </template>
      </v-card-text>
    </v-card>
  </v-container>
</template>
