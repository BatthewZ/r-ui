import "./showcase.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./shell/App";

const root = document.getElementById("root");
if (!root) throw new Error("showcase: #root is missing from index.html");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
