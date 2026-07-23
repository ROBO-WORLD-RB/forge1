import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { imagetools } from 'vite-imagetools';
import { visualizer } from 'rollup-plugin-visualizer';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { forgePreconnectPlugin, forgeVersionPlugin } from './plugins/forgeVersionPlugin';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        // Proxy for Ollama API to avoid CORS issues
        proxy: {
          '/ollama': {
            target: 'http://127.0.0.1:11434',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/ollama/, ''),
            configure: (proxy, options) => {
              // Error handling for proxy connection failures
              proxy.on('error', (err, req, res) => {
                console.error('[Ollama Proxy Error]', {
                  message: err.message,
                  code: (err as any).code,
                  method: req.method,
                  url: req.url,
                  timestamp: new Date().toISOString(),
                });
                
                // Safely handle the response if it exists and hasn't been finished
                // Some errors (like socket hangs) might not have a proper response object
                if (res && 'writeHead' in res && !res.writableEnded) {
                  res.writeHead(503, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    error: 'Ollama service unavailable',
                    message: 'Could not connect to Ollama service. Make sure Ollama is running with: ollama serve',
                    details: err.message,
                  }));
                }
              });
              
              // Log successful proxy requests for debugging
              proxy.on('proxyReq', (proxyReq, req, res) => {
                console.debug('[Ollama Proxy Request]', {
                  method: req.method,
                  path: req.url,
                  timestamp: new Date().toISOString(),
                });
              });
              
              // Log successful proxy responses
              proxy.on('proxyRes', (proxyRes, req, res) => {
                console.debug('[Ollama Proxy Response]', {
                  method: req.method,
                  path: req.url,
                  statusCode: proxyRes.statusCode,
                  timestamp: new Date().toISOString(),
                });
              });
            },
          },
        },
      },
      // Build optimization configuration
      build: {
        // Enable source maps for production (for Sentry)
        sourcemap: true,
        // Minify CSS and JS
        minify: 'esbuild',
        cssMinify: true,
        // Configure chunk splitting
        rollupOptions: {
          output: {
            // Content hash in filenames for cache busting (Requirements 5.1)
            entryFileNames: 'assets/[name]-[hash].js',
            chunkFileNames: 'assets/[name]-[hash].js',
            assetFileNames: 'assets/[name]-[hash].[ext]',
            // Manual chunk splitting for better caching (Requirements 5.2)
            // IMPORTANT: Order and path matching matter. A broad `/react/` regex
            // pulled `@sentry/react` into vendor-react while other @sentry/*
            // packages went to vendor-sentry, and splitting react-helmet-async
            // into its own chunk created a circular init graph that threw
            // "Cannot access 'f' before initialization" at index.esm.js:441
            // (react-helmet-async reading React.version) — blank white page.
            manualChunks(id) {
              if (!id.includes('node_modules')) return;
              // Scoped packages first — before any react path matching
              if (id.includes('@sentry')) return 'vendor-sentry';
              if (id.includes('@supabase')) return 'vendor-supabase';
              if (id.includes('@google/genai')) return 'vendor-genai';
              if (id.includes('@paystack')) return 'vendor-paystack';
              if (id.includes('@hookform')) return 'vendor-forms';
              if (id.includes('framer-motion')) return 'vendor-motion';
              if (id.includes('lucide-react')) return 'vendor-ui';
              if (id.includes('react-hook-form') || id.includes(`${path.sep}zod${path.sep}`) || id.includes('/zod/')) {
                return 'vendor-forms';
              }
              // Keep react-helmet-async with React to avoid cross-chunk TDZ
              if (
                id.includes('react-dom') ||
                id.includes('react-router') ||
                id.includes('react-helmet') ||
                /[/\\]node_modules[/\\]react[/\\]/.test(id)
              ) {
                return 'vendor-react';
              }
            },
          },
        },
        // Target modern browsers for smaller bundles
        target: 'es2020',
        // Chunk size warning threshold
        chunkSizeWarningLimit: 500,
      },
      // CSS configuration (Requirements 5.5)
      css: {
        devSourcemap: true,
      },
      plugins: [
        react(),
        forgeVersionPlugin(),
        forgePreconnectPlugin(env),
        // Image optimization plugin (Requirements 5.3)
        imagetools({
          // Default directives for image processing
          defaultDirectives: (url) => {
            // Apply WebP conversion for jpg/png images when ?webp is used
            if (url.searchParams.has('webp')) {
              return new URLSearchParams({
                format: 'webp',
                quality: '80',
              });
            }
            // Apply optimization for images with ?optimize
            if (url.searchParams.has('optimize')) {
              return new URLSearchParams({
                quality: '80',
              });
            }
            return new URLSearchParams();
          },
        }),
        VitePWA({
          // prompt: never auto-reload; no in-app update UI.
          registerType: 'prompt',
          injectRegister: null,
          includeAssets: ['icons/*.svg', 'icons/*.png', 'manifest.json', 'offline.html', '_headers'],
          manifest: {
            name: 'FORGE - Blue-Collar Marketplace',
            short_name: 'FORGE',
            description: 'Find skilled workers in Ghana and Nigeria',
            start_url: '/',
            display: 'standalone',
            background_color: '#FAFAFA',
            theme_color: '#FF6B2E',
            orientation: 'portrait-primary',
            scope: '/',
            lang: 'en',
            categories: ['business', 'productivity'],
            icons: [
              {
                src: '/icons/icon-192.svg',
                sizes: '192x192',
                type: 'image/svg+xml',
                purpose: 'any'
              },
              {
                src: '/icons/icon-512.svg',
                sizes: '512x512',
                type: 'image/svg+xml',
                purpose: 'any'
              }
            ]
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
            globIgnores: ['**/version.json'],
            // Drop old precache entries after redeploy so clients don't keep
            // requesting hashed chunks that no longer exist (ChunkLoadError).
            cleanupOutdatedCaches: true,
            // New SW waits in background; no auto-activation or update prompts.
            clientsClaim: true,
            skipWaiting: false,
            // SPA shell — never use offline.html here. That made every soft
            // navigation (OAuth /auth/callback, /dashboard, etc.) show
            // "You're Offline" while the user was actually online.
            navigateFallback: 'index.html',
            navigateFallbackDenylist: [
              /^\/api\//,
              /^\/offline\.html$/,
              /\/[^/?]+\.[^/]+$/, // static files with extensions
            ],
            runtimeCaching: [
              {
                urlPattern: /\/version\.json$/,
                handler: 'NetworkOnly',
              },
              {
                urlPattern: ({ request }) => request.mode === 'navigate',
                handler: 'NetworkFirst',
                options: {
                  cacheName: 'html-shell',
                  networkTimeoutSeconds: 3,
                  expiration: {
                    maxEntries: 4,
                    maxAgeSeconds: 60 * 60,
                  },
                },
              },
              // Never cache authenticated Supabase REST (stale auth-scoped data / privacy).
              {
                urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
                handler: 'NetworkOnly',
              },
              {
                urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/v1\/.*/i,
                handler: 'NetworkOnly',
              },
              {
                urlPattern: /^https:\/\/.*\.supabase\.co\/functions\/v1\/.*/i,
                handler: 'NetworkOnly',
              },
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              {
                urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'gstatic-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              {
                urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'images-cache',
                  expiration: {
                    maxEntries: 50,
                    maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                  }
                }
              }
            ]
          },
          devOptions: {
            enabled: false
          }
        }),
        // Bundle analysis plugin (Requirements 5.6)
        // Only generate report in production build
        mode === 'production' && visualizer({
          filename: 'dist/bundle-analysis.html',
          open: false,
          gzipSize: true,
          brotliSize: true,
          template: 'treemap', // Options: 'treemap', 'sunburst', 'network'
        }),
        // Sentry source map upload plugin (Requirements 4.6)
        // Only upload source maps in production build when Sentry is configured
        mode === 'production' && env.SENTRY_AUTH_TOKEN && sentryVitePlugin({
          org: env.SENTRY_ORG || 'forge',
          project: env.SENTRY_PROJECT || 'forge-web',
          authToken: env.SENTRY_AUTH_TOKEN,
          // Upload source maps to Sentry
          sourcemaps: {
            assets: './dist/**',
            filesToDeleteAfterUpload: ['./dist/**/*.map'], // Delete source maps after upload for security
          },
          // Release configuration
          release: {
            name: env.npm_package_version || 'development',
          },
          // Disable telemetry
          telemetry: false,
        }),
      ].filter(Boolean),
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // Preview server configuration with cache headers (Requirements 5.4)
      preview: {
        port: 4173,
        headers: {
          // Cache static assets for 1 year (they have content hashes)
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      },
    };
});
