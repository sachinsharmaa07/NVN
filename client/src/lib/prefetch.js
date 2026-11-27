import { myIssuesQuery } from "@/hooks/useIssues";
import { staffQueueQuery } from "@/hooks/useStaffIssues";

/*
 * One import function per page. lazyPages.js builds React.lazy from these, and prefetchRoute calls
 * the same ones, so a hover and the click that follows share one download (02-lld prefetch contract).
 */
export const pageLoaders = {
  Landing: () => import("@/pages/Landing"),
  Report: () => import("@/pages/Report"),
  Issues: () => import("@/pages/Issues"),
  IssueDetail: () => import("@/pages/IssueDetail"),
  StaffQueue: () => import("@/pages/staff/StaffQueue"),
  Community: () => import("@/pages/Community"),
  CommunityPost: () => import("@/pages/CommunityPost"),
  Moderation: () => import("@/pages/Moderation"),
  Profile: () => import("@/pages/Profile"),
  Suspended: () => import("@/pages/Suspended"),
  Forbidden: () => import("@/pages/Forbidden"),
  AdminUsers: () => import("@/pages/admin/AdminUsers"),
  CitySettings: () => import("@/pages/admin/CitySettings"),
  NotFound: () => import("@/pages/NotFound"),
};

// Pages a link can point at: their code, and for list pages the first page of their data.
// Exported for tests, which swap `load` for a spy.
export const routes = {
  "/": { load: pageLoaders.Landing },
  "/report": { load: pageLoaders.Report },
  "/issues": { load: pageLoaders.Issues, query: myIssuesQuery },
  "/staff": { load: pageLoaders.StaffQueue, query: (api) => staffQueueQuery(api) },
  "/community": { load: pageLoaders.Community },
  "/moderation": { load: pageLoaders.Moderation },
  "/profile": { load: pageLoaders.Profile },
  "/admin/users": { load: pageLoaders.AdminUsers },
  "/admin/city-settings": { load: pageLoaders.CitySettings },
};

// Paths whose code was already requested this session; the browser caches the file after that.
const loaded = new Set();

/**
 * Starts loading the page at `path` before the user gets there. Code once per session; data only
 * for signed-in users (a signed-out prefetch would just be a 401), and TanStack Query's 30s
 * staleTime stops repeat hovers from refetching.
 */
export function prefetchRoute(path, { queryClient, api, signedIn }) {
  const route = routes[path];
  if (!route) return;
  if (!loaded.has(path)) {
    loaded.add(path);
    // A failed download (offline) may be tried again on the next hover.
    route.load().catch(() => loaded.delete(path));
  }
  if (route.query && signedIn) queryClient.prefetchInfiniteQuery(route.query(api));
}

// Tests only: forget what was loaded.
export const resetPrefetch = () => loaded.clear();
