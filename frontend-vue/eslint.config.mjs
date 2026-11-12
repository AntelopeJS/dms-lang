// @ts-check
import eslint from '@eslint/js'
import dmsGlobals from '@antelopejs/dms/eslint-globals'
import rendererGlobals from '@antelopejs/dms-frontend/eslint-globals'
import typescript from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import vue from 'eslint-plugin-vue'
import globals from 'globals'

const sourceFiles = ['**/*.{js,mjs,cjs,ts,vue}']

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  eslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.{ts,mts,cts}'],
    languageOptions: { parser: typescriptParser },
  },
  {
    files: sourceFiles,
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...rendererGlobals,
        ...dmsGlobals,
      },
      parserOptions: {
        parser: typescriptParser,
        sourceType: 'module',
      },
    },
    plugins: { '@typescript-eslint': typescript },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
]
