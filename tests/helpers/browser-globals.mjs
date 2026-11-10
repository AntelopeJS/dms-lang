/**
 * @packageDocumentation
 * Stand-ins for the browser globals Node lacks, checked against the DOM
 * types: a stub may leave a member out, but each member it holds has the
 * type the browser gives it.
 */

/**
 * The members of `T` a stub may hold: functions as `T` types them, objects
 * as stubs of their own.
 *
 * @template T
 * @typedef {{ [K in keyof T]?: T[K] extends (...args: never[]) => unknown ? T[K] : BrowserStub<T[K]> }} BrowserStub
 */

/**
 * Installs `stub` as the global `name`, as `Object.assign(globalThis, { [name]: stub })` would.
 *
 * @template {"document" | "window"} Name
 * @param {Name} name
 * @param {BrowserStub<(typeof globalThis)[Name]>} stub
 */
export function stubBrowserGlobal(name, stub) {
  Reflect.set(globalThis, name, stub);
}
