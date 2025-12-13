export async function isProxmoxBackupRunning(): Promise<boolean> {
  const cfg = loadConfig()
  const runtime = useRuntimeConfig()

  // ⛔ Proxmox-Integration deaktiviert
  if (!cfg.PROXMOX?.enabled) {
    return false
  }

  // ⛔ Fehlende Runtime-Credentials
  if (
    !runtime.proxmoxHost ||
    !runtime.proxmoxNode ||
    !runtime.proxmoxTokenId ||
    !runtime.proxmoxTokenSecret
  ) {
    console.warn("[PROXMOX] enabled but env incomplete")
    return false
  }

  const url = `${runtime.proxmoxHost}/api2/json/nodes/${runtime.proxmoxNode}/tasks`

  try {
    const res: any = await $fetch(url, {
      headers: {
        Authorization: `PVEAPIToken=${runtime.proxmoxTokenId}=${runtime.proxmoxTokenSecret}`,
      },
      timeout: 5000,
    })

    const tasks = res?.data ?? []

    return tasks.some(
      (t: any) =>
        t.type === "vzdump" &&
        (t.status === "running" || t.endtime == null)
    )
  } catch (err) {
    console.error("[PROXMOX] backup check failed", err)
    return false
  }
}
