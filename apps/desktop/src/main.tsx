import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/theme.css";
import "./App.css";

// Apply OS theme synchronously before React mounts to avoid dark-flash.
// useTheme() will apply the user's saved preference after mount.
const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");

const root = document.getElementById("root") as HTMLElement;
const isCapture = new URLSearchParams(window.location.search).get("capture") === "1";

if (isCapture) {
  import("./QuickCapture").then(({ default: QuickCapture }) => {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <QuickCapture />
      </React.StrictMode>
    );
  });
} else {
  import("./App").then(({ default: App }) => {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  });
}
