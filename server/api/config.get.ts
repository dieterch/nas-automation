import { loadConfig } from "../utils/config"

export default defineEventHandler(() => {
  return loadConfig()
})
