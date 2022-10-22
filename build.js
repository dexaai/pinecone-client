const esbuild = require('esbuild');

// Native ESM build
esbuild
  .build({
    entryPoints: ['src/index.ts'],
    outdir: 'dist',
    external: ['ky'],
    bundle: true,
    sourcemap: true,
    minify: false,
    splitting: true,
    format: 'esm',
    target: ['esnext'],
  })
  .catch(() => process.exit(1));

// Native CJS build
esbuild
  .build({
    entryPoints: ['src/index.ts'],
    outfile: 'dist/index.cjs.js',
    bundle: true,
    sourcemap: true,
    minify: false,
    platform: 'node',
    target: ['node16'],
  })
  .catch(() => process.exit(1));

// The polyfill version is only built as CJS because no environment that needs
// it supports ESM natively.
esbuild
  .build({
    entryPoints: ['src/fetch-polyfill/index.ts'],
    outfile: 'dist/fetch-polyfill/index.js',
    external: ['cross-fetch'],
    bundle: true,
    sourcemap: true,
    minify: false,
    platform: 'node',
    target: ['node16'],
  })
  .catch(() => process.exit(1));
