import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  // Agents' worktrees live under .claude/; they are separate checkouts, not part of this site.
  server: { watch: { ignored: ["**/.claude/**"] } },
  optimizeDeps: { entries: ["index.html"] },
});
