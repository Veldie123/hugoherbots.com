import { createRoot } from "react-dom/client";
import App from "./App.tsx";

// Laad theme stylesheet VÓÓR eigen CSS
import "@mux/mux-player/themes/classic";

// Dan pas eigen CSS (zodat je kunt overriden)
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
  