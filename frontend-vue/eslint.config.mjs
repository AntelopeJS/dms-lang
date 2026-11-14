// @ts-check
import { antelopeNuxtConfig } from '@antelopejs/tooling-configs/eslint'
import dmsGlobals from '@antelopejs/dms/eslint-globals'
import rendererGlobals from '@antelopejs/dms-frontend/eslint-globals'
import globals from 'globals'

/**
 * The AntelopeJS Nuxt preset. Prettier owns the template layout, so void
 * elements self-close the way Prettier writes them.
 */
export default antelopeNuxtConfig().append({
  files: ['**/*.{js,mjs,cjs,ts,vue}'],
  languageOptions: {
    globals: {
      ...globals.browser,
      ...globals.node,
      ...rendererGlobals,
      ...dmsGlobals,
    },
  },
  rules: {
    'no-undef': 'error',
    'vue/html-self-closing': ['error', { html: { void: 'always' } }],
  },
})
