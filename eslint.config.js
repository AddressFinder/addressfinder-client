import js from '@eslint/js'
import compat from 'eslint-plugin-compat'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    // Fails the build on any browser API outside package.json's browserslist
    // (Baseline widely available).
    files: ['src/**/*.ts'],
    ...compat.configs['flat/recommended']
  },

  {
    // The package must import cleanly under SSR, which a stray DOM reference
    // breaks only in a customer's build.
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error',
        ...['document', 'window', 'navigator', 'screen', 'localStorage', 'sessionStorage'].map((name) => ({
          name,
          message: 'src must not read the browser, so the package imports cleanly under SSR.'
        }))
      ]
    }
  }
)
