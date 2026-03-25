import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const SPA_REDIRECT_KEY = "vencon_spa_redirect";

const restoreRedirectedPath = () => {
  // Check both localStorage (new) and sessionStorage (legacy fallback)
  const pendingPath = localStorage.getItem(SPA_REDIRECT_KEY) || sessionStorage.getItem(SPA_REDIRECT_KEY);
  if (!pendingPath) return;

  // Clean up both storages
  localStorage.removeItem(SPA_REDIRECT_KEY);
  sessionStorage.removeItem(SPA_REDIRECT_KEY);

  if (window.location.pathname !== "/") return;
  if (!pendingPath.startsWith("/") || pendingPath.startsWith("//")) return;

  window.history.replaceState(null, "", pendingPath);
};

restoreRedirectedPath();

// Apply saved theme (default: light)
const saved = localStorage.getItem("vencon_theme");
if (saved === "dark") {
  document.documentElement.classList.add("dark");
} else {
  document.documentElement.classList.remove("dark");
}


createRoot(document.getElementById("root")!).render(<App />);