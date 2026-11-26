// Public: a resident whose pincode is not served (or unknown) leaves an email to be counted.
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { ipRateLimit } from "../middleware/userRateLimit.js";
import { join } from "../controllers/waitlistController.js";
import { waitlistBody } from "../validators/pincodes.js";

export const waitlistRoutes = Router();

// A person signs up once or twice; 5 per hour per IP keeps the collection from being flooded.
const joinLimit = ipRateLimit({ windowMs: 60 * 60_000, limit: 5 });

waitlistRoutes.post("/", joinLimit, validate({ body: waitlistBody }), join);
