// Mounts every feature router under /api (app.js adds the /api prefix).
import { Router } from "express";
import { adminUserRoutes } from "./adminUserRoutes.js";
import { chatRoutes } from "./chatRoutes.js";
import { auditRoutes } from "./auditRoutes.js";
import { adminWaitlistRoutes, cityAdminRoutes } from "./cityAdminRoutes.js";
import { citySettingsRoutes } from "./citySettingsRoutes.js";
import { communityRoutes, moderationRoutes } from "./communityRoutes.js";
import { departmentAdminRoutes } from "./departmentAdminRoutes.js";
import { geoRoutes } from "./geoRoutes.js";
import { healthRoutes } from "./healthRoutes.js";
import { issueRoutes } from "./issueRoutes.js";
import { meRoutes } from "./meRoutes.js";
import { notificationRoutes } from "./notificationRoutes.js";
import { pincodeRoutes } from "./pincodeRoutes.js";
import { staffRoutes } from "./staffRoutes.js";
import { statsRoutes } from "./statsRoutes.js";
import { uploadRoutes } from "./uploadRoutes.js";
import { waitlistRoutes } from "./waitlistRoutes.js";

export const apiRoutes = Router();

apiRoutes.use("/health", healthRoutes);
apiRoutes.use("/me", meRoutes);
apiRoutes.use("/admin/users", adminUserRoutes);
apiRoutes.use("/admin/city-settings", citySettingsRoutes);
apiRoutes.use("/admin/audit", auditRoutes);
apiRoutes.use("/admin/cities", cityAdminRoutes);
apiRoutes.use("/admin/departments", departmentAdminRoutes);
apiRoutes.use("/admin/waitlist", adminWaitlistRoutes);
apiRoutes.use("/pincodes", pincodeRoutes); // public
apiRoutes.use("/waitlist", waitlistRoutes); // public
apiRoutes.use("/uploads", uploadRoutes);
apiRoutes.use("/issues", issueRoutes);
apiRoutes.use("/staff", staffRoutes);
apiRoutes.use("/notifications", notificationRoutes);
apiRoutes.use("/stats", statsRoutes); // public
apiRoutes.use("/community", communityRoutes);
apiRoutes.use("/moderation", moderationRoutes);
apiRoutes.use("/chat", chatRoutes);
apiRoutes.use(geoRoutes); // /cities and /departments
