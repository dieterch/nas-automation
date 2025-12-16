import { loadState } from "../../utils/automation-state";
import { loadConfig } from "../../utils/config";
import { readPlexCache } from "../../utils/plex-cache";
import { isNasOnlineByPort } from "../../utils/nas-utils";
import { isVuPlusOn } from "../../utils/vuplus-utils";
import { getActiveScheduledWindow } from "../../utils/time-utils";
import { ParsedRecording, parseRecording } from "../../../utils/plex-recording";

export default defineEventHandler(async () => {
  const state = loadState();
  const cfg = loadConfig();
  const now = new Date();

  const activeWindow = getActiveScheduledWindow(now, cfg.SCHEDULED_ON_PERIODS);

  const [nasOnline, vuPlusOn] = await Promise.all([
    isNasOnlineByPort(),
    isVuPlusOn(),
  ]);

  // const REASON_MAP: Record<string, string> = {
  //   "recording active": "Es läuft gerade eine Aufnahme.",
  //   "approaching recording": "Eine Aufnahme steht kurz bevor.",
  //   "within grace period":
  //     "Zwischen zwei Aufnahmen liegt nur eine kurze Pause.",
  //   "forced on window": "Geplantes Zeitfenster (z. B. Proxmox-Backup).",
  //   "proxmox backup running": "Ein Proxmox-Backup läuft.",
  //   "no recordings": "Keine geplanten Aufnahmen.",
  //   "no future recordings": "Keine weiteren Aufnahmen geplant.",
  //   "manual shutdown via API": "Manuell über die Oberfläche ausgelöst.",
  // };

  function explainTitle(state: any) {
    switch (state.lastDecision) {
      case "START_NAS":
        return "NAS wird manuell gestartet."
      case "START_VUPLUS":
        return "VU+ wird eingeschaltet";
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

  // const next = recordings.find((r: any) => r.aufnahmeStart > now) ?? null;
  const nextEvent = computeNextEvent(recordings, now);

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
    nextEvent
  };
});

function computeNextEvent(recordings: ParsedRecording[], now: Date) {
  /**
   * 1) Laufende Aufnahmen (technisch + inhaltlich)
   *    → AufnahmeStart <= now < AufnahmeEnde
   */
  const runningRecordings = recordings.filter(
    (r) => r.aufnahmeStart <= now && r.aufnahmeEnde > now
  );

  if (runningRecordings.length > 0) {
    return {
      type: "RECORDING_RUNNING",
      count: runningRecordings.length,
      recordings: runningRecordings.map((r) => ({
        title: r.displayTitle,
        from: r.sendungsStart,
        to: r.sendungsEnde,
      })),
    };
  }

  /**
   * 2) Nächste Aufnahme (Automation-relevant!)
   *    → Vorlauf / Einschaltzeit
   */
  const nextRecording = recordings
    .filter((r) => r.einschaltZeit > now)
    .sort(
      (a, b) =>
        a.einschaltZeit.getTime() - b.einschaltZeit.getTime()
    )[0];

  if (nextRecording) {
    return {
      type: "RECORDING_START",
      at: nextRecording.einschaltZeit,
      title: nextRecording.displayTitle,
      sendungVon: nextRecording.sendungsStart,
      sendungBis: nextRecording.sendungsEnde,
    };
  }

  /**
   * 3) Nur Nachlauf aktiv
   *    → technisch noch aktiv, aber keine Aufnahme läuft / startet
   */
  const inPostRun = recordings.filter(
    (r) => r.ausschaltZeit > now
  );

  if (inPostRun.length > 0) {
    return {
      type: "RECORDING_END",
      count: inPostRun.length,
    };
  }

  /**
   * 4) Nichts mehr relevant
   */
  return { type: "IDLE" };
}
