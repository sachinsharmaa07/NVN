// Flags: one per user per post or comment. The AUTO_HIDE_FLAGS-th flag hides the content in the same
// transaction, until a moderator restores or deletes it (decision 7).
import { Flag } from "../models/Flag.js";
import { AppError } from "../utils/AppError.js";
import { AUTO_HIDE_FLAGS } from "../utils/postStateMachine.js";
import { inTransaction, notFound, sameId } from "./adminUserSupport.js";
import { MODELS, moveContent } from "./communityShared.js";

const DUPLICATE_KEY = 11000;

/** POST /api/community/flags. A repeat flag answers the same 200 and changes nothing. */
export async function flagContent(actor, { targetType, targetId, reason }) {
  try {
    return await inTransaction(async (session) => {
      const doc = await MODELS[targetType]
        .findOne({ _id: targetId, status: "published" })
        .session(session);
      if (!doc) throw notFound();
      if (sameId(doc.authorId, actor.id)) {
        throw new AppError("VALIDATION_ERROR", 400, "You can delete your own post instead.");
      }
      await Flag.create([{ targetType, targetId, userId: actor.id, reason }], { session });
      doc.flagCount += 1;
      if (doc.flagCount >= AUTO_HIDE_FLAGS) {
        await moveContent(targetType, doc, "hidden", "system", { session });
      } else {
        await doc.save({ session });
      }
      return { flagged: true };
    });
  } catch (err) {
    if (err?.code === DUPLICATE_KEY) return { flagged: true };
    throw err;
  }
}
