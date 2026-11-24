import { defineConfig } from 'vite';
// GitHub Pages serves the site under /<repo>/; set BASE=/ for a custom domain or local preview.
export default defineConfig({ base: process.env.BASE ?? '/agentic-bim-team/', build: { target: 'es2022', chunkSizeWarningLimit: 4000 }, worker: { format: 'es' } });
