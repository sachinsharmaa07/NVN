import { issueDetailQuery, myIssuesQuery } from "@/hooks/useIssues";
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
  AdminCities: () => import("@/pages/admin/AdminCities"),
  AdminWaitlist: () => import("@/pages/admin/AdminWaitlist"),
  NotFound: () => import("@/pages/NotFound"),
};

// Pages a link can point at: their code, and for list pages the first page of their data
// (`data(queryClient, api)`). Exported for tests, which swap `load` for a spy.
const firstPage = (options) => (queryClient, api) =>
  queryClient.prefetchInfiniteQuery(options(api));
export const routes = {
  "/": { load: pageLoaders.Landing },
  "/report": { load: pageLoaders.Report },
  "/issues": { load: pageLoaders.Issues, data: firstPage(myIssuesQuery) },
  "/staff": { load: pageLoaders.StaffQueue, data: firstPage((api) => staffQueueQuery(api)) },
  "/community": { load: pageLoaders.Community },
  "/moderation": { load: pageLoaders.Moderation },
  "/profile": { load: pageLoaders.Profile },
  "/admin/users": { load: pageLoaders.AdminUsers },
  "/admin/city-settings": { load: pageLoaders.CitySettings },
  "/admin/cities": { load: pageLoaders.AdminCities },
  "/admin/waitlist": { load: pageLoaders.AdminWaitlist },
};

// A ticket page (/issues/NIV-2026-000042): one code file for all of them, data per ticket.
const TICKET = /^\/issues\/(NIV-\d{4}-\d{6})$/;
function ticketRoute(path) {
  const ticketId = path.match(TICKET)?.[1];
  if (!ticketId) return null;
  return {
    key: "/issues/:ticketId",
    load: pageLoaders.IssueDetail,
    data: (queryClient, api) => queryClient.prefetchQuery(issueDetailQuery(api, ticketId)),
  };
}

// A community post page (/community/<id>): its code only; the post loads on arrival.
const POST = /^\/community\/[^/]+$/;
const postRoute = (path) =>
  POST.test(path) ? { key: "/community/:id", load: pageLoaders.CommunityPost } : null;

// Page code already requested this session; the browser caches the file after that.
const loaded = new Set();

/**
 * Starts loading the page at `path` before the user gets there. Code once per session; data only
 * for signed-in users (a signed-out prefetch would just be a 401), and TanStack Query's 30s
 * staleTime stops repeat hovers from refetching.
 */
export function prefetchRoute(path, { queryClient, api, signedIn }) {
  const route = routes[path] ?? ticketRoute(path) ?? postRoute(path);
  if (!route) return;
  const key = route.key ?? path;
  if (!loaded.has(key)) {
    loaded.add(key);
    // A failed download (offline) may be tried again on the next hover.
    route.load().catch(() => loaded.delete(key));
  }
  if (route.data && signedIn) route.data(queryClient, api);
}

// Tests only: forget what was loaded.
export const resetPrefetch = () => loaded.clear();
