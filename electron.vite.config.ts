import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'

// 배포 빌드에만 CSP를 건다. dev 서버는 React refresh가 inline script를 쓴다
function csp(): Plugin {
  return {
    name: 'ariadne-csp',
    apply: 'build',
    transformIndexHtml: (html: string) =>
      html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' ariadne: data: blob: https://avatars.githubusercontent.com; media-src 'self' ariadne:; connect-src 'self' ariadne:" />`,
      ),
  }
}

export default defineConfig({
  main: {
    build: {
      outDir: 'out/main',
      rollupOptions: { input: { index: resolve('app/main/index.ts') } },
    },
  },
  preload: {
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: { index: resolve('app/preload/index.ts') },
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    root: 'app/renderer',
    plugins: [react(), csp()],
    build: {
      outDir: resolve('out/renderer'),
      minify: true,
      rollupOptions: { input: resolve('app/renderer/index.html') },
    },
  },
})
