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
 * The AntelopeJS Nuxt preset. Prettier owns the template layout, so void
 * elements self-close the way Prettier writes them, and composables keep the
 * Vue rules the preset scopes to `.vue` files.
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
      'vue/html-self-closing': ['error', { html: { void: 'always' } }],
    },
  })
  .onResolved((configs) => [
    ...configs,
    { files: ['**/*.ts'], rules: enabledVueRules(configs) },
  ])
