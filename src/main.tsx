import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./components/theme-provider";
import { AuthProvider } from "./contexts/AuthContext";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <ThemeProvider
        defaultTheme="system"
        storageKey="netinspector-theme"
      >
        <App />
      </ThemeProvider>
    </AuthProvider>
  </StrictMode>
);