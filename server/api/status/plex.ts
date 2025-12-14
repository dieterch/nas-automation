export default defineEventHandler(async () => {
  const { plexHost, plexToken } = useRuntimeConfig()
  const url = `${plexHost}/identity?X-Plex-Token=${plexToken}`

  try {
    const res = await $fetch.raw(url, { timeout: 2000 })
    const body = res._data?.toString?.() ?? ""

    // GRÜN: normales Plex-Response
    if (res.status === 200 && body.includes("<MediaContainer")) {
      return { status: "green" }
    }

    // GELB: Plex im Maintenance/DB-Migration Mode
     if (res.status === 200 && body.includes("<Response")) {
    // if (body.includes('<Response') && body.includes('503') && body.includes('Maintenance')) {
      return { status: "yellow" }
    }

    // ROT: Alles andere
    return { status: "red" }

  } catch (err) {
    return { status: "red" }
  }
})
