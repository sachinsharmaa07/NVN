import { MapPinIcon } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { EmptyState } from "@/components/system/EmptyState";
import { PageHeader } from "@/components/system/PageHeader";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n/t";

// An Indian PIN: 6 digits, the first one 1-9. Checked here so a bad link like
// /report?pincode=abc is ignored instead of shown. (The landing page validates before sending.)
const PINCODE = /^[1-9][0-9]{5}$/;

// Placeholder until the 3-step report wizard is built (docs/UI.md §7). It already reads the
// pincode the landing page sends, e.g. /report?pincode=144401.
export function Report() {
  const [searchParams] = useSearchParams();
  const pincode = searchParams.get("pincode");
  const hasPincode = pincode !== null && PINCODE.test(pincode);

  return (
    <div className="mx-auto flex w-full max-w-160 flex-col gap-8 px-4 py-8 md:px-6 md:py-12 lg:px-8">
      <PageHeader title={t("shell.report.title")} description={t("shell.report.description")} />
      <EmptyState
        icon={MapPinIcon}
        title={t("shell.report.emptyTitle")}
        hint={
          hasPincode ? t("shell.report.emptyHintPincode", { pincode }) : t("shell.report.emptyHint")
        }
        action={
          <Button asChild variant="secondary">
            <Link to="/">{t("shell.common.goHome")}</Link>
          </Button>
        }
      />
    </div>
  );
}

export default Report;
