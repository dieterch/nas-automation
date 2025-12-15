import { saveState } from "./automation-state"
import { logAutomation } from "./automation-log"
import { loadConfig } from "./config"
import {
  NASshellyOnIfNasOff,
  NASshellyOffIfNasOff,
  VUshellyOn,
  VUshellyOff,
} from "./nas-utils"

/* ------------------------------------------------------------------
   TYPES
------------------------------------------------------------------ */
type Decision =
  | "START_REQUIRED_DEVICES"
  | "KEEP_RUNNING"
  | "SHUTDOWN_ALL"
  | "SHUTDOWN_NAS"
  | "NO_ACTION"
  | "ERROR_REQUIRED_DEVICE"

/* ------------------------------------------------------------------
   STATE MACHINE
------------------------------------------------------------------ */
export async function applyDecision(
  decision: Decision,
  reason: string
) {
  const cfg = loadConfig()
  const actionsEnabled = cfg.AUTOMATION_ACTIONS_ENABLED === true

  /* --------------------------------------------------------------
     GLOBAL LOGGING (immer)
  -------------------------------------------------------------- */
  logAutomation({ decision, reason })
  console.log(`[AUTOMATION][MACHINE] decision=${decision} reason="${reason}" actionsEnabled=${actionsEnabled}`)

  /* --------------------------------------------------------------
     DRY RUN MODE
  -------------------------------------------------------------- */
  if (!actionsEnabled) {
    // State nur setzen, wenn relevant
    if (decision !== "NO_ACTION") {
      saveState("DRY_RUN", decision, reason)
    }
    return
  }

  /* --------------------------------------------------------------
     REAL ACTIONS
  -------------------------------------------------------------- */
  try {
    switch (decision) {
      /* ----------------------------------------------------------
         START REQUIRED DEVICES
      ---------------------------------------------------------- */
      case "START_REQUIRED_DEVICES":
        saveState("STARTING", decision, reason)

        if (cfg.SHELLY?.NAS?.enabled) {
          await NASshellyOnIfNasOff()
        }

        if (cfg.SHELLY?.VUPLUS?.enabled) {
          await VUshellyOn()
        }
        break

      /* ----------------------------------------------------------
         KEEP RUNNING
      ---------------------------------------------------------- */
      case "KEEP_RUNNING":
        saveState("RUNNING", decision, reason)
        break

      /* ----------------------------------------------------------
         SHUTDOWN NAS ONLY (DAY MODE)
      ---------------------------------------------------------- */
      case "SHUTDOWN_NAS":
        saveState("NAS_OFF", decision, reason)

        if (cfg.SHELLY?.NAS?.enabled) {
          await NASshellyOffIfNasOff()
        }
        break

      /* ----------------------------------------------------------
         SHUTDOWN ALL (NIGHT MODE)
      ---------------------------------------------------------- */
      case "SHUTDOWN_ALL":
        saveState("SHUTTING_DOWN", decision, reason)

        if (cfg.SHELLY?.VUPLUS?.enabled) {
          await VUshellyOff()
        }

        if (cfg.SHELLY?.NAS?.enabled) {
          await NASshellyOffIfNasOff()
        }
        break

      /* ----------------------------------------------------------
         ERROR
      ---------------------------------------------------------- */
      case "ERROR_REQUIRED_DEVICE":
        saveState("ERROR", decision, reason)
        break

      /* ----------------------------------------------------------
         NO ACTION
      ---------------------------------------------------------- */
      case "NO_ACTION":
      default:
        // bewusst kein saveState
        break
    }
  } catch (err) {
    console.error("[AUTOMATION][MACHINE] action failed", err)

    saveState(
      "ERROR",
      "ERROR_REQUIRED_DEVICE",
      "exception during automation action"
    )
  }
}
