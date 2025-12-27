// server/plugins/console-timestamp.ts
export default defineNitroPlugin(() => {
  const origLog = console.log
  const origErr = console.error
  const origWarn = console.warn

  function ts() {
    return new Date().toISOString()
  }

  console.log = (...args) => origLog(ts(), ...args)
  console.error = (...args) => origErr(ts(), ...args)
  console.warn = (...args) => origWarn(ts(), ...args)
})
