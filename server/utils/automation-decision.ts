import { isNowInScheduledPeriod } from "./time-utils";
import {
  ParsedRecording,
  parseRecording,
} from "~/utils/plex-recording";

export function computeAutomationDecision(
  recordings: ParsedRecording[],
  now: Date,
  cfg: any
) {
  /* ------------------------------------------------------------
     1. Scheduled ON (harte Übersteuerung)
  ------------------------------------------------------------ */

  const forced = isNowInScheduledPeriod(now, cfg.SCHEDULED_ON_PERIODS);
  if (forced.active) {
    return {
      decision: "KEEP_RUNNING",
      reason: forced.reason ?? "scheduled on window",
    };
  }

  /* ------------------------------------------------------------
     2. Aufnahme-Zeitfenster inkl. Grace-Ausschaltzeit
        [aufnahmeStart ... graceAusschaltZeit]
  ------------------------------------------------------------ */

  if (
    recordings.some(
      (r) =>
        now >= r.aufnahmeStart &&
        now < r.graceAusschaltZeit
    )
  ) {
    return {
      decision: "KEEP_RUNNING",
      reason: "recording or grace after recording",
    };
  }

  /* ------------------------------------------------------------
     3. Sonst: OFF
  ------------------------------------------------------------ */

  return {
    decision: "NO_ACTION",
    reason: "idle",
  };
}


// import { isNowInScheduledPeriod } from "./time-utils";
// import { ParsedRecording } from "../../utils/plex-recording";

// export function computeAutomationDecision(
//   recordings: ParsedRecording[],
//   now: Date,
//   cfg: any
// ) {
//   /* ------------------------------------------------------------
//      Scheduled ON
//   ------------------------------------------------------------ */

//   const forced = isNowInScheduledPeriod(now, cfg.SCHEDULED_ON_PERIODS);
//   if (forced.active) {
//     return {
//       decision: "KEEP_RUNNING",
//       reason: forced.reason ?? "scheduled on window",
//     };
//   }

//   /* ------------------------------------------------------------
//      Aufnahme läuft JETZT
//   ------------------------------------------------------------ */

//   if (
//     recordings.some(
//       (r) => now >= r.aufnahmeStart && now < r.aufnahmeEnde
//     )
//   ) {
//     return {
//       decision: "KEEP_RUNNING",
//       reason: "recording active",
//     };
//   }

//   /* ------------------------------------------------------------
//      Vorlauf
//   ------------------------------------------------------------ */

//   if (
//     recordings.some(
//       (r) => now >= r.einschaltZeit && now < r.aufnahmeStart
//     )
//   ) {
//     return {
//       decision: "KEEP_RUNNING",
//       reason: "approaching recording",
//     };
//   }

//   /* ------------------------------------------------------------
//      Nachlauf
//   ------------------------------------------------------------ */

//   if (
//     recordings.some(
//       (r) => now >= r.aufnahmeEnde && now < r.ausschaltZeit
//     )
//   ) {
//     return {
//       decision: "KEEP_RUNNING",
//       reason: "post-run active",
//     };
//   }

//   /* ------------------------------------------------------------
//      Grace Period ZWISCHEN zwei Aufnahmen
//   ------------------------------------------------------------ */

//   const graceMs = (cfg.GRACE_PERIOD_MIN ?? 0) * 60_000;

//   if (graceMs > 0 && recordings.length >= 2) {
//     const sorted = recordings
//       .slice()
//       .sort(
//         (a, b) =>
//           a.aufnahmeStart.getTime() - b.aufnahmeStart.getTime()
//       );

//     for (let i = 0; i < sorted.length - 1; i++) {
//       const cur = sorted[i];
//       const next = sorted[i + 1];

//       // wir befinden uns in der Lücke
//       if (
//         now >= cur.ausschaltZeit &&
//         now < next.einschaltZeit &&
//         next.einschaltZeit.getTime() -
//           cur.ausschaltZeit.getTime() <= graceMs
//       ) {
//         return {
//           decision: "KEEP_RUNNING",
//           reason: "grace period between recordings",
//         };
//       }
//     }
//   }

//   /* ------------------------------------------------------------
//      Idle
//   ------------------------------------------------------------ */

//   return {
//     decision: "NO_ACTION",
//     reason: "idle",
//   };
// }


// import { isNowInScheduledPeriod } from "./time-utils";
// import { ParsedRecording } from "../../utils/plex-recording";

// export function computeAutomationDecision(
//   recordings: ParsedRecording[],
//   now: Date,
//   cfg: any
// ) {
//   // Scheduled ON
//   const forced = isNowInScheduledPeriod(now, cfg.SCHEDULED_ON_PERIODS)
//   if (forced.active) {
//     return {
//       decision: "KEEP_RUNNING",
//       reason: forced.reason ?? "scheduled on window",
//     }
//   }

//   // Aufnahme läuft JETZT
//   if (
//     recordings.some(
//       r => now >= r.aufnahmeStart && now < r.aufnahmeEnde
//     )
//   ) {
//     return {
//       decision: "KEEP_RUNNING",
//       reason: "recording active",
//     }
//   }

//   // Vorlauf (wir nähern uns)
//   if (
//     recordings.some(
//       r => now >= r.einschaltZeit && now < r.aufnahmeStart
//     )
//   ) {
//     return {
//       decision: "KEEP_RUNNING",
//       reason: "approaching recording",
//     }
//   }

//   // Nachlauf (nur NACH einer gerade gelaufenen Aufnahme)
//   if (
//     recordings.some(
//       r => now >= r.aufnahmeEnde && now < r.ausschaltZeit
//     )
//   ) {
//     return {
//       decision: "KEEP_RUNNING",
//       reason: "post-run active",
//     }
//   }

//   return {
//     decision: "NO_ACTION",
//     reason: "idle",
//   }
// }
