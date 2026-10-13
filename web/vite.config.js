import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // Libraries and the scenario gallery change at different paces from the app code: separate
        // chunks keep each under the size warning and let the browser cache them independently.
        codeSplitting: {
          groups: [
            { name: 'vendor', test: /[\/]node_modules[\/]/ },
            { name: 'gallery', test: /[\/]src[\/](presets\w*|presetHelpers|presetSummaries)\.mjs$/ }
          ]
        }
      }
    }
  },
  server: { proxy: { '/api': 'http://127.0.0.1:5080' } },
  preview: { proxy: { '/api': 'http://127.0.0.1:5080' } }
});
