import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Dev-only browser error handling
if (import.meta.env.DEV) {
  window.addEventListener('unhandledrejection', (e) => {
    console.warn('[window unhandledrejection]', e.reason);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
