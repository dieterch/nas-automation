<template>
  <div class="page">
    <h1>NAS Automation – Timeline</h1>

    <div class="controls">
      <label>
        Zeitraum:
        <select v-model="range">
          <option value="2d">Heute + Morgen</option>
          <option value="7d">1 Woche ab jetzt</option>
          <option value="all">Alle Daten</option>
        </select>
      </label>
    </div>

    <div class="status" :class="statusNow">
      STATUS (jetzt): {{ statusNow }}
    </div>

    <div class="legend">
      <span class="legend-item recording">■ Aufnahme</span>
      <span class="legend-item scheduled">■ Zeitfenster</span>
      <span class="legend-item auto">■ Auto</span>
      <span class="legend-item active">■ ACTIVE</span>
      <span class="legend-item grace">■ GRACE</span>
      <span class="legend-item off">■ OFF</span>
      <span class="legend-item now">│ Jetzt</span>
    </div>

    <svg
      v-if="visibleWindows.length"
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

      <!-- WINDOWS -->
      <g v-for="(w, i) in visibleWindows" :key="w.id">
        <rect
          :x="xFor(w.start)"
          :y="rowY(i)"
          :width="xFor(w.end) - xFor(w.start)"
          height="20"
          :class="w.type"
        />
        <text x="10" :y="rowY(i) + 14">{{ w.label }}</text>
      </g>

      <!-- NOW -->
      <line
        :x1="xFor(now)"
        :x2="xFor(now)"
        y1="10"
        :y2="svgHeight - 20"
        class="now-line"
      />
      <text :x="xFor(now) + 4" y="20" class="now-text">NOW</text>
    </svg>

    <section class="debug">
      <pre>{{ debug }}</pre>
    </section>
  </div>
</template>

<script setup lang="ts">
/* ------------------------------------------------------------
   Fetch
------------------------------------------------------------ */
const { data } = await useFetch("/api/automation/timeline")

/* ------------------------------------------------------------
   Base Data
------------------------------------------------------------ */
const now = computed(() =>
  data.value?.now ? new Date(data.value.now) : new Date()
)

const graceMs = computed(() => (data.value?.graceMin ?? 0) * 60_000)

const windows = computed(() =>
  (data.value?.windows ?? []).map((w: any) => ({
    ...w,
    start: new Date(w.start),
    end: new Date(w.end),
  }))
)

/* ------------------------------------------------------------
   Range
------------------------------------------------------------ */
const range = ref<"2d" | "7d" | "all">("2d")

const rangeEnd = computed<Date | null>(() => {
  const d = new Date(now.value)
  if (range.value === "2d") d.setDate(d.getDate() + 2)
  if (range.value === "7d") d.setDate(d.getDate() + 7)
  if (range.value === "all") return null
  return d
})

const visibleWindows = computed(() =>
  windows.value.filter(w =>
    !rangeEnd.value ||
    (w.end >= now.value && w.start <= rangeEnd.value)
  )
)

/* ------------------------------------------------------------
   Layout
------------------------------------------------------------ */
const SVG_WIDTH = 1100
const ROW_HEIGHT = 40
const LEFT_PAD = 160
const RIGHT_PAD = 40

const svgHeight = computed(
  () => 80 + visibleWindows.value.length * ROW_HEIGHT
)

/* ------------------------------------------------------------
   Time Scale
------------------------------------------------------------ */
const minTime = computed(() =>
  new Date(Math.min(...visibleWindows.value.map(w => w.start.getTime())))
)

const maxTime = computed(() =>
  new Date(Math.max(...visibleWindows.value.map(w => w.end.getTime())))
)

function xFor(t: Date) {
  const span = maxTime.value.getTime() - minTime.value.getTime()
  if (span <= 0) return LEFT_PAD
  return (
    LEFT_PAD +
    ((t.getTime() - minTime.value.getTime()) / span) *
      (SVG_WIDTH - LEFT_PAD - RIGHT_PAD)
  )
}

function rowY(i: number) {
  return 50 + i * ROW_HEIGHT
}

/* ------------------------------------------------------------
   STATUS LOGIK (FINAL, KORREKT)
------------------------------------------------------------ */
type Status = "ACTIVE" | "GRACE" | "OFF"

function statusAt(
  t: Date,
  wins: { start: Date; end: Date }[],
  graceMs: number
): Status {
  // ACTIVE
  if (wins.some(w => t >= w.start && t < w.end)) {
    return "ACTIVE"
  }

  // letztes beendetes Fenster
  const lastEnded = wins
    .filter(w => w.end <= t)
    .sort((a, b) => b.end.getTime() - a.end.getTime())[0]

  if (!lastEnded) return "OFF"

  // GRACE nur nach ACTIVE
  if (t.getTime() < lastEnded.end.getTime() + graceMs) {
    return "GRACE"
  }

  return "OFF"
}

/* STATUS JETZT */
const statusNow = computed<Status>(() =>
  statusAt(now.value, visibleWindows.value, graceMs.value)
)

/* ------------------------------------------------------------
   STATUS SEGMENTS
------------------------------------------------------------ */
const statusSegments = computed(() => {
  if (!visibleWindows.value.length) return []

  const points = new Set<number>()

  for (const w of visibleWindows.value) {
    points.add(w.start.getTime())
    points.add(w.end.getTime())
    points.add(w.end.getTime() + graceMs.value)
  }

  points.add(minTime.value.getTime())
  points.add(maxTime.value.getTime())

  const times = [...points]
    .sort((a, b) => a - b)
    .map(t => new Date(t))

  const segments: { start: Date; end: Date; status: Status }[] = []

  for (let i = 0; i < times.length - 1; i++) {
    const a = times[i]
    const b = times[i + 1]
    if (b <= a) continue

    segments.push({
      start: a,
      end: b,
      status: statusAt(a, visibleWindows.value, graceMs.value),
    })
  }

  return segments
})

/* ------------------------------------------------------------
   Debug
------------------------------------------------------------ */
const debug = computed(() => ({
  now: now.value.toISOString(),
  statusNow: statusNow.value,
  graceMin: data.value?.graceMin,
  segments: statusSegments.value.map(s => ({
    status: s.status,
    start: s.start.toISOString(),
    end: s.end.toISOString(),
  })),
}))
</script>

<style scoped>
.page { padding: 24px; font-family: system-ui; }
.controls { margin-bottom: 16px; }

.status { padding: 10px; font-weight: bold; border-radius: 4px; }
.status.ACTIVE { background:#2e7d32; color:white; }
.status.GRACE  { background:#f9a825; color:black; }
.status.OFF    { background:#c62828; color:white; }

.legend-item { margin-right: 12px; font-weight: 500; }

.timeline { border:1px solid #ccc; background:#fafafa; }

rect.bg-ACTIVE { fill: rgba(46,125,50,0.15); }
rect.bg-GRACE  { fill: rgba(249,168,37,0.25); }
rect.bg-OFF    { fill: rgba(198,40,40,0.12); }

rect.recording { fill:#2e7d32; opacity:.85; }
rect.scheduled { fill:#1565c0; opacity:.75; }
rect.auto      { fill:#ef6c00; opacity:.8; }

.now-line { stroke:red; stroke-width:2; }
.now-text { fill:red; font-size:12px; }

pre { background:#111; color:#0f0; padding:12px; }
</style>
