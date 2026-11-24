import { z } from "zod";
import { objectId } from "./adminUsers.js";

export const departmentsQuery = z.object({ cityId: objectId }).strict();
