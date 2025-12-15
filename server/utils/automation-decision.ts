import { isNowInScheduledPeriod } from "./time-utils";
import { ParsedRecording } from "../../utils/plex-recording";

export function computeAutomationDecision(
  recordings: ParsedRecording[],
  now: Date,
  cfg: any
) {
  // Scheduled ON
  const forced = isNowInScheduledPeriod(
    now,
    cfg.SCHEDULED_ON_PERIODS
  );
  if (forced.active) {
    return {
      decision: "KEEP_RUNNING",
      reason: forced.reason ?? "scheduled on window",
    };
  }

  // Recording läuft
  if (
    recordings.some(
      r => r.aufnahmeStart <= now && r.aufnahmeEnde > now
    )
  ) {
    return {
      decision: "KEEP_RUNNING",
      reason: "recording active",
    };
  }

  // Vorlauf
  if (
    recordings.some(
      r => r.einschaltZeit <= now && r.aufnahmeStart > now
    )
  ) {
    return {
      decision: "KEEP_RUNNING",
      reason: "approaching recording",
    };
  }

  // Nachlauf
  if (
    recordings.some(r => r.ausschaltZeit > now)
  ) {
    return {
      decision: "KEEP_RUNNING",
      reason: "post-run active",
    };
  }

  return {
    decision: "NO_ACTION",
    reason: "idle",
  };
}
