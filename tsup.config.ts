import { defineConfig } from 'tsup'

// No script-tag build: a page using a script tag gets this package bundled
// inside the hosted build of the library that uses it.
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  target: 'es2022',
  dts: true,
  // No maps: the output is unminified, so they add little for debugging, and
  // they would publish every source comment. Revisit if the output is ever minified.
  sourcemap: false,
  clean: true
})
