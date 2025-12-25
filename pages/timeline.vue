<template>
  <div class="page">
    <h1>NAS Automation – Timeline</h1>

    <div class="controls">
      <label>
        Zeitraum:
        <select v-model="range">
          <option value="2d">Heute + Morgen</option>
          <option value="7d">1 Woche</option>
          <option value="all">Alle</option>
        </select>
      </label>
    </div>

    <!--div class="status" :class="statusNow">
      STATUS (jetzt): {{ statusNow }}
    </div-->

    <svg
      v-if="statusSegments.length"
      :width="SVG_WIDTH"
      :height="svgHeight"
      class="timeline"
    >
      <!-- TIME AXIS -->
      <g class="time-axis">
        <g v-for="(t, i) in ticks" :key="i">
          <!-- Tick line -->
          <line
            :x1="xFor(t.time)"
            :x2="xFor(t.time)"
            y1="0"
            :y2="HEADER_HEIGHT"
            class="tick-line"
          />
          <!-- Label -->
          <text
            :x="xFor(t.time)"
            y="12"
            text-anchor="middle"
            class="tick-label"
          >
            {{ t.label }}
          </text>
        </g>
      </g>

      <!-- NOW LABEL -->
      <g class="now-label">
        <text 
          :x="xFor(now) + 18" 
          :y="HEADER_HEIGHT + 14" 
          text-anchor="middle">
          {{ formatTime(now) }}
        </text>
      </g>

      <!-- GRIDLINES -->
      <g class="gridlines">
        <g v-for="(t, i) in ticks" :key="i">
          <line
            :x1="xFor(t.time)"
            :x2="xFor(t.time)"
            :y1="HEADER_HEIGHT"
            :y2="svgHeight"
            class="grid-line"
          />
        </g>
      </g>

      <!-- STATUS BACKGROUND -->
      <g v-for="(seg, i) in statusSegments" :key="i">
        <rect
          :x="xFor(seg.start)"
          y="0"
          :width="xFor(seg.end) - xFor(seg.start)"
          :height="svgHeight"
          :class="`bg-${seg.status}`"
        />
      </g>

      <!-- RECORDINGS -->
      <g v-for="(r, i) in recordings" :key="i">
        <!--rect
          :x="xFor(r.einschaltZeit)"
          :y="rowY(i)"
          :width="xFor(r.graceAusschaltZeit) - xFor(r.einschaltZeit)"
          height="20"
          class="recording"
        /-->
        <!-- einschaltZeit - sendungsStart -->
        <rect
          :x="xFor(r.einschaltZeit)"
          :y="rowY(i)"
          :width="xFor(r.sendungsStart) - xFor(r.einschaltZeit)"
          height="20"
          class="prepostrun"
        />
        <!-- sendungsStart - sendungsEnde -->
        <rect
          :x="xFor(r.sendungsStart)"
          :y="rowY(i)"
          :width="xFor(r.sendungsEnde) - xFor(r.sendungsStart)"
          height="20"
          class="recording"
        />
        <!-- sendungsEnde - ausschaltZeit -->
        <rect
          :x="xFor(r.sendungsEnde)"
          :y="rowY(i)"
          :width="xFor(r.ausschaltZeit) - xFor(r.sendungsEnde)"
          height="20"
          class="prepostrun"
        />
        <!-- ausschaltZeit - graceAusschaltZeit-->
        <rect
          :x="xFor(r.ausschaltZeit)"
          :y="rowY(i)"
          :width="xFor(r.graceAusschaltZeit) - xFor(r.ausschaltZeit)"
          height="20"
          class="graceperiod"
        />
        <text :x="LEFT_PAD - 10" :y="rowY(i) + 10" text-anchor="end">
          {{ r.displayTitle }}
        </text>
        <text
          :x="LEFT_PAD - 10"
          :y="rowY(i) + 24"
          text-anchor="end"
          font-size="12px"
        >
          {{ format(r.sendungsStart) }} - {{ formatTime(r.sendungsEnde) }}
        </text>
      </g>

      <!-- NOW -->
      <line
        :x1="xFor(now)"
        :x2="xFor(now)"
        y1="0"
        :y2="svgHeight"
        class="now-line"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computeAutomationDecision } from "~/server/utils/automation-decision";

/* ------------------------------------------------------------
   DTO (GENAU wie API!)
------------------------------------------------------------ */

interface TimelineRecordingDTO {
  displayTitle: string;
  einschaltZeit: string;
  ausschaltZeit: string;
  graceAusschaltZeit: string;
  aufnahmeStart: string;
  aufnahmeEnde: string;
  sendungsStart: string;
  sendungsEnde: string;
}

/* ------------------------------------------------------------
   FETCH
------------------------------------------------------------ */

const { data: timelineRaw } = await useFetch("/api/automation/timeline");
const { data: cfg } = await useFetch("/api/config");

const safeTimeline = computed(() => timelineRaw.value ?? null);
const safeCfg = computed(() => cfg.value ?? null);

/* ------------------------------------------------------------
   BASE
------------------------------------------------------------ */
const HEADER_HEIGHT = 12;

const now = computed(() =>
  timelineRaw.value?.now ? new Date(timelineRaw.value.now) : new Date()
);

/* ------------------------------------------------------------
   RECORDINGS (NORMALISIERT!)
------------------------------------------------------------ */

const recordings = computed(() => {
  const tl = timelineRaw.value;
  if (!tl || !Array.isArray(tl.recordings)) return [];

  return tl.recordings.map((r: TimelineRecordingDTO) => ({
    displayTitle: r.displayTitle,
    einschaltZeit: new Date(r.einschaltZeit),
    ausschaltZeit: new Date(r.ausschaltZeit),
    graceAusschaltZeit: new Date(r.graceAusschaltZeit),
    aufnahmeStart: new Date(r.aufnahmeStart),
    aufnahmeEnde: new Date(r.aufnahmeEnde),
    sendungsStart: new Date(r.sendungsStart),
    sendungsEnde: new Date(r.sendungsEnde),
  }));
});

/* ------------------------------------------------------------
   RANGE
------------------------------------------------------------ */

const range = ref<"2d" | "7d" | "all">("2d");

const rangeEnd = computed(() => {
  const d = new Date(now.value);
  if (range.value === "2d") d.setDate(d.getDate() + 2);
  else if (range.value === "7d") d.setDate(d.getDate() + 7);
  else d.setFullYear(d.getFullYear() + 10);
  return d;
});

const visibleRecordings = computed(() =>
  recordings.value.filter(
    (r) =>
      r.graceAusschaltZeit instanceof Date &&
      r.graceAusschaltZeit >= now.value &&
      r.einschaltZeit <= rangeEnd.value
  )
);

/* ------------------------------------------------------------
   LAYOUT
------------------------------------------------------------ */

const SVG_WIDTH = 1340;
const ROW_HEIGHT = 36;
const LEFT_PAD = 400;
const RIGHT_PAD = 0;

const svgHeight = computed(
  () => HEADER_HEIGHT + 40 + visibleRecordings.value.length * ROW_HEIGHT
);

/* ------------------------------------------------------------
   TIME SCALE
------------------------------------------------------------ */

const minTime = computed<Date>(() => {
  if (visibleRecordings.value.length === 0) {
    return now.value;
  }

  let min = Infinity;

  for (const r of visibleRecordings.value) {
    const t = r.einschaltZeit.getTime();
    if (t < min) min = t;
  }

  return new Date(min);
});

const maxTime = computed<Date>(() => {
  if (visibleRecordings.value.length === 0) {
    return now.value;
  }

  let max = -Infinity;

  for (const r of visibleRecordings.value) {
    const t = r.graceAusschaltZeit.getTime();
    if (t > max) max = t;
  }

  return new Date(max);
});

function xFor(t: Date): number {
  const span = maxTime.value.getTime() - minTime.value.getTime();
  if (span <= 0) return LEFT_PAD;
  return (
    LEFT_PAD +
    ((t.getTime() - minTime.value.getTime()) / span) *
      (SVG_WIDTH - LEFT_PAD - RIGHT_PAD)
  );
}

// function rowY(i: number): number {
//   return 30 + i * ROW_HEIGHT
// }

function rowY(i: number): number {
  return HEADER_HEIGHT + 30 + i * ROW_HEIGHT;
}

type Tick = { time: Date; label: string };

const ticks = computed<Tick[]>(() => {
  const start = minTime.value;
  const end = maxTime.value;

  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;

  // 🔑 Intervall bestimmen
  let step = DAY;
  if (range.value === "2d") step = 6 * HOUR;
  else if (range.value === "7d") step = DAY;

  const ticks: Tick[] = [];

  const d = new Date(start);

  if (step === DAY) {
    d.setHours(0, 0, 0, 0);
  } else {
    // 🔑 auf 6h-Grenze runden (0,6,12,18)
    d.setMinutes(0, 0, 0);
    d.setHours(Math.floor(d.getHours() / 6) * 6);
  }

  while (d <= end) {
    ticks.push({
      time: new Date(d),
      label:
        step === DAY
          ? d.toLocaleDateString("de-AT", {
              weekday: "short",
              day: "2-digit",
              month: "2-digit",
            })
          : d.toLocaleTimeString("de-AT", {
              hour: "2-digit",
            }),
    });

    d.setTime(d.getTime() + step);
  }

  return ticks;
});

/* ------------------------------------------------------------
   STATUS (NUR computeAutomationDecision!)
------------------------------------------------------------ */

type Status = "ACTIVE" | "GRACE" | "OFF";

function statusAt(t: Date): Status {
  const cfgVal = safeCfg.value;
  if (!cfgVal) return "OFF";

  const res = computeAutomationDecision(recordings.value as any, t, cfgVal);

  if (res.decision !== "KEEP_RUNNING") return "OFF";
  return res.reason?.includes("grace") ? "GRACE" : "ACTIVE";
}

const statusNow = computed<Status>(() => statusAt(now.value));

/* ------------------------------------------------------------
   STATUS SEGMENTS (ACTIVE + OFF)
------------------------------------------------------------ */

type Interval = {
  start: Date
  end: Date
}

type StatusSegment = {
  start: Date
  end: Date
  status: "ACTIVE" | "OFF"
}

const statusSegments = computed<StatusSegment[]>(() => {
  const recs = visibleRecordings.value
  if (recs.length === 0) return []

  /* -----------------------------
     ACTIVE-Intervalle sammeln
  ----------------------------- */

  const intervals: Interval[] = []

  for (const r of recs) {
    const start = r.einschaltZeit
    const end = r.graceAusschaltZeit
    if (start < end) {
      intervals.push({ start, end })
    }
  }

  if (intervals.length === 0) return []

  intervals.sort((a, b) => a.start.getTime() - b.start.getTime())

  /* -----------------------------
     ACTIVE-Intervalle mergen
  ----------------------------- */

  const merged: Interval[] = []

  const first = intervals[0]
  if (!first) return []

  let currentStart: Date = first.start
  let currentEnd: Date = first.end

  for (let i = 1; i < intervals.length; i++) {
    const next = intervals[i]
    if (!next) continue

    if (next.start <= currentEnd) {
      if (next.end > currentEnd) {
        currentEnd = next.end
      }
    } else {
      merged.push({ start: currentStart, end: currentEnd })
      currentStart = next.start
      currentEnd = next.end
    }
  }

  merged.push({ start: currentStart, end: currentEnd })

  /* -----------------------------
     ACTIVE + OFF zusammensetzen
  ----------------------------- */

  const result: StatusSegment[] = []

  let cursor: Date = minTime.value

  for (const seg of merged) {
    if (seg.start > cursor) {
      result.push({
        start: cursor,
        end: seg.start,
        status: "OFF",
      })
    }

    result.push({
      start: seg.start,
      end: seg.end,
      status: "ACTIVE",
    })

    cursor = seg.end
  }

  if (cursor < maxTime.value) {
    result.push({
      start: cursor,
      end: maxTime.value,
      status: "OFF",
    })
  }

  return result
})


// type Interval = {
//   start: Date
//   end: Date
// }

// type StatusSegment = {
//   start: Date
//   end: Date
//   status: "ACTIVE" | "OFF"
// }

// type Segment = { start: Date; end: Date; status: "ACTIVE" | "OFF" }

// const statusSegments = computed<StatusSegment[]>(() => {
//   if (!visibleRecordings.value.length) return []

//   // 1) Intervalle sammeln (NAS AN)
//   const intervals: Interval[] = []

//   for (const r of visibleRecordings.value) {
//     if (r.einschaltZeit < r.graceAusschaltZeit) {
//       intervals.push({
//         start: r.einschaltZeit,
//         end: r.graceAusschaltZeit,
//       })
//     }
//   }

//   if (intervals.length === 0) return []

//   // 2) Nach Start sortieren
//   intervals.sort(
//     (a, b) => a.start.getTime() - b.start.getTime()
//   )

//   // 3) Overlaps mergen
// // 3) Overlaps mergen
// const merged: Interval[] = []

// const first: Interval | undefined = intervals[0]
// if (!first) return []

// let currentStart: Date = first.start
// let currentEnd: Date = first.end

// for (let i = 1; i < intervals.length; i++) {
//   const next = intervals[i]
//   if (!next) continue   // <-- DAS ist der entscheidende Fix

//   if (next.start <= currentEnd) {
//     if (next.end > currentEnd) {
//       currentEnd = next.end
//     }
//   } else {
//     merged.push({
//       start: currentStart,
//       end: currentEnd,
//     })
//     currentStart = next.start
//     currentEnd = next.end
//   }
// }

// merged.push({
//   start: currentStart,
//   end: currentEnd,
// })


//   // 4) In Status-Segmente umwandeln (nur EIN)
//   return merged.map(i => ({
//     start: i.start,
//     end: i.end,
//     status: "ACTIVE",
//   }))
// })

function format(d: string | Date | null | undefined) {
  if (!d) return "–";
  return new Date(d).toLocaleString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(d: string | Date | null | undefined) {
  if (!d) return "–";
  return new Date(d).toLocaleString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
    //day: "2-digit",
    //month: "2-digit",
    //year: "numeric",
  });
}
</script>

<style scoped>
.page {
  padding: 24px;
  font-family: system-ui;
}

.controls {
  margin-bottom: 12px;
}

.status {
  padding: 8px 12px;
  font-weight: bold;
  margin-bottom: 12px;
}
.status.ACTIVE {
  background: #2e7d32;
  color: white;
}
.status.GRACE {
  background: #f9a825;
  color: black;
}
.status.OFF {
  background: #c62828;
  color: white;
}

.timeline {
  border: 1px solid #ccc;
  background: #e4e4e487;
}

rect.bg-ACTIVE {
  fill: rgba(46, 125, 50, 0.15);
}
rect.bg-GRACE {
  fill: rgba(249, 168, 37, 0.25);
}
rect.bg-OFF {
  fill: rgba(198, 40, 40, 0.12);
}

rect.recording {
  fill: #1e6222;
  opacity: 0.85;
}
rect.prepostrun {
  fill: #adbef4;
  opacity: 0.85;
}
rect.graceperiod {
  fill: #f4eba8;
  opacity: 0.85;
}

.now-line {
  stroke: red;
  stroke-width: 2;
}

.time-axis {
  pointer-events: none;
}

.tick-line {
  stroke: #bbb;
  stroke-width: 1;
}

.tick-label {
  fill: #333;
  font-size: 11px;
}

.gridlines {
  pointer-events: none;
}

.grid-line {
  stroke: #000;
  stroke-opacity: 0.08;
  stroke-width: 1;
  shape-rendering: crispEdges;
}

.now-label text {
  fill: red;
  font-size: 11px;
  font-weight: 600;
  pointer-events: none;
}
</style>
