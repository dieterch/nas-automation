<script setup lang="ts">
import { ref, onMounted } from "vue"

const log = ref<string>("")
const loading = ref<boolean>(false)

const nasStatus = ref<any>(null)
const vuStatus = ref<any>(null)

function addLog(msg: string) {
  log.value =
    `[${new Date().toLocaleTimeString()}] ${msg}\n` + log.value
}

async function callApi(path: string, method: string = "GET") {
  loading.value = true
  try {
    const result = await $fetch(path, { method })
    addLog(`${method} ${path} → ${JSON.stringify(result)}`)
    return result
  } catch (err: any) {
    addLog(`${method} ${path} → ERROR ${err?.message ?? err}`)
    throw err
  } finally {
    loading.value = false
  }
}

/* --------------------------------------------------
   STATUS
-------------------------------------------------- */
async function refreshStatus() {
  nasStatus.value = await callApi("/api/nas/status")
  vuStatus.value = await callApi("/api/vuplus/status")
}

/* --------------------------------------------------
   NAS ACTIONS (MANUAL OVERRIDE)
-------------------------------------------------- */
async function nasOn() {
  await callApi("/api/nas/on", "POST")
  await refreshStatus()
}

async function nasOff() {
  await callApi("/api/nas/off", "POST")
  await refreshStatus()
}

async function nasReboot() {
  await callApi("/api/nas/reboot", "POST")
  await refreshStatus()
}

/* --------------------------------------------------
   VU+ ACTIONS (MANUAL OVERRIDE)
-------------------------------------------------- */
async function vuOn() {
  await callApi("/api/vuplus/on", "POST")
  await refreshStatus()
}

async function vuOff() {
  await callApi("/api/vuplus/off", "POST")
  await refreshStatus()
}

/* --------------------------------------------------
   INIT
-------------------------------------------------- */
onMounted(() => {
  refreshStatus()
})
</script>

<template>
  <v-container>
    <v-card class="pa-4">
      <v-card-title>NAS & VU+ – Manuelle Steuerung & Diagnose</v-card-title>

      <v-divider class="my-4" />

      <!-- ================= NAS ================= -->
      <v-card-subtitle>NAS Status</v-card-subtitle>

      <v-alert
        v-if="nasStatus"
        :type="nasStatus.running ? 'success' : 'warning'"
        density="compact"
        class="mb-3"
      >
        NAS ist <strong>{{ nasStatus.running ? "ONLINE" : "OFFLINE" }}</strong>
        (IP: {{ nasStatus.ip }})
      </v-alert>

      <v-row class="mb-4">
        <v-col cols="12" md="4">
          <v-btn block color="green" :loading="loading" @click="nasOn">
            NAS einschalten
          </v-btn>
        </v-col>

        <v-col cols="12" md="4">
          <v-btn block color="red" :loading="loading" @click="nasOff">
            NAS ausschalten
          </v-btn>
        </v-col>

        <v-col cols="12" md="4">
          <v-btn block color="orange" :loading="loading" @click="nasReboot">
            NAS reboot
          </v-btn>
        </v-col>
      </v-row>

      <v-divider class="my-4" />

      <!-- ================= VU+ ================= -->
      <v-card-subtitle>VU+ Receiver Status</v-card-subtitle>

      <v-alert
        v-if="vuStatus"
        :type="vuStatus.on ? 'success' : 'warning'"
        density="compact"
        class="mb-3"
      >
        VU+ ist <strong>{{ vuStatus.on ? "EINGESCHALTET" : "AUSGESCHALTET" }}</strong>
      </v-alert>

      <v-row class="mb-4">
        <v-col cols="12" md="6">
          <v-btn
            block
            color="teal"
            :loading="loading"
            @click="vuOn"
          >
            VU+ einschalten
          </v-btn>
        </v-col>

        <v-col cols="12" md="6">
          <v-btn
            block
            color="deep-orange"
            :loading="loading"
            @click="vuOff"
          >
            VU+ ausschalten
          </v-btn>
        </v-col>
      </v-row>

      <v-divider class="my-4" />

      <!-- ================= LOG ================= -->
      <v-card-subtitle>Log</v-card-subtitle>

      <v-textarea
        v-model="log"
        readonly
        auto-grow
        rows="10"
        label="Log-Ausgabe"
        class="mt-2"
      />
    </v-card>
  </v-container>
</template>
