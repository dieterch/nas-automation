import { readFileSync } from "fs"
import { resolve } from "path"

export function loadConfig() {
  const path = resolve("data/configuration.json")
  return JSON.parse(readFileSync(path, "utf-8"))
}
