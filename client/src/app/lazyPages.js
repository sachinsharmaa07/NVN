import { lazy } from "react";
import { pageLoaders as load } from "@/lib/prefetch";

/*
 * Every page, loaded lazily: each one is a separate file that downloads the first time it is
 * opened, so the first screen loads fast on a cheap phone. React.lazy needs a default export,
 * which every page file has. The import functions live in lib/prefetch.js, so a nav hover that
 * prefetches a page and the click that opens it share one download.
 */
export const Landing = lazy(load.Landing);
export const Report = lazy(load.Report);
export const Issues = lazy(load.Issues);
export const IssueDetail = lazy(load.IssueDetail);
export const StaffQueue = lazy(load.StaffQueue);
export const Community = lazy(load.Community);
export const CommunityPost = lazy(load.CommunityPost);
export const Moderation = lazy(load.Moderation);
export const Profile = lazy(load.Profile);
export const Suspended = lazy(load.Suspended);
export const Forbidden = lazy(load.Forbidden);
export const AdminUsers = lazy(load.AdminUsers);
export const CitySettings = lazy(load.CitySettings);
export const NotFound = lazy(load.NotFound);

// Style guide for developers only. import.meta.env.DEV is false in a production build, so the
// file is left out of the bundle entirely.
export const StyleGuide = import.meta.env.DEV ? lazy(() => import("@/pages/dev/StyleGuide")) : null;
