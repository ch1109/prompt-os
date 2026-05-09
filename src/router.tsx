import { createBrowserRouter, Navigate } from "react-router-dom";
import App from "./App";
import TaskWorkbench from "./pages/TaskWorkbench";
import Prompts from "./pages/Prompts";
import Templates from "./pages/Templates";
import Settings from "./pages/Settings";
import Import from "./pages/Import";
import PendingReview from "./pages/PendingReview";
import ShareView from "./pages/ShareView";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <TaskWorkbench /> },
      { path: "prompts", element: <Prompts /> },
      { path: "scenarios", element: <Navigate to="/" replace /> },
      { path: "workflows", element: <Navigate to="/" replace /> },
      { path: "contexts", element: <Navigate to="/" replace /> },
      { path: "templates", element: <Templates /> },
      { path: "settings", element: <Settings /> },
      { path: "import", element: <Import /> },
      { path: "pending", element: <PendingReview /> },
      { path: "share/:id", element: <ShareView /> },
    ],
  },
]);
