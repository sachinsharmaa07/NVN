// Business logic for GET /api/health: is the process able to serve real traffic?
import { isDbUp } from "../config/db.js";
import pkg from "../../package.json" with { type: "json" };

/** @returns {{ status: "ok"|"degraded", db: "up"|"down", uptime: number, version: string }} */
export function getHealth() {
  const dbUp = isDbUp();
  return {
    status: dbUp ? "ok" : "degraded",
    db: dbUp ? "up" : "down",
    uptime: Math.floor(process.uptime()), // whole seconds since the process started
    version: pkg.version,
  };
}
