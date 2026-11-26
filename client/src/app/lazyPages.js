import { lazy } from "react";

/*
 * Every page, loaded lazily: each one is a separate file that downloads the first time it is
 * opened, so the first screen loads fast on a cheap phone. React.lazy needs a default export,
 * which every page file has. Kept apart from router.jsx so that file holds only the route table.
 */
export const Landing = lazy(() => import("@/pages/Landing"));
export const Report = lazy(() => import("@/pages/Report"));
export const Issues = lazy(() => import("@/pages/Issues"));
export const IssueDetail = lazy(() => import("@/pages/IssueDetail"));
export const Community = lazy(() => import("@/pages/Community"));
export const Profile = lazy(() => import("@/pages/Profile"));
export const Suspended = lazy(() => import("@/pages/Suspended"));
export const Forbidden = lazy(() => import("@/pages/Forbidden"));
export const AdminUsers = lazy(() => import("@/pages/admin/AdminUsers"));
export const NotFound = lazy(() => import("@/pages/NotFound"));

// Style guide for developers only. import.meta.env.DEV is false in a production build, so the
// file is left out of the bundle entirely.
export const StyleGuide = import.meta.env.DEV ? lazy(() => import("@/pages/dev/StyleGuide")) : null;
