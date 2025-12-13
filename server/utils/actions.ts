import { loadConfig } from "./config"
import {
  NASshellyOnIfNasOff,
  NASshellyOffIfNasOff,
  startNasSafe,
  VUshellyOn,
  VUshellyOff,
  isNasOnlineByPort
} from "./nas-utils"
import { isVuPlusOn } from "./vuplus-utils"

function actionsAllowed(): boolean {
  return loadConfig().AUTOMATION_ACTIONS_ENABLED === true
}

function shellyNasAllowed(): boolean {
  return loadConfig().SHELLY?.NAS?.enabled === true
}

function shellyVuAllowed(): boolean {
  return loadConfig().SHELLY?.VUPLUS?.enabled === true
}

/* --------------------------------------------------
   NAS
-------------------------------------------------- */
export async function ensureNasRunning() {
  if (!actionsAllowed()) {
    console.log("[ACTIONS][DRY] ensureNasRunning")
    return
  }

  if (!shellyNasAllowed()) {
    console.log("[ACTIONS] NAS Shelly disabled by config")
    return
  }

  if (await isNasOnlineByPort()) {
    console.log("[ACTIONS] NAS already running")
    return
  }

  console.log("[ACTIONS] Starting NAS safely")
  await startNasSafe()
}

export async function shutdownNas() {
  if (!actionsAllowed()) {
    console.log("[ACTIONS][DRY] shutdownNas")
    return
  }

  if (!shellyNasAllowed()) {
    console.log("[ACTIONS] NAS Shelly disabled by config")
    return
  }

  console.log("[ACTIONS] Shutting down NAS")
  await NASshellyOffIfNasOff()
}

/* --------------------------------------------------
   VU+
-------------------------------------------------- */
export async function ensureVuPlusRunning() {
  if (!actionsAllowed()) {
    console.log("[ACTIONS][DRY] ensureVuPlusRunning")
    return
  }

  if (!shellyVuAllowed()) {
    console.log("[ACTIONS] VU+ Shelly disabled by config")
    return
  }

  if (await isVuPlusOn()) {
    console.log("[ACTIONS] VU+ already running")
    return
  }

  console.log("[ACTIONS] Powering ON VU+")
  await VUshellyOn()
}

export async function shutdownVuPlus() {
  if (!actionsAllowed()) {
    console.log("[ACTIONS][DRY] shutdownVuPlus")
    return
  }

  if (!shellyVuAllowed()) {
    console.log("[ACTIONS] VU+ Shelly disabled by config")
    return
  }

  if (!(await isVuPlusOn())) {
    console.log("[ACTIONS] VU+ already off")
    return
  }

  console.log("[ACTIONS] Powering OFF VU+")
  await VUshellyOff()
}
