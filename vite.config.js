import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: true,
    allowedHosts: ['sports.diveley.net']
  },
  preview: {
    host: true,
    allowedHosts: ['sports.diveley.net']
  }
});
