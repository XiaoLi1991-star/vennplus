import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { copyFileSync } from 'node:fs';

const copyThirdPartyNotices = {
  name: 'copy-third-party-notices',
  closeBundle() {
    copyFileSync(
      new URL('./THIRD_PARTY_NOTICES.md', import.meta.url),
      new URL('./dist/THIRD_PARTY_NOTICES.md', import.meta.url),
    );
  },
};

export default defineConfig({
  plugins: [react(), copyThirdPartyNotices],
  server: {
    host: '127.0.0.1',
    port: 4173,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    css: true,
  },
});
