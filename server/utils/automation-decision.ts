import { isNowInScheduledPeriod } from "./time-utils";
import { ParsedRecording } from "../../utils/plex-recording";

export function computeAutomationDecision(
  recordings: ParsedRecording[],
  now: Date,
  cfg: any
) {
  // Scheduled ON
  const forced = isNowInScheduledPeriod(now, cfg.SCHEDULED_ON_PERIODS)
  if (forced.active) {
    return {
      decision: "KEEP_RUNNING",
      reason: forced.reason ?? "scheduled on window",
    }
  }

  // Aufnahme läuft JETZT
  if (
    recordings.some(
      r => now >= r.aufnahmeStart && now < r.aufnahmeEnde
    )
  ) {
    return {
      decision: "KEEP_RUNNING",
      reason: "recording active",
    }
  }

  // Vorlauf (wir nähern uns)
  if (
    recordings.some(
      r => now >= r.einschaltZeit && now < r.aufnahmeStart
    )
  ) {
    return {
      decision: "KEEP_RUNNING",
      reason: "approaching recording",
    }
  }

  // Nachlauf (nur NACH einer gerade gelaufenen Aufnahme)
  if (
    recordings.some(
      r => now >= r.aufnahmeEnde && now < r.ausschaltZeit
    )
  ) {
    return {
      decision: "KEEP_RUNNING",
      reason: "post-run active",
    }
  }

  return {
    decision: "NO_ACTION",
    reason: "idle",
  }
}
