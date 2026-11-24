import { createBrowserRouter } from "react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Home } from "@/pages/Home";
import { NotFound } from "@/pages/NotFound";

// Route table (React Router data mode). Created once, outside React, as the docs require.
export const routes = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: "*", element: <NotFound /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
