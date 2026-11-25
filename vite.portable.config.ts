import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function inlineSingleFileHtmlPlugin(): Plugin {
  return {
    name: 'inline-single-file-html',
    apply: 'build',
    closeBundle(error?: Error): void {
      if (error) return;

      const outDir = path.resolve(__dirname, 'dist-portable');
      const indexPath = path.join(outDir, 'index.html');
      const outputPath = path.join(outDir, 'local-refreshments.html');

      if (!fs.existsSync(indexPath)) return;

      let html = fs.readFileSync(indexPath, 'utf-8');

      // Inline all linked stylesheets
      html = html.replace(
        /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi,
        (match, href: string) => {
          const cleanHref = href.replace(/^\//, '');
          const cssPath = path.join(outDir, cleanHref);
          if (!fs.existsSync(cssPath)) return match;
          const css = fs.readFileSync(cssPath, 'utf-8');
          return `<style>${css}</style>`;
        }
      );

      // Remove modulepreload links
      html = html.replace(/<link\b[^>]*rel=["']modulepreload["'][^>]*>\s*/gi, '');

      // Extract and inline the bundled IIFE script before </body>
      let inlinedScript = '';
      html = html.replace(
        /<script\b[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi,
        (match, src: string) => {
          const cleanSrc = src.replace(/^\//, '');
          const jsPath = path.join(outDir, cleanSrc);
          if (!fs.existsSync(jsPath)) return match;
          const js = fs.readFileSync(jsPath, 'utf-8').replace(/<\/script/gi, '<\\/script');
          inlinedScript += `<script>${js}</script>`;
          return '';
        }
      );

      if (inlinedScript) {
        html = html.replace('</body>', () => `${inlinedScript}\n  </body>`);
      }

      fs.writeFileSync(outputPath, html, 'utf-8');
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), inlineSingleFileHtmlPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist-portable',
      emptyOutDir: true,
      assetsInlineLimit: 100_000_000,
      cssCodeSplit: false,
      rollupOptions: {
        output: {
          format: 'iife' as const,
          inlineDynamicImports: true,
          entryFileNames: 'assets/bundle.js',
          assetFileNames: 'assets/[name][extname]',
        },
      },
    },
  };
});
