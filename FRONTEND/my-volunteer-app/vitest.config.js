import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    environmentOptions: { jsdom: { url: "http://127.0.0.1:5173/" } },
    include: ["tests/**/*.test.jsx"],
    setupFiles: ["./tests/dom-setup.js"],
    testTimeout: 60000,
    hookTimeout: 10000,
  },
});
