import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Zoom y Teams exigen servir la app por HTTPS.
// En dev usamos un túnel (ngrok/cloudflared) apuntando a este puerto,
// o `vite --host` + un proxy HTTPS. En prod se despliega estático (Vercel, etc.).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Permite que el túnel/host externo sirva la app dentro del webview.
    cors: true,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
