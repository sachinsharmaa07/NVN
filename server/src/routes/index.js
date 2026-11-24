// Mounts every feature router under /api (app.js adds the /api prefix).
import { Router } from "express";
import { adminUserRoutes } from "./adminUserRoutes.js";
import { geoRoutes } from "./geoRoutes.js";
import { healthRoutes } from "./healthRoutes.js";
import { meRoutes } from "./meRoutes.js";

export const apiRoutes = Router();

apiRoutes.use("/health", healthRoutes);
apiRoutes.use("/me", meRoutes);
apiRoutes.use("/admin/users", adminUserRoutes);
apiRoutes.use(geoRoutes); // /cities and /departments
