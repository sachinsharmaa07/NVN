import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { healthCheck } from "../controllers/healthController.js";

export const healthRoutes = Router();

// Public, read-only, no query parameters allowed.
healthRoutes.get("/", validate({ query: z.object({}).strict() }), healthCheck);
