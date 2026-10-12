/**
 * Whether the workspace shown is an added one without any key yet: the
 * overview then shows its first steps instead of figures and a heatmap.
 */
export const useFirstRun = () => {
  const { current, isAdded } = useWorkspaceContext()
  return computed(() => isAdded.value && current.value?.totalKeys === 0)
}
