// Mounts every feature router under /api (app.js adds the /api prefix).
import { Router } from "express";
import { healthRoutes } from "./healthRoutes.js";
import { meRoutes } from "./meRoutes.js";

export const apiRoutes = Router();

apiRoutes.use("/health", healthRoutes);
apiRoutes.use("/me", meRoutes);
