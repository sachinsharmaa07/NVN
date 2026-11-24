import { t } from "@/i18n/t";
import { areaLabel } from "@/lib/roles";

// Text helpers shared by the table, the cards and the dialogs.
export const displayName = (user) => user.name || t("admin.users.unnamed");
export const areaText = (user) => areaLabel(user, t("admin.users.areaAll")) || "—";
