import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * GitHub Pages project site: base ต้องเป็น /<ชื่อ-repo>/ มิฉะนั้น asset 404
 * - dev server (serve) ยังใช้ '/' — localhost ไม่เปลี่ยนแปลง
 * - build ใช้ /file-vault/ (หรือ VITE_BASE_PATH จาก CI)
 */
export default defineConfig(({ command }) => {
  const base =
    process.env.VITE_BASE_PATH || (command === 'serve' ? '/' : '/file-vault/');

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'icon-maskable.svg'],
        manifest: {
          name: 'File Vault — คลังไฟล์บน OneDrive',
          short_name: 'File Vault',
          description: 'เก็บไฟล์ส่วนตัวบน OneDrive ของคุณเอง — ไม่มีเซิร์ฟเวอร์กลาง',
          lang: 'th',
          display: 'standalone',
          start_url: '.',
          scope: '.',
          background_color: '#0b1220',
          theme_color: '#0b1220',
          icons: [
            {
              src: 'icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            },
            {
              src: 'icon-maskable.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // แคชเฉพาะ static assets ของแอป — ไม่แคชคำขอ Graph (มี Authorization header แยก)
          runtimeCaching: [],
        },
      }),
    ],
    server: {
      // พอร์ตต้องล็อกไว้เพราะต้องลงทะเบียน redirect URI นี้ไว้ใน Azure พอดี
      port: 5173,
      strictPort: true,
    },
    preview: {
      port: 4173,
    },
    build: {
      target: 'es2022',
      sourcemap: true,
    },
  };
});
