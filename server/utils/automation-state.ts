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
  lastTickAt: string
  since: string
  lastDecision?: string
  reason?: string
}

export function loadState(): AutomationStateFile {
  if (!existsSync(STATE_FILE)) {
    const now = new Date().toISOString()
    return {
      state: "IDLE",
      since: now,
      lastTickAt: now,
    }
  }

  return JSON.parse(readFileSync(STATE_FILE, "utf-8"))
}


export function saveState(
  newState: AutomationState,
  decision: string,
  reason: string
) {
  const prev = loadState()
  const now = new Date().toISOString()

  const entry: AutomationStateFile = {
    state: newState,
    lastTickAt: now,
    since: prev.state === newState ? prev.since : now,
    lastDecision: decision,
    reason,
  }

  writeFileSync(STATE_FILE, JSON.stringify(entry, null, 2))
}

