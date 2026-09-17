import { resolve } from "node:path";
import { defineConfig } from "vite";

const root = import.meta.dirname;

export default defineConfig({
  build: {
    lib: {
      entry: resolve(root, "lib/index.ts"),
      formats: ["es"],
      fileName: "index",
    },
    target: "es2018",
    minify: false,
    outDir: resolve(root, "build/esm"),
    emptyOutDir: false,
    rollupOptions: {
      external: ["@socket.io/component-emitter", "backo2"],
    },
  },
});
