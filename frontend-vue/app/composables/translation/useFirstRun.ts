/**
 * Whether the workspace shown is an added one without any key yet: the
 * overview then shows its first steps instead of figures and a heatmap.
 */
export const useFirstRun = () => {
  const { isResolved, isAdded } = useWorkspaceContext()
  const { flat } = useWorkspaceFlat()
  return computed(
    () => isResolved.value && isAdded.value && flat.value.totalKeys === 0,
  )
}
