import { defineConfig } from 'vitest/config'

// Plain Node, as under SSR: a test that needs a browser stubs `window` and
// `navigator` itself.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts']
  }
})
