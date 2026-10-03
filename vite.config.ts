import { defineConfig } from "vite";

// Cloudflare Pages / agenter.si uses base "/".
// GitHub Pages project site can override: VITE_BASE=/Agenter/
export default defineConfig({
  base: process.env.VITE_BASE || "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
