import type { Action, Component } from "@antelopejs/interface-dms/component";

/** The action `id` of a component; throws at startup when it declares none. */
export function requireAction(component: Component, id: string): Action {
  const action = component.getAction(id);
  if (!action) throw new Error(`dms-lang: missing component action "${id}"`);
  return action;
}
