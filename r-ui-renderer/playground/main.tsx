import "./playground.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { applyViewAxes, parseRoute } from "./route";

const root = document.getElementById("root");
if (!root) throw new Error("playground: #root is missing from index.html");

// Read once: the route is fixed for the page's life, and its axes apply before the first render.
const route = parseRoute(location.search);
if (route.kind === "view") applyViewAxes(route, document.documentElement);

createRoot(root).render(
  <StrictMode>
    <App route={route} />
  </StrictMode>,
);
