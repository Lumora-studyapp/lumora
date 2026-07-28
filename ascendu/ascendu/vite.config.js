import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        // Keep the classroom shell and Lumora feature code in a small app chunk.
        // Firebase and React change less often and can be cached independently.
        manualChunks: {
          firebase: ["firebase/app", "firebase/auth", "firebase/firestore", "firebase/functions"],
          react: ["react", "react-dom"],
        },
      },
    },
  },
});
