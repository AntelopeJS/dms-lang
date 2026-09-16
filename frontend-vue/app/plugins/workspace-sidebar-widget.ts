import { defineDmsPlugin } from '#dms-inertia/frontend-module'

const LANG_MODULE_ID = 'lang'

export default defineDmsPlugin(() => {
  const { register } = useSidebarWidgets()
  register({
    id: 'dms-lang:workspace-selector',
    component: 'DmsLangWorkspaceSelector',
    module: LANG_MODULE_ID,
  })
})
