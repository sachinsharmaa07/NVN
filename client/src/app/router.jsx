import { createBrowserRouter } from "react-router";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AppLayout } from "@/layouts/AppLayout";
import { Community, Issues, Landing, NotFound, Report, StyleGuide, VerifyEmail } from "./lazyPages";

/*
 * Route table (React Router data mode). Created once, outside React, as the docs require.
 * The shell (AppLayout: top bar, navs, chat button) loads at once; pages are lazy (lazyPages.js)
 * and PageTransition shows a skeleton while a page's file downloads.
 */
export const routes = [
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
      { path: "verify-email", element: <VerifyEmail /> },
      { path: "issues", element: <Issues /> },
      { path: "community", element: <Community /> },
      // Development only: /dev/styleguide (StyleGuide is null in production builds).
      ...(StyleGuide ? [{ path: "dev/styleguide", element: <StyleGuide /> }] : []),
      { path: "*", element: <NotFound /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
