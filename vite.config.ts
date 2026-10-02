import { defineConfig } from "vite";

// GitHub Pages project site for Fudan2026/Agenter → path /Agenter/
export default defineConfig({
  base: "/Agenter/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
