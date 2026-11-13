// @ts-check
import { antelopeNuxtConfig } from '@antelopejs/tooling-configs/eslint'
import dmsGlobals from '@antelopejs/dms/eslint-globals'
import rendererGlobals from '@antelopejs/dms-frontend/eslint-globals'
import globals from 'globals'

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
    'vue/html-closing-bracket-newline': 'error',
    'vue/html-closing-bracket-spacing': 'error',
    'vue/html-indent': 'error',
    'vue/html-quotes': 'error',
    'vue/max-attributes-per-line': 'error',
    'vue/multiline-html-element-content-newline': 'error',
    'vue/mustache-interpolation-spacing': 'error',
    'vue/no-multi-spaces': 'error',
    'vue/no-spaces-around-equal-signs-in-attribute': 'error',
    'vue/singleline-html-element-content-newline': 'error',
  },
})
