// Public pincode routes (no sign-in): the report wizard checks a map pin before the user signs in.
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { ipRateLimit } from "../middleware/userRateLimit.js";
import { checkPoint } from "../controllers/pincodeController.js";
import { checkPointBody, pinParams } from "../validators/pincodes.js";

export const pincodeRoutes = Router();

// Dragging a pin fires a check per drop; 60 per minute per IP is plenty for a person, not for a scraper.
const checkLimit = ipRateLimit({ windowMs: 60_000, limit: 60 });

pincodeRoutes.post(
  "/:pin/check-point",
  checkLimit,
  validate({ params: pinParams, body: checkPointBody }),
  checkPoint,
);
