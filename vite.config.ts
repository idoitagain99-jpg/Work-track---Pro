import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';import fs from 'node:fs';
// These files sit next to the code (easy to upload from a phone); copy them into the built site.
const pwa=['manifest.webmanifest','sw.js','icon-192.png','icon-512.png','icon-maskable.png'];
export default defineConfig({base:'./',plugins:[react(),{name:'copy-pwa-files',apply:'build',writeBundle(){for(const f of pwa)fs.copyFileSync(f,'dist/'+f)}}]});
