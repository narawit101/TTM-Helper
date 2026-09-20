import React from "react";
import ReactDOM from "react-dom/client";
import { SidePanelApp } from "./sidepanel-app";
import "../globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SidePanelApp />
  </React.StrictMode>
);
