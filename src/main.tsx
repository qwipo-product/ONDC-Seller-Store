import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import App from "./app/App.tsx";
import { AuthProvider } from "./app/lib/auth-context";
import "./styles/index.css";

// next-themes flips a `dark` class on <html> based on the persisted
// preference (qwipo.theme) so all the CSS variables in theme.css and
// the dark-mode overrides flip together. attribute="class" is what
// drives Tailwind v4's @custom-variant dark (&:is(.dark *)).
//
// defaultTheme="light" — first-time visitors see the canonical
// brand surface; toggling dark is a deliberate user action.
// enableSystem=false — we don't auto-follow OS preference. The
// product team wants the toggle to be the source of truth.
createRoot(document.getElementById("root")!).render(
  <ThemeProvider
    attribute="class"
    defaultTheme="light"
    enableSystem={false}
    storageKey="qwipo.theme"
    disableTransitionOnChange
  >
    <AuthProvider>
      <App />
    </AuthProvider>
  </ThemeProvider>,
);
