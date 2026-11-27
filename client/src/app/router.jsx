import { createBrowserRouter } from "react-router";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AppLayout } from "@/layouts/AppLayout";
import { SuspendedLayout } from "@/layouts/SuspendedLayout";
import {
  AdminUsers,
  Community,
  CommunityPost,
  Forbidden,
  IssueDetail,
  Issues,
  Landing,
  NotFound,
  Profile,
  Report,
  StaffQueue,
  StyleGuide,
  Suspended,
} from "./lazyPages";

/*
 * Route table (React Router data mode). Created once, outside React, as the docs require.
 * The shell (AppLayout: top bar, navs, chat button) loads at once; pages are lazy (lazyPages.js)
 * and PageTransition shows a skeleton while a page's file downloads.
 */
export const routes = [
  // Suspended users see only this minimal frame (wordmark, reason, Sign out).
  {
    element: <SuspendedLayout />,
    children: [{ path: "suspended", element: <Suspended /> }],
  },
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Landing /> },
      // Reporting needs a signed-in user with a verified email (the server checks it too).
      {
        path: "report",
        element: (
          <RequireAuth verified>
            <Report />
          </RequireAuth>
        ),
      },
      { path: "profile", element: <Profile /> },
      { path: "forbidden", element: <Forbidden /> },
      { path: "admin/users", element: <AdminUsers /> },
      { path: "issues", element: <Issues /> },
      { path: "issues/:ticketId", element: <IssueDetail /> },
      { path: "staff", element: <StaffQueue /> },
      { path: "community", element: <Community /> },
      { path: "community/:id", element: <CommunityPost /> },
      // Development only: /dev/styleguide (StyleGuide is null in production builds).
      ...(StyleGuide ? [{ path: "dev/styleguide", element: <StyleGuide /> }] : []),
      { path: "*", element: <NotFound /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
