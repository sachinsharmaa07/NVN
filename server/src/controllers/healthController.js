// HTTP only: call the service, choose the status code, send JSON.
import { getHealth } from "../services/healthService.js";

export function healthCheck(req, res) {
  const health = getHealth();
  // 503 tells load balancers and uptime monitors not to send traffic while the DB is down.
  res.status(health.db === "up" ? 200 : 503).json(health);
}
