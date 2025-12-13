export default defineNitroPlugin(() => {
  setInterval(async () => {
    try {
      const schedule = await $fetch(
        "http://localhost:4800/api/plex/scheduled"
      )

      const { runAutomationDryRun } = await import(
        "../utils/automation"
      )

      await runAutomationDryRun(schedule)
    } catch (e) {
      console.error("[AUTOMATION] error", e)
    }
  }, 60_000) // 1 Minute
})
