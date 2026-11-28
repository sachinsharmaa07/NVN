import { issueDetailQuery, myIssuesQuery } from "@/hooks/useIssues";
import { staffQueueQuery } from "@/hooks/useStaffIssues";
import { loadPageStrings } from "@/i18n/t";

// A page renders only once its English strings are in the dictionary (they are not in the first download).
const withStrings = (load) => () => Promise.all([load(), loadPageStrings()]).then(([mod]) => mod);

/*
 * One import function per page. lazyPages.js builds React.lazy from these, and prefetchRoute calls
 * the same ones, so a hover and the click that follows share one download (02-lld prefetch contract).
 */
export const pageLoaders = {
  Landing: withStrings(() => import("@/pages/Landing")),
  Report: withStrings(() => import("@/pages/Report")),
  Issues: withStrings(() => import("@/pages/Issues")),
  IssueDetail: withStrings(() => import("@/pages/IssueDetail")),
  StaffQueue: withStrings(() => import("@/pages/staff/StaffQueue")),
  Community: withStrings(() => import("@/pages/Community")),
  CommunityPost: withStrings(() => import("@/pages/CommunityPost")),
  Moderation: withStrings(() => import("@/pages/Moderation")),
  Profile: withStrings(() => import("@/pages/Profile")),
  Suspended: withStrings(() => import("@/pages/Suspended")),
  Forbidden: withStrings(() => import("@/pages/Forbidden")),
  AdminUsers: withStrings(() => import("@/pages/admin/AdminUsers")),
  CitySettings: withStrings(() => import("@/pages/admin/CitySettings")),
  AdminCities: withStrings(() => import("@/pages/admin/AdminCities")),
  AdminWaitlist: withStrings(() => import("@/pages/admin/AdminWaitlist")),
  AdminAudit: withStrings(() => import("@/pages/admin/AdminAudit")),
  NotFound: withStrings(() => import("@/pages/NotFound")),
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
  "/admin/audit": { load: pageLoaders.AdminAudit },
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
