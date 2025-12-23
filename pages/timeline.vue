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

    <div class="status" :class="statusNow">
      STATUS (jetzt): {{ statusNow }}
    </div>

    <svg
      v-if="statusSegments.length"
      :width="SVG_WIDTH"
      :height="svgHeight"
      class="timeline"
    >
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
        <rect
          :x="xFor(r.einschaltZeit)"
          :y="rowY(i)"
          :width="xFor(r.graceAusschaltZeit) - xFor(r.einschaltZeit)"
          height="20"
          class="recording"
        />
        <text
          :x="LEFT_PAD - 10"
          :y="rowY(i) + 14"
          text-anchor="end"
        >
          {{ r.displayTitle }}
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
import { computeAutomationDecision } from "~/server/utils/automation-decision"

/* ------------------------------------------------------------
   DTO (GENAU wie API!)
------------------------------------------------------------ */

interface TimelineRecordingDTO {
  displayTitle: string
  einschaltZeit: string
  ausschaltZeit: string
  graceAusschaltZeit: string
  aufnahmeStart: string
  aufnahmeEnde: string
}

/* ------------------------------------------------------------
   FETCH
------------------------------------------------------------ */

const { data: timelineRaw } = await useFetch("/api/automation/timeline")
const { data: cfg } = await useFetch("/api/config")

const safeTimeline = computed(() => timelineRaw.value ?? null)
const safeCfg = computed(() => cfg.value ?? null)


/* ------------------------------------------------------------
   BASE
------------------------------------------------------------ */

const now = computed(() =>
  timelineRaw.value?.now
    ? new Date(timelineRaw.value.now)
    : new Date()
)

/* ------------------------------------------------------------
   RECORDINGS (NORMALISIERT!)
------------------------------------------------------------ */

const recordings = computed(() => {
  const tl = timelineRaw.value
  if (!tl || !Array.isArray(tl.recordings)) return []

  return tl.recordings.map((r: TimelineRecordingDTO) => ({
    displayTitle: r.displayTitle,
    einschaltZeit: new Date(r.einschaltZeit),
    ausschaltZeit: new Date(r.ausschaltZeit),
    graceAusschaltZeit: new Date(r.graceAusschaltZeit),
    aufnahmeStart: new Date(r.aufnahmeStart),
    aufnahmeEnde: new Date(r.aufnahmeEnde),
  }))
})


/* ------------------------------------------------------------
   RANGE
------------------------------------------------------------ */

const range = ref<"2d" | "7d" | "all">("2d")

const rangeEnd = computed(() => {
  const d = new Date(now.value)
  if (range.value === "2d") d.setDate(d.getDate() + 2)
  else if (range.value === "7d") d.setDate(d.getDate() + 7)
  else d.setFullYear(d.getFullYear() + 10)
  return d
})

const visibleRecordings = computed(() =>
  recordings.value.filter(
    r => r.graceAusschaltZeit instanceof Date && r.graceAusschaltZeit >= now.value
  )
)

/* ------------------------------------------------------------
   LAYOUT
------------------------------------------------------------ */

const SVG_WIDTH = 1100
const ROW_HEIGHT = 36
const LEFT_PAD = 260
const RIGHT_PAD = 20

const svgHeight = computed(
  () => 40 + visibleRecordings.value.length * ROW_HEIGHT
)

/* ------------------------------------------------------------
   TIME SCALE
------------------------------------------------------------ */

const minTime = computed<Date>(() => {
  if (visibleRecordings.value.length === 0) {
    return now.value
  }

  let min = Infinity

  for (const r of visibleRecordings.value) {
    const t = r.einschaltZeit.getTime()
    if (t < min) min = t
  }

  return new Date(min)
})


const maxTime = computed<Date>(() => {
  if (visibleRecordings.value.length === 0) {
    return now.value
  }

  let max = -Infinity

  for (const r of visibleRecordings.value) {
    const t = r.graceAusschaltZeit.getTime()
    if (t > max) max = t
  }

  return new Date(max)
})


function xFor(t: Date): number {
  const span = maxTime.value.getTime() - minTime.value.getTime()
  if (span <= 0) return LEFT_PAD
  return (
    LEFT_PAD +
    ((t.getTime() - minTime.value.getTime()) / span) *
      (SVG_WIDTH - LEFT_PAD - RIGHT_PAD)
  )
}

function rowY(i: number): number {
  return 30 + i * ROW_HEIGHT
}

/* ------------------------------------------------------------
   STATUS (NUR computeAutomationDecision!)
------------------------------------------------------------ */

type Status = "ACTIVE" | "GRACE" | "OFF"

function statusAt(t: Date): Status {
  const cfgVal = safeCfg.value
  if (!cfgVal) return "OFF"

  const res = computeAutomationDecision(
    recordings.value as any,
    t,
    cfgVal
  )


  if (res.decision !== "KEEP_RUNNING") return "OFF"
  return res.reason?.includes("grace") ? "GRACE" : "ACTIVE"
}


const statusNow = computed<Status>(() => statusAt(now.value))

/* ------------------------------------------------------------
   STATUS SEGMENTS
------------------------------------------------------------ */

const statusSegments = computed(() => {
  if (!visibleRecordings.value.length) return []

  const points: number[] = []

  for (const r of visibleRecordings.value) {
    points.push(r.einschaltZeit.getTime())
    points.push(r.graceAusschaltZeit.getTime())
  }

  points.sort((a, b) => a - b)

  const segs: { start: Date; end: Date; status: Status }[] = []

for (let i = 0; i < points.length - 1; i++) {
  const a = points[i]
  const b = points[i + 1]
  if (a == null || b == null) continue

  const start = new Date(a)
  const end = new Date(b)
  if (end <= start) continue

  segs.push({
    start,
    end,
    status: statusAt(start),
  })
}


  return segs
})
</script>

<style scoped>
.page { padding: 24px; font-family: system-ui; }

.controls { margin-bottom: 12px; }

.status { padding: 8px 12px; font-weight: bold; margin-bottom: 12px; }
.status.ACTIVE { background:#2e7d32; color:white; }
.status.GRACE  { background:#f9a825; color:black; }
.status.OFF    { background:#c62828; color:white; }

.timeline { border:1px solid #ccc; background:#fafafa; }

rect.bg-ACTIVE { fill: rgba(46,125,50,0.15); }
rect.bg-GRACE  { fill: rgba(249,168,37,0.25); }
rect.bg-OFF    { fill: rgba(198,40,40,0.12); }

rect.recording { fill:#2e7d32; opacity:.85; }

.now-line { stroke:red; stroke-width:2; }
</style>
