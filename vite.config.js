import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Adicione esta parte para corrigir o erro
  define: {
    "process.env": {},
  },
});
