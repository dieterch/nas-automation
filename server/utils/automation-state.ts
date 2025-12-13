import { readFileSync, writeFileSync, existsSync } from "fs"
import { resolve } from "path"

const STATE_FILE = resolve("data/automation-state.json")

export type AutomationState =
  | "INIT"
  | "IDLE"
  | "DRY_RUN"
  | "STARTING"
  | "RUNNING"
  | "NAS_OFF"
  | "SHUTTING_DOWN"
  | "ERROR"


const DEFAULT_STATE: AutomationState = "INIT"


export interface AutomationStateFile {
  state: AutomationState
  since: string
  lastDecision?: string
  reason?: string
}

export function loadState(): AutomationStateFile {
  if (!existsSync(STATE_FILE)) {
    return {
      state: "IDLE",
      since: new Date().toISOString(),
    }
  }

  return JSON.parse(readFileSync(STATE_FILE, "utf-8"))
}

export function saveState(
  state: AutomationState,
  decision: string,
  reason: string
) {
  const entry: AutomationStateFile = {
    state,
    since: new Date().toISOString(),
    lastDecision: decision,
    reason,
  }

  writeFileSync(STATE_FILE, JSON.stringify(entry, null, 2))
}
