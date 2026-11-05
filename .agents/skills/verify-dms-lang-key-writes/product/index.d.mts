/**
 * The product code the check runs, typed from `src/`: `product.mjs` loads it
 * from the build in `dist/`, which does not exist before `pnpm run build`.
 */
export { isString } from "../../../../src/utils/guards.ts";
export { isJsonObject, nodeKindAt, type JsonObject } from "../../../../src/utils/json.ts";
export { createKey, deleteKey, removeOverride, renameKey, updateKey, type KeyStore } from "../../../../src/utils/keys.ts";
export { deepMerge, getValueAtPath, leafPaths } from "../../../../src/utils/tree.ts";
export { writeTargetOf } from "../../../../src/utils/write-target.ts";
