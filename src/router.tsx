import { createBrowserRouter, Navigate } from "react-router-dom";
import App from "./App";
import TaskWorkbench from "./pages/TaskWorkbench";
import Prompts from "./pages/Prompts";
import Contexts from "./pages/Contexts";
import Redeem from "./pages/Redeem";
import Settings from "./pages/Settings";
import Import from "./pages/Import";
import PendingReview from "./pages/PendingReview";
import AdminLayout from "./admin/AdminLayout";
import TemplateList from "./admin/pages/TemplateList";
import TemplateEdit from "./admin/pages/TemplateEdit";
import CodeList from "./admin/pages/CodeList";
import Redemptions from "./admin/pages/Redemptions";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <TaskWorkbench /> },
      { path: "prompts", element: <Prompts /> },
      { path: "scenarios", element: <Navigate to="/" replace /> },
      { path: "workflows", element: <Navigate to="/" replace /> },
      { path: "contexts", element: <Contexts /> },
      { path: "templates", element: <Navigate to="/redeem" replace /> },
      { path: "redeem", element: <Redeem /> },
      { path: "settings", element: <Settings /> },
      { path: "import", element: <Import /> },
      { path: "pending", element: <PendingReview /> },
      { path: "share/:id", element: <Navigate to="/redeem" replace /> },
    ],
  },
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { index: true, element: <Navigate to="/admin/templates" replace /> },
      { path: "templates", element: <TemplateList /> },
      { path: "templates/new", element: <TemplateEdit /> },
      { path: "templates/:id", element: <TemplateEdit /> },
      { path: "codes", element: <CodeList /> },
      { path: "redemptions", element: <Redemptions /> },
    ],
  },
]);
