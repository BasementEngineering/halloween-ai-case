import { defineConfig } from "vite";
import { redQueenApi } from "./server/api.js";

export default defineConfig({
  plugins: [redQueenApi()],
});
