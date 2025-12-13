import { getNasEnv } from "./nas-utils"

export async function isVuPlusOn(): Promise<boolean> {
  const { VUPLUS_SHELLY_IP, VUPLUS_SHELLY_RELAY } = getNasEnv()

  try {
    const res: any = await $fetch(
      `http://${VUPLUS_SHELLY_IP}/relay/${VUPLUS_SHELLY_RELAY}`,
      { timeout: 1500 }
    )

    return res?.ison === true
  } catch (err) {
    console.log(err)
    return false
  }
}
