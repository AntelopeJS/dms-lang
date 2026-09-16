import { defineAsyncComponent, type Component } from 'vue'
import type { DmsFrontendModule } from '#dms-inertia/frontend-module'
import workspaceSidebarWidget from './app/plugins/workspace-sidebar-widget'

interface VueModule {
  default: Component
}

const components = import.meta.glob<VueModule>(
  './app/{components,build/components}/**/*.vue',
)
const pages = import.meta.glob<VueModule>('./app/custom-pages/**/*.vue')

const frontendModule: DmsFrontendModule = {
  setup(sdk) {
    for (const [path, loader] of Object.entries(components).sort()) {
      const name = path
        .split('/')
        .at(-1)!
        .replace(/\.vue$/, '')
      sdk.registerComponent(
        `DmsLang${name}`,
        defineAsyncComponent(async () => (await loader()).default),
      )
    }
    for (const [path, loader] of Object.entries(pages).sort()) {
      const name = path.replace('./app/custom-pages/', '').replace(/\.vue$/, '')
      const component = defineAsyncComponent(
        async () => (await loader()).default,
      )
      sdk.registerPage(name, component, loader)
      const componentName = name
        .split(/[/_-]/)
        .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
        .join('')
      sdk.registerComponent(`Dms${componentName}`, component)
    }
    sdk.registerPlugin(workspaceSidebarWidget)
  },
}

export default frontendModule
