// @ts-check
import { antelopeNuxtConfig } from '@antelopejs/tooling-configs/eslint'
import dmsGlobals from '@antelopejs/dms/eslint-globals'
import rendererGlobals from '@antelopejs/dms-frontend/eslint-globals'
import globals from 'globals'

/** The preset's Vue rules that are on, read from its `nuxt/vue/rules` block. */
function enabledVueRules(configs) {
  const block = configs.find((config) => config.name === 'nuxt/vue/rules')
  if (block?.rules === undefined) throw new Error('nuxt/vue/rules not found')
  return Object.fromEntries(
    Object.entries(block.rules).filter(
      ([, rule]) => (Array.isArray(rule) ? rule[0] : rule) !== 'off',
    ),
  )
}

/**
 * The AntelopeJS Nuxt preset, with the checks it leaves to tools this layer
 * does not run: oxfmt does not format it, so the template layout rules stay,
 * and composables keep the Vue rules the preset scopes to `.vue` files.
 */
export default antelopeNuxtConfig()
  .append({
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
      'no-unreachable': 'error',
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
  .onResolved((configs) => [
    ...configs,
    { files: ['**/*.ts'], rules: enabledVueRules(configs) },
  ])
