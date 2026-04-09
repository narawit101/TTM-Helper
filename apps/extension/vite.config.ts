import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import { manifest } from "./src/manifest";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    plugins: [
      react(),
      crx({ manifest })
    ],
    define: {
      __API_URL__: JSON.stringify(env.VITE_API_URL ?? "http://localhost:3000/api")
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      cors: true,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "*"
      },
      hmr: {
        host: "127.0.0.1",
        port: 5173
      }
    },
    build: {
      outDir: "dist",
      emptyOutDir: true
    }
  };
});
