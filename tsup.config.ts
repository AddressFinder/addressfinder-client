import { defineConfig } from 'tsup'

// No script-tag build: a page using a script tag gets this package bundled
// inside addressfinder-js's hosted build.
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  target: 'es2022',
  dts: true,
  sourcemap: true,
  clean: true
})
