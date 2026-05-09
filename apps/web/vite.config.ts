import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: resolve(__dirname),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: /^maplibre-gl$/,
        replacement: resolve(__dirname, "../../node_modules/maplibre-gl/src/index.ts"),
      },
      {
        find: "@",
        replacement: resolve(__dirname, "src"),
      },
    ],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_TARGET ?? "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          const packagePath = id.split("node_modules/")[1];
          if (!packagePath) {
            return;
          }

          if (packagePath.startsWith("react/") || packagePath === "react" || packagePath.startsWith("react-dom/") || packagePath === "react-dom") {
            return "vendor-react";
          }

          if (
            packagePath.startsWith("react-router") ||
            packagePath.startsWith("@tanstack/react-query") ||
            packagePath.startsWith("@remix-run/router")
          ) {
            return "vendor-routing";
          }

          if (packagePath.startsWith("maplibre-gl/src/")) {
            const maplibreSection = packagePath.split("/")[2] ?? "core";
            if (["gl", "render", "shaders", "style", "symbol"].includes(maplibreSection)) {
              return "vendor-maplibre-engine";
            }
            return "vendor-maplibre-core";
          }

          if (packagePath.startsWith("maplibre-gl")) {
            return "vendor-maplibre";
          }

          if (
            packagePath.startsWith("@mapbox/") ||
            packagePath.startsWith("@maplibre/") ||
            packagePath.startsWith("geojson-vt") ||
            packagePath.startsWith("supercluster") ||
            packagePath.startsWith("kdbush") ||
            packagePath.startsWith("vt-pbf") ||
            packagePath.startsWith("pbf") ||
            packagePath.startsWith("protocol-buffers-schema") ||
            packagePath.startsWith("cheap-ruler") ||
            packagePath.startsWith("quickselect") ||
            packagePath.startsWith("potpack") ||
            packagePath.startsWith("earcut") ||
            packagePath.startsWith("murmurhash-js") ||
            packagePath.startsWith("serialize-to-js") ||
            packagePath.startsWith("rbush") ||
            packagePath.startsWith("pmtiles")
          ) {
            return "vendor-map-geo";
          }

          if (packagePath.startsWith("preline/")) {
            return "vendor-preline";
          }

          if (packagePath.startsWith("lucide-react")) {
            return "vendor-icons";
          }

          const [scopeOrName, maybeName] = packagePath.split("/");
          const packageName = scopeOrName.startsWith("@") ? `${scopeOrName}-${maybeName}` : scopeOrName;
          return `vendor-${packageName.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
        },
      },
    },
  },
});
