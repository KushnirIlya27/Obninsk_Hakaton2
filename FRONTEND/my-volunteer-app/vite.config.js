import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
const proxy = Object.fromEntries(
  ["/api", "/admin", "/static", "/accounts", "/shop"].map((path) => [
    path,
    {
      target: "http://127.0.0.1:8000",
      changeOrigin: false,
    },
  ]),
);
export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5173, strictPort: true, proxy },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true, proxy },
});
