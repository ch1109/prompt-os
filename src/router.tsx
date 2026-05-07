import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import Home from "./pages/Home";
import Prompts from "./pages/Prompts";
import Scenarios from "./pages/Scenarios";
import Workflows from "./pages/Workflows";
import Contexts from "./pages/Contexts";
import Templates from "./pages/Templates";
import Settings from "./pages/Settings";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: "prompts", element: <Prompts /> },
      { path: "scenarios", element: <Scenarios /> },
      { path: "workflows", element: <Workflows /> },
      { path: "contexts", element: <Contexts /> },
      { path: "templates", element: <Templates /> },
      { path: "settings", element: <Settings /> },
    ],
  },
]);
