import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

function resolveBuildId(): string {
  if (process.env.RENDER_GIT_COMMIT) {
    return process.env.RENDER_GIT_COMMIT.slice(0, 12);
  }
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return Date.now().toString(36);
  }
}

/**
 * Emits public/version.json and injects forge-build-id meta for stale-client detection.
 */
export function forgeVersionPlugin(): Plugin {
  let buildId = resolveBuildId();
  let outDir = 'dist';
  let entryFileName: string | undefined;

  return {
    name: 'forge-version',
    configResolved(config) {
      outDir = config.build.outDir;
      buildId = resolveBuildId();
      process.env.VITE_BUILD_ID = buildId;
    },
    generateBundle(_options, bundle) {
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk' && chunk.isEntry) {
          entryFileName = fileName;
          break;
        }
      }
    },
    transformIndexHtml(html) {
      const meta = `<meta name="forge-build-id" content="${buildId}" />`;
      if (html.includes('name="forge-build-id"')) {
        return html.replace(/<meta name="forge-build-id" content="[^"]*" \/>/, meta);
      }
      return html.replace('</head>', `    ${meta}\n  </head>`);
    },
    closeBundle() {
      const payload = {
        buildId,
        builtAt: new Date().toISOString(),
        entry: entryFileName,
      };
      writeFileSync(path.join(outDir, 'version.json'), `${JSON.stringify(payload, null, 2)}\n`);
    },
  };
}

export function forgePreconnectPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'forge-preconnect',
    transformIndexHtml(html) {
      const links: string[] = [];

      const supabaseUrl = env.VITE_SUPABASE_URL;
      if (supabaseUrl) {
        try {
          const origin = new URL(supabaseUrl).origin;
          links.push(`<link rel="preconnect" href="${origin}" crossorigin />`);
          links.push(`<link rel="dns-prefetch" href="${origin}" />`);
        } catch {
          /* invalid URL */
        }
      }

      links.push('<link rel="preconnect" href="https://openrouter.ai" crossorigin />');
      links.push('<link rel="dns-prefetch" href="https://openrouter.ai" />');
      links.push('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />');
      links.push('<link rel="dns-prefetch" href="https://fonts.gstatic.com" />');

      const block = links.map((l) => `    ${l}`).join('\n');
      return html.replace('</head>', `${block}\n  </head>`);
    },
  };
}
