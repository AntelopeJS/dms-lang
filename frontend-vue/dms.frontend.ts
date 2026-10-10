import { defineAsyncComponent, type Component } from 'vue'
import type { DmsFrontendModule } from '#dms/frontend-module'

interface VueModule {
  default: Component
}

const components = import.meta.glob<VueModule>(
  './app/{components,build/components}/**/*.vue',
)

function componentName(path: string): string {
  return path
    .split('/')
    .at(-1)!
    .replace(/\.vue$/, '')
}

const frontendModule: DmsFrontendModule = {
  componentPrefix: 'DmsLang',
  setup(sdk) {
    for (const [path, loader] of Object.entries(components).sort()) {
      sdk.registerComponent(
        componentName(path),
        defineAsyncComponent(async () => (await loader()).default),
      )
    }
  },
}

export default frontendModule
