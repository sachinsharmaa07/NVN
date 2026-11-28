import { RequireAuth } from "@/components/auth/RequireAuth";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { PageHeader } from "@/components/system/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { t } from "@/i18n/t";

function ProfileContent() {
  const { user } = useAuth();
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 *:max-w-2xl md:px-6 md:py-12 lg:px-8">
      <PageHeader title={t("profile.page.title")} description={t("profile.page.description")} />
      <ProfileForm user={user} />
    </div>
  );
}

// Unverified users may edit their profile; suspended ones are redirected by RequireAuth.
export function Profile() {
  return (
    <RequireAuth>
      <ProfileContent />
    </RequireAuth>
  );
}

export default Profile;
