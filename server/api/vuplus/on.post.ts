import { VUshellyOn } from "../../utils/nas-utils"

export default defineEventHandler(async () => {
  await VUshellyOn()
  return { ok: true }
})
