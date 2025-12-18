import { loadConfig, saveConfig, isOncePeriodExpired } from "./config";

const AUTO_ID = "auto-proxmox-backup";
const PRE_MIN = 15;
const POST_MIN = 15;
const FALLBACK_DURATION_MIN = 60;

export async function syncProxmoxBackupOnceWindow(): Promise<boolean> {
  const cfg = loadConfig();

  const now = new Date();

  const before = cfg.SCHEDULED_ON_PERIODS.length;

  cfg.SCHEDULED_ON_PERIODS = cfg.SCHEDULED_ON_PERIODS.filter((p: any) => {
    if (p.id === AUTO_ID && isOncePeriodExpired(p, now)) {
      return false;
    }
    return true;
  });

  const cleaned = before !== cfg.SCHEDULED_ON_PERIODS.length;

  if (cleaned) {
    console.info("[PROXMOX] expired backup window removed");
  }

  const runtime = useRuntimeConfig();

  if (!cfg.PROXMOX?.enabled) return false;

  const auth = {
    Authorization: `PVEAPIToken=${runtime.proxmoxTokenId}=${runtime.proxmoxTokenSecret}`,
  };

  /* ------------------------------------------------------------
     1. Nächstes geplantes Backup
  ------------------------------------------------------------ */
  const cluster: any = await $fetch(
    `${runtime.proxmoxHost}/api2/json/cluster/backup`,
    { headers: auth, timeout: 5000 }
  );

  const job = cluster?.data?.[0];
  if (!job?.["next-run"]) return false;

  const nextRunMs = job["next-run"] * 1000;

  /* ------------------------------------------------------------
     2. Letztes vzdump (Dauer ermitteln)
  ------------------------------------------------------------ */
  const since = Math.floor((Date.now() - 7 * 86400_000) / 1000);

  const tasks: any = await $fetch(
    `${runtime.proxmoxHost}/api2/json/nodes/${runtime.proxmoxNode}/tasks?since=${since}&typefilter=vzdump`,
    { headers: auth, timeout: 5000 }
  );

  const last = tasks?.data?.find((t: any) => t.endtime && t.starttime);

  const durationMs = last
    ? (last.endtime - last.starttime) * 1000
    : FALLBACK_DURATION_MIN * 60_000;

  /* ------------------------------------------------------------
     3. Fenster berechnen
  ------------------------------------------------------------ */
  const startMs = nextRunMs - PRE_MIN * 60_000;
  const endMs = nextRunMs + durationMs + POST_MIN * 60_000;

  const start = toTime(startMs);
  const end = toTime(endMs);
  const date = toDate(startMs);

  /* ------------------------------------------------------------
     4. In Config einpflegen (idempotent)
  ------------------------------------------------------------ */
  const periods = cfg.SCHEDULED_ON_PERIODS ?? [];
  const existing = periods.find((p: any) => p.id === AUTO_ID);

  const next = {
    id: AUTO_ID,
    active: true,
    type: "once",
    date,
    start,
    end,
    label: "Proxmox Backup (auto)",
  };

  const changed =
    !existing ||
    existing.date !== date ||
    existing.start !== start ||
    existing.end !== end;

  if (!changed) return false;

  cfg.SCHEDULED_ON_PERIODS = [
    ...periods.filter((p: any) => p.id !== AUTO_ID),
    next,
  ];

  if (changed || cleaned) {
    saveConfig(cfg);
    return true;
  }
  return false;
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
