import { loadState } from "../../utils/automation-state";
import { loadConfig } from "../../utils/config";
import { readPlexCache } from "../../utils/plex-cache";
import { isNasOnlineByPort } from "../../utils/nas-utils";
import { isVuPlusOn } from "../../utils/vuplus-utils";
import { getActiveScheduledWindow } from "../../utils/time-utils";
import { ParsedRecording, parseRecording} from "../../../utils/plex-recording";

export default defineEventHandler(async () => {
  const state = loadState();
  const cfg = loadConfig();
  const now = new Date();

  const activeWindow = getActiveScheduledWindow(now, cfg.SCHEDULED_ON_PERIODS);

  const [nasOnline, vuPlusOn] = await Promise.all([
    isNasOnlineByPort(),
    isVuPlusOn(),
  ]);

  const REASON_MAP: Record<string, string> = {
    "recording active": "Es läuft gerade eine Aufnahme.",
    "approaching recording": "Eine Aufnahme steht kurz bevor.",
    "within grace period":
      "Zwischen zwei Aufnahmen liegt nur eine kurze Pause.",
    "forced on window": "Geplantes Zeitfenster (z. B. Proxmox-Backup).",
    "proxmox backup running": "Ein Proxmox-Backup läuft.",
    "no recordings": "Keine geplanten Aufnahmen.",
    "no future recordings": "Keine weiteren Aufnahmen geplant.",
    "manual shutdown via API": "Manuell über die Oberfläche ausgelöst.",
  };

  function explainTitle(state: any) {
    switch (state.lastDecision) {
      case "KEEP_RUNNING":
        return "System bleibt aktiv";
      case "START_REQUIRED_DEVICES":
        return "System wird gestartet";
      case "SHUTDOWN_ALL":
      case "SHUTDOWN_NAS":
        return "System wird heruntergefahren";
      default:
        return "Systemstatus";
    }
  }

  function explainReason(reason?: string) {
    // return REASON_MAP[reason ?? ""] ?? "Kein Grund bekannt";
    return reason;
  }

  const cache = await readPlexCache();
  const raw = cache?.data?.MediaContainer?.MediaGrabOperation ?? [];

  const recordings = raw
    .map((r: any) => parseRecording(r, cfg))
    .filter(Boolean)
    .sort(
      (a: any, b: any) => a.aufnahmeStart.getTime() - b.aufnahmeStart.getTime()
    );

  // finde nächste Aufnahme 
  const next = recordings.find((r: any) => r.aufnahmeStart > now) ?? null;

  return {
    automation: {
      state: state.state,
      since: state.since,
      lastDecision: state.lastDecision ?? null,
      reason: state.reason ?? null,
    },
    explanation: {
      title: explainTitle(state),
      description: explainReason(state.reason),
    },
    devices: {
      nas: nasOnline ? "on" : "off",
      vuplus: vuPlusOn ? "on" : "off",
    },
    activeWindow,
    nextEvent: next
      ? {
          type: "recording",
          title: next.displayTitle,
          episode: next.episodeTitle,
          aufnahmeStart: next.aufnahmeStart.toISOString(),
          aufnahmeEnde: next.aufnahmeEnde.toISOString(),
          einschaltZeit: next.einschaltZeit.toISOString(),
          ausschaltZeit: next.ausschaltZeit.toISOString(),
        }
      : { type: "none" },
  };
});
