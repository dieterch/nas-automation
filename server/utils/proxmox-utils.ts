import { loadConfig, saveConfig, isOncePeriodExpired } from "./config";

const AUTO_ID = "auto-proxmox-backup";
const PRE_MIN = 30;
const POST_MIN = 20;
const FALLBACK_DURATION_MIN = 60;

export async function syncProxmoxBackupOnceWindow(): Promise<boolean> {
  const cfg = loadConfig();
  const now = new Date();

  /* ------------------------------------------------------------
     0. Abgelaufene Auto-Fenster entfernen
  ------------------------------------------------------------ */
  const before = cfg.SCHEDULED_ON_PERIODS.length;

  cfg.SCHEDULED_ON_PERIODS = cfg.SCHEDULED_ON_PERIODS.filter((p: any) => {
    if (p.id === AUTO_ID && isOncePeriodExpired(p, now)) return false;
    return true;
  });

  const cleaned = before !== cfg.SCHEDULED_ON_PERIODS.length;
  if (cleaned) {
    console.info("[PROXMOX] expired backup window removed");
  }

  if (!cfg.PROXMOX?.enabled) {
    console.info("[PROXMOX] integration disabled");
    return false;
  }

  const runtime = useRuntimeConfig();

  const pveAuth = {
    Authorization: `PVEAPIToken=${runtime.proxmoxTokenId}=${runtime.proxmoxTokenSecret}`,
  };

  const pbsAuth = {
    Authorization: `PBSAPIToken=${runtime.pbsTokenId}=${runtime.pbsTokenSecret}`,
  };

  /* ------------------------------------------------------------
     1. Proxmox vzdump → NAS ?
  ------------------------------------------------------------ */
  const cluster: any = await $fetch(
    `${runtime.proxmoxHost}/api2/json/cluster/backup`,
    { headers: pveAuth, timeout: 5000 }
  );

  const nasVzdumpJob = cluster?.data?.find(
    (j: any) =>
      j.enabled === 1 &&
      j.type === "vzdump" &&
      j.storage === "nas" &&
      j["next-run"]
  );

  /* ------------------------------------------------------------
     2. PBS SyncJob → NAS ?
  ------------------------------------------------------------ */
  const syncCfg: any = await $fetch(
    `${runtime.pbsHost}/api2/json/config/sync`,
    { headers: pbsAuth, timeout: 5000 }
  );

  const nasSyncJob = syncCfg?.data?.find(
    (j: any) =>
      j.enabled === 1 &&
      j.store === "backup-nfs" &&
      j.schedule
  );

  if (!nasVzdumpJob && !nasSyncJob) {
    console.info(
      "[PROXMOX] no enabled NAS-related backup jobs found – skipping window"
    );
    return cleaned;
  }

  /* ------------------------------------------------------------
     3. Quelle bestimmen + Startzeit
  ------------------------------------------------------------ */
  let source: "vzdump" | "pbs-sync";
  let nextRunMs: number;

  if (nasVzdumpJob) {
    source = "vzdump";
    nextRunMs = nasVzdumpJob["next-run"] * 1000;
    console.info(
      "[PROXMOX] NAS required by Proxmox vzdump (next-run=%s)",
      new Date(nextRunMs).toLocaleString()
    );
  } else {
    source = "pbs-sync";
    nextRunMs = parseScheduleToNextRun(nasSyncJob.schedule);
    console.info(
      "[PROXMOX] NAS required by PBS syncjob (schedule=%s)",
      nasSyncJob.schedule
    );
  }

  /* ------------------------------------------------------------
     4. Dauer ermitteln
  ------------------------------------------------------------ */
  const since = Math.floor((Date.now() - 14 * 86400_000) / 1000);

  let durationMs = FALLBACK_DURATION_MIN * 60_000;

  if (source === "vzdump") {
    const tasks: any = await $fetch(
      `${runtime.proxmoxHost}/api2/json/nodes/${runtime.proxmoxNode}/tasks?since=${since}&typefilter=vzdump`,
      { headers: pveAuth, timeout: 5000 }
    );

    const last = tasks?.data?.find((t: any) => t.starttime && t.endtime);
    if (last) {
      durationMs = (last.endtime - last.starttime) * 1000;
    }
  } else {
    const tasks: any = await $fetch(
      `${runtime.pbsHost}/api2/json/nodes/pve/tasks?since=${since}&typefilter=syncjob`,
      { headers: pbsAuth, timeout: 5000 }
    );

    const last = tasks?.data?.find(
      (t: any) =>
        t.starttime &&
        t.endtime &&
        t.worker_id?.includes(nasSyncJob.id)
    );

    if (last) {
      durationMs = (last.endtime - last.starttime) * 1000;
    }
  }

  console.info(
    "[PROXMOX] backup duration=%d min (source=%s)",
    Math.round(durationMs / 60000),
    source
  );

  /* ------------------------------------------------------------
     5. Fenster berechnen
  ------------------------------------------------------------ */
  const startMs = nextRunMs - PRE_MIN * 60_000;
  const endMs = nextRunMs + durationMs + POST_MIN * 60_000;

  const next = {
    id: AUTO_ID,
    active: true,
    type: "once",
    date: toDate(startMs),
    start: toTime(startMs),
    end: toTime(endMs),
    label: `Proxmox Backup (auto:${source})`,
  };

  console.info(
    "[PROXMOX] NAS window %s %s–%s",
    next.date,
    next.start,
    next.end
  );

  /* ------------------------------------------------------------
     6. Idempotent speichern
  ------------------------------------------------------------ */
  const periods = cfg.SCHEDULED_ON_PERIODS ?? [];
  const existing = periods.find((p: any) => p.id === AUTO_ID);

  const changed =
    !existing ||
    existing.date !== next.date ||
    existing.start !== next.start ||
    existing.end !== next.end;

  if (!changed && !cleaned) return false;

  cfg.SCHEDULED_ON_PERIODS = [
    ...periods.filter((p: any) => p.id !== AUTO_ID),
    next,
  ];

  saveConfig(cfg);
  return true;
}

/* ------------------------------------------------------------
   Helpers (lokale Zeit!)
------------------------------------------------------------ */

function toDate(ms: number) {
  const d = new Date(ms);
  return d.toISOString().slice(0, 10);
}

function toTime(ms: number) {
  const d = new Date(ms);
  return d.toTimeString().slice(0, 5);
}

/* ------------------------------------------------------------
   PBS schedule → next run (HH:mm)
------------------------------------------------------------ */
function parseScheduleToNextRun(schedule: string): number {
  const [h, m] = schedule.split(":").map(Number);
  const now = new Date();
  const next = new Date(now);

  next.setHours(h, m, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);

  return next.getTime();
}


// import { loadConfig, saveConfig, isOncePeriodExpired } from "./config";

// const AUTO_ID = "auto-proxmox-backup";
// const PRE_MIN = 30;
// const POST_MIN = 20;
// const FALLBACK_DURATION_MIN = 60;

// export async function syncProxmoxBackupOnceWindow(): Promise<boolean> {
//   const cfg = loadConfig();

//   const now = new Date();

//   const before = cfg.SCHEDULED_ON_PERIODS.length;

//   cfg.SCHEDULED_ON_PERIODS = cfg.SCHEDULED_ON_PERIODS.filter((p: any) => {
//     if (p.id === AUTO_ID && isOncePeriodExpired(p, now)) {
//       return false;
//     }
//     return true;
//   });

//   const cleaned = before !== cfg.SCHEDULED_ON_PERIODS.length;

//   if (cleaned) {
//     console.info("[PROXMOX] expired backup window removed");
//   }

//   const runtime = useRuntimeConfig();

//   if (!cfg.PROXMOX?.enabled) return false;

//   const auth = {
//     Authorization: `PVEAPIToken=${runtime.proxmoxTokenId}=${runtime.proxmoxTokenSecret}`,
//   };

//   /* ------------------------------------------------------------
//      1. Nächstes geplantes Backup
//   ------------------------------------------------------------ */
//   const cluster: any = await $fetch(
//     `${runtime.proxmoxHost}/api2/json/cluster/backup`,
//     { headers: auth, timeout: 5000 }
//   );

//   const job = cluster?.data?.[0];
//   if (!job?.["next-run"]) return false;

//   const nextRunMs = job["next-run"] * 1000;

//   /* ------------------------------------------------------------
//      2. Letztes vzdump (Dauer ermitteln)
//   ------------------------------------------------------------ */
//   const since = Math.floor((Date.now() - 7 * 86400_000) / 1000);

//   const tasks: any = await $fetch(
//     `${runtime.proxmoxHost}/api2/json/nodes/${runtime.proxmoxNode}/tasks?since=${since}&typefilter=vzdump`,
//     { headers: auth, timeout: 5000 }
//   );

//   const last = tasks?.data?.find((t: any) => t.endtime && t.starttime);

//   const durationMs = last
//     ? (last.endtime - last.starttime) * 1000
//     : FALLBACK_DURATION_MIN * 60_000;

//   /* ------------------------------------------------------------
//      3. Fenster berechnen
//   ------------------------------------------------------------ */
//   const startMs = nextRunMs - PRE_MIN * 60_000;
//   const endMs = nextRunMs + durationMs + POST_MIN * 60_000;

//   const start = toTime(startMs);
//   const end = toTime(endMs);
//   const date = toDate(startMs);

//   /* ------------------------------------------------------------
//      4. In Config einpflegen (idempotent)
//   ------------------------------------------------------------ */
//   const periods = cfg.SCHEDULED_ON_PERIODS ?? [];
//   const existing = periods.find((p: any) => p.id === AUTO_ID);

//   const next = {
//     id: AUTO_ID,
//     active: true,
//     type: "once",
//     date,
//     start,
//     end,
//     label: "Proxmox Backup (auto)",
//   };

//   const changed =
//     !existing ||
//     existing.date !== date ||
//     existing.start !== start ||
//     existing.end !== end;

//   if (!changed) return false;

//   cfg.SCHEDULED_ON_PERIODS = [
//     ...periods.filter((p: any) => p.id !== AUTO_ID),
//     next,
//   ];

//   if (changed || cleaned) {
//     saveConfig(cfg);
//     return true;
//   }
//   return false;
// }

// /* ------------------------------------------------------------
//    Helpers (lokale Zeit!)
// ------------------------------------------------------------ */
// function toDate(ms: number) {
//   const d = new Date(ms);
//   return d.toISOString().slice(0, 10);
// }

// function toTime(ms: number) {
//   const d = new Date(ms);
//   return d.toTimeString().slice(0, 5);
// }
