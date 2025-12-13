import { isProxmoxBackupRunning } from "../../utils/proxmox-utils"

export default defineEventHandler(async () => {
  const running = await isProxmoxBackupRunning()
  return {
    backupRunning: running,
  }
})
