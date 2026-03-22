import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const SPA_REDIRECT_KEY = "vencon_spa_redirect";

const restoreRedirectedPath = () => {
  const pendingPath = sessionStorage.getItem(SPA_REDIRECT_KEY);
  if (!pendingPath) return;

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

// ── INTEGRITY CHECK ──
// Retries multiple times to allow async SetupGate to render before blocking
const checkIntegrity = () => {
  let attempts = 0;
  const maxAttempts = 5;
  const interval = 3000;
  const check = () => {
    attempts++;
    const marker = document.querySelector('[data-bq-gate]');
    if (marker) return; // Gate found, all good
    if (attempts < maxAttempts) {
      setTimeout(check, interval);
      return;
    }
    // After all retries, gate is truly missing — block
    document.body.innerHTML = `
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0a0a2e;z-index:99999">
        <div style="text-align:center;color:white;font-family:sans-serif">
          <div style="font-size:48px;margin-bottom:16px">🛡️</div>
          <h1 style="font-size:20px;font-weight:bold;margin-bottom:8px">Security Violation Detected</h1>
          <p style="color:rgba(255,255,255,0.5);font-size:14px">সিস্টেম ইন্টিগ্রিটি লঙ্ঘিত হয়েছে।<br/>অনুগ্রহ করে BrandQore-এর সাথে যোগাযোগ করুন।</p>
          <p style="color:rgba(255,255,255,0.2);font-size:11px;margin-top:16px">ERR_INTEGRITY_GATE_MISSING</p>
        </div>
      </div>`;
  };
  setTimeout(check, interval);
};

createRoot(document.getElementById("root")!).render(<App />);
checkIntegrity();