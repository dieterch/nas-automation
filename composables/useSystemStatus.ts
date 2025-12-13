import { ref } from "vue"

//const plexReady = ref(false)
const plexStatus = ref("red") // red | yellow | green
const nasReady = ref(false)

export function useSystemStatus() {
  async function update() {
    try {
      const plexRes = await $fetch('/api/status/plex')
      plexStatus.value = plexRes.status
    } catch {
      plexStatus.value = "red"
    }

  try {
    const res = await $fetch('/api/status/nas', { cache: "no-store" })
    nasReady.value = res.ready
  } catch {
    nasReady.value = false
  }
  }

  if (process.client) {
    setInterval(update, 10_000)
    update()
  }

  return {
    plexStatus,
    nasReady,
    update
  }
}
