import { isVuPlusOn } from "./vuplus-utils";
import { isNasOnlineByPort } from "./nas-utils";
import { isProxmoxBackupRunning } from "./proxmox-utils";
import { loadConfig } from "./config";
import { applyDecision } from "./automation-machine";
import { isNowInScheduledPeriod } from "./time-utils";
import { ParsedRecording, parseRecording} from "./plex-recording";

/* ------------------------------------------------------------------
   TYPES
------------------------------------------------------------------ */
type Decision =
  | "START_REQUIRED_DEVICES"
  | "KEEP_RUNNING"
  | "SHUTDOWN_ALL"
  | "SHUTDOWN_NAS"
  | "NO_ACTION"
  | "ERROR_REQUIRED_DEVICE";

// interface ParsedRecording {
//   seriesTitle?: string;
//   episodeTitle?: string;

//   seasonNumber?: number;
//   episodeNumber?: number;

//   displayTitle: string;

//   aufnahmeStart: Date;
//   aufnahmeEnde: Date;
//   einschaltZeit: Date;
//   ausschaltZeit: Date;
// }

/* ------------------------------------------------------------------
   NIGHT PERIOD (bleibt separat!)
------------------------------------------------------------------ */
function isNowInNightPeriod(
  now: Date,
  night?: { enabled?: boolean; start: string; end: string }
): boolean {
  if (!night?.enabled) return false;

  const [sh, sm] = night.start.split(":").map(Number);
  const [eh, em] = night.end.split(":").map(Number);

  const start = new Date(now);
  start.setHours(sh, sm, 0, 0);

  const end = new Date(now);
  end.setHours(eh, em, 0, 0);

  // über Mitternacht
  if (end <= start) {
    return now >= start || now <= end;
  }

  return now >= start && now <= end;
}

/* ------------------------------------------------------------------
   MAIN AUTOMATION
------------------------------------------------------------------ */
export async function runAutomationDryRun(schedule: any) {
  const config = loadConfig();
  const now = new Date();

  /* --------------------------------------------------------------
     0) ABSOLUTE PRIORITÄT: PROXMOX BACKUP
  -------------------------------------------------------------- */
  if (await isProxmoxBackupRunning()) {
    return decide("KEEP_RUNNING", "proxmox backup running");
  }

  /* --------------------------------------------------------------
     1) GEPLANTE ZEITFENSTER (daily / weekly / once)
  -------------------------------------------------------------- */
  const forced = isNowInScheduledPeriod(now, config.SCHEDULED_ON_PERIODS);

  if (forced.active) {
    return decide("KEEP_RUNNING", forced.reason ?? "scheduled on window");
  }

  const inNightPeriod = isNowInNightPeriod(now, config.NIGHT_PERIOD);

  const [nasOnline, vuOn] = await Promise.all([
    isNasOnlineByPort(),
    isVuPlusOn(),
  ]);

  /* --------------------------------------------------------------
     2) RECORDINGS PARSE
  -------------------------------------------------------------- */
  const raw = schedule?.data?.MediaContainer?.MediaGrabOperation ?? [];

  if (!raw.length) {
    if (nasOnline || vuOn) {
      return inNightPeriod
        ? decide("SHUTDOWN_ALL", "no recordings (night)")
        : decide("SHUTDOWN_NAS", "no recordings (day)");
    }
    return decide("NO_ACTION", "idle");
  }

  const recordings = raw
    .map((r: any) => parseRecording(r, config))
    .filter(Boolean) as ParsedRecording[];

  recordings.sort(
    (a, b) => a.aufnahmeStart.getTime() - b.aufnahmeStart.getTime()
  );

  /* --------------------------------------------------------------
   A) AKTUELL LAUFENDE AUFNAHME
-------------------------------------------------------------- */
  const running = recordings.find(
    (r) => now >= r.aufnahmeStart && now <= r.aufnahmeEnde
  );

  if (running) {
    const label = running.displayTitle
      ? `recording active: ${running.displayTitle}`
      : "recording active";

    if (!nasOnline || !vuOn) {
      return decide(
        "ERROR_REQUIRED_DEVICE",
        `${label} (nas=${nasOnline}, vuplus=${vuOn})`
      );
    }

    return decide("KEEP_RUNNING", label);
  }

  /* --------------------------------------------------------------
   B) NÄCHSTE ZUKÜNFTIGE AUFNAHME
-------------------------------------------------------------- */
  const next = recordings
    .filter((r) => r.aufnahmeStart > now)
    .sort((a, b) => a.aufnahmeStart.getTime() - b.aufnahmeStart.getTime())[0];

  if (!next) {
    if (nasOnline || vuOn) {
      return inNightPeriod
        ? decide("SHUTDOWN_ALL", "no future recordings (night)")
        : decide("SHUTDOWN_NAS", "no future recordings (day)");
    }
    return decide("NO_ACTION", "idle");
  }

  /* --------------------------------------------------------------
   C) BEFORE RECORDING → START REQUIRED DEVICES
-------------------------------------------------------------- */
  if (now >= next.einschaltZeit) {
    if (!nasOnline || !vuOn) {
      const label = next.displayTitle
        ? `approaching recording: ${next.displayTitle}`
        : "approaching recording";

      return decide(
        "START_REQUIRED_DEVICES",
        `${label} (nas=${nasOnline}, vuplus=${vuOn})`
      );
    }
  }

  /* --------------------------------------------------------------
     5) GRACE / SHUTDOWN
  -------------------------------------------------------------- */
  const gapMinutes = (next.aufnahmeStart.getTime() - now.getTime()) / 60000;

  if (gapMinutes <= config.GRACE_PERIOD_MIN) {
    return decide(
      "KEEP_RUNNING",
      next.displayTitle
        ? `within grace period before | ${next.displayTitle}`
        : "within grace period"
    );
  }

  if (now >= next.ausschaltZeit) {
    return inNightPeriod
      ? decide("SHUTDOWN_ALL", "past shutdown time (night)")
      : decide("SHUTDOWN_NAS", "past shutdown time (day)");
  }

  return decide("NO_ACTION", "waiting");
}

/* ------------------------------------------------------------------
   DECISION HOOK
------------------------------------------------------------------ */
function decide(decision: Decision, reason: string) {
  const entry = {
    time: new Date().toISOString(),
    decision,
    reason,
  };

  // console.log(`[AUTOMATION-UTIL]    decision=${entry.decision} reason="${entry.reason}"`);
  applyDecision(decision, reason);
  return entry;
}

// /* ------------------------------------------------------------------
//    RECORD PARSER
// ------------------------------------------------------------------ */

// function parseRecording(
//   rec: any,
//   config: any
// ): ParsedRecording | null {
//   const meta = rec.Metadata;
//   const media = meta?.Media?.[0];
//   if (!meta || !media) return null;

//   const begins = media.beginsAt * 1000;
//   const ends = media.endsAt * 1000;

//   const startOffset =
//     Number(media.startOffsetSeconds ?? 0) * 1000;
//   const endOffset =
//     Number(media.endOffsetSeconds ?? 0) * 1000;

//   const aufnahmeStart = new Date(begins - startOffset);
//   const aufnahmeEnde = new Date(ends + endOffset);

//   // Plex Meta
//   const seriesTitle =
//     meta.grandparentTitle ?? meta.parentTitle;

//   const episodeTitle =
//     meta.type === "episode" ? meta.displayTitle : undefined;

//   const seasonNumber =
//     meta.parentIndex != null
//       ? Number(meta.parentIndex)
//       : undefined;

//   const episodeNumber =
//     meta.index != null
//       ? Number(meta.index)
//       : undefined;

//   // S02E05 Format
//   const seasonEpisode =
//     seasonNumber != null && episodeNumber != null
//       ? `S${String(seasonNumber).padStart(2, "0")}E${String(
//           episodeNumber
//         ).padStart(2, "0")}`
//       : undefined;

//   // DISPLAY TITLE (zentral!)
//   let displayTitle = meta.displayTitle ?? "Unbekannte Aufnahme";

//   if (meta.type === "episode" && seriesTitle) {
//     displayTitle = seasonEpisode
//       ? episodeTitle
//         ? `${seriesTitle} – ${seasonEpisode} – ${episodeTitle}`
//         : `${seriesTitle} – ${seasonEpisode}`
//       : episodeTitle
//       ? `${seriesTitle} – ${episodeTitle}`
//       : seriesTitle;
//   }

//   return {
//     seriesTitle,
//     episodeTitle,
//     seasonNumber,
//     episodeNumber,
//     displayTitle,

//     aufnahmeStart,
//     aufnahmeEnde,
//     einschaltZeit: new Date(
//       aufnahmeStart.getTime() -
//         config.VORLAUF_AUFWACHEN_MIN * 60000
//     ),
//     ausschaltZeit: new Date(
//       aufnahmeEnde.getTime() +
//         config.AUSSCHALT_NACHLAUF_MIN * 60000
//     ),
//   };
// }
