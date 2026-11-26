// Mounts every feature router under /api (app.js adds the /api prefix).
import { Router } from "express";
import { adminUserRoutes } from "./adminUserRoutes.js";
import { geoRoutes } from "./geoRoutes.js";
import { healthRoutes } from "./healthRoutes.js";
import { issueRoutes } from "./issueRoutes.js";
import { meRoutes } from "./meRoutes.js";
import { pincodeRoutes } from "./pincodeRoutes.js";
import { staffRoutes } from "./staffRoutes.js";
import { uploadRoutes } from "./uploadRoutes.js";
import { waitlistRoutes } from "./waitlistRoutes.js";

export const apiRoutes = Router();

apiRoutes.use("/health", healthRoutes);
apiRoutes.use("/me", meRoutes);
apiRoutes.use("/admin/users", adminUserRoutes);
apiRoutes.use("/pincodes", pincodeRoutes); // public
apiRoutes.use("/waitlist", waitlistRoutes); // public
apiRoutes.use("/uploads", uploadRoutes);
apiRoutes.use("/issues", issueRoutes);
apiRoutes.use("/staff", staffRoutes);
apiRoutes.use(geoRoutes); // /cities and /departments
