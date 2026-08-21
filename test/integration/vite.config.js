import { resolve } from "node:path";
import { defineConfig } from "vite";

const root = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      "socket.io-client": resolve(root, "../../build/esm/index.js"),
    },
  },
  build: {
    lib: {
      entry: resolve(
        root,
        "../../../../code/crisp-library-client/src/index.js",
      ),
      formats: ["es"],
      fileName: "crisp-client",
    },
    minify: false,
    outDir: resolve(root, "dist"),
    emptyOutDir: true,
  },
});
