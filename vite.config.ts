import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";

const input = process.env.INPUT;
if (!input) {
  throw new Error("INPUT environment variable required (path to HTML entry)");
}

const inputDir = path.resolve(path.dirname(input));

export default defineConfig({
  root: inputDir,
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  build: {
    outDir: path.resolve(process.env.OUT_DIR || "dist/ui"),
    emptyOutDir: false,
    rollupOptions: {
      input: path.resolve(input),
    },
  },
});
