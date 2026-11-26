// Public platform numbers for the landing page (M2 step 9). No sign-in, no personal data.
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { stats } from "../controllers/statsController.js";
import { none } from "../validators/me.js";

export const statsRoutes = Router();

statsRoutes.get("/", validate({ query: none }), stats);
