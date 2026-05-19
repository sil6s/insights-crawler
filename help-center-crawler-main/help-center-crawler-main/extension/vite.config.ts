import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";

function copyManifest(): Plugin {
  return {
    name: "copy-extension-manifest",
    async closeBundle() {
      const outDir = path.resolve("extension", "dist");
      const iconOutDir = path.join(outDir, "icons");
      await mkdir(outDir, { recursive: true });
      await mkdir(iconOutDir, { recursive: true });
      await copyFile(path.resolve("extension", "manifest.json"), path.join(outDir, "manifest.json"));
      await copyFile(path.join(outDir, "popup", "popup.html"), path.join(outDir, "popup.html"));
      for (const size of ["16", "32", "48", "128"]) {
        await copyFile(path.resolve("extension", "icons", `${size}.png`), path.join(iconOutDir, `${size}.png`));
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), copyManifest()],
  root: "extension/src",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: "extension/src/popup/popup.html",
        background: "extension/src/background.ts",
        contentScript: "extension/src/contentScript.ts"
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]"
      }
    }
  }
});
