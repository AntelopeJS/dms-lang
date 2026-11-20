import { createHash } from "node:crypto";
import type { TriggerType } from "@antelopejs/interface-dms-automation";
import { Logging } from "@antelopejs/interface-core/logging";
import {
  frontendModuleNames,
  onRegistryChanged,
  registryStamp,
} from "../../utils/registry";
import { resolveFlat } from "../../utils/resolve";
import { MODULES_WORKSPACE } from "../../utils/workspaces";
import { KEY_PREFIX_PORT, matchesPrefix } from "../fields";
import { nodeTexts, objectSchema } from "../support";
import { capped, MAX_PAYLOAD_KEYS } from "./shared";

const ID = "lang.module-texts-changed";
const texts = nodeTexts("triggers", ID);
const DEFAULT_INTERVAL_SECONDS = 300;
const MIN_INTERVAL_SECONDS = 60;
const MAX_INTERVAL_SECONDS = 86_400;
const SETTLE_MS = 5000;
const DELIVERY_ID_LENGTH = 24;

export interface ModuleTextsChangedConfig {
  intervalSeconds?: number;
  keyPrefix?: string;
}

/** The modules catalog at one moment. */
interface Snapshot {
  stamp: string;
  modules: string[];
  texts: Map<string, string>;
  overridden: Set<string>;
  totalKeys: number;
}

export interface ModuleTextsPayload {
  [field: string]: string | string[] | number | boolean;
  deliveryId: string;
  modulesAdded: string[];
  modulesRemoved: string[];
  keysAdded: string[];
  keysRemoved: string[];
  keysChanged: string[];
  overriddenChanged: string[];
  keyCount: number;
  keysTruncated: boolean;
  totalKeys: number;
  at: string;
}

/** An armed watcher: `settle` diffs now against the baseline, `stop` ends it. */
export interface ModuleTextsHandle {
  stop(): void;
  settle(): void;
}

function snapshot(): Snapshot {
  const flat = resolveFlat(MODULES_WORKSPACE);
  const base = flat.defaultLocale;
  return {
    stamp: registryStamp(),
    modules: frontendModuleNames(),
    texts: new Map(
      flat.rows.map((row) => [row.key, String(row.values[base] ?? "")]),
    ),
    overridden: new Set(
      flat.rows.filter((row) => row.overridden === true).map((row) => row.key),
    ),
    totalKeys: flat.totalKeys,
  };
}

function diffOf(
  before: Snapshot,
  after: Snapshot,
  prefix: string,
): ModuleTextsPayload | undefined {
  const inScope = (key: string) => matchesPrefix(key, prefix);
  const added = [...after.texts.keys()].filter(
    (key) => !before.texts.has(key) && inScope(key),
  );
  const removed = [...before.texts.keys()].filter(
    (key) => !after.texts.has(key) && inScope(key),
  );
  const changed = [...after.texts]
    .filter(
      ([key, text]) =>
        before.texts.has(key) && before.texts.get(key) !== text && inScope(key),
    )
    .map(([key]) => key);
  const modulesAdded = after.modules.filter(
    (name) => !before.modules.includes(name),
  );
  const modulesRemoved = before.modules.filter(
    (name) => !after.modules.includes(name),
  );
  const keyCount = added.length + removed.length + changed.length;
  if (
    keyCount === 0 &&
    (prefix !== "" ||
      (modulesAdded.length === 0 && modulesRemoved.length === 0))
  )
    return undefined;
  const overriddenChanged = [...changed, ...removed].filter(
    (key) => before.overridden.has(key) || after.overridden.has(key),
  );
  const lists = [added, removed, changed, overriddenChanged].map(capped);
  return {
    deliveryId: createHash("sha1")
      .update(`${before.stamp}\n${after.stamp}`)
      .digest("hex")
      .slice(0, DELIVERY_ID_LENGTH),
    modulesAdded,
    modulesRemoved,
    keysAdded: lists[0]?.items ?? [],
    keysRemoved: lists[1]?.items ?? [],
    keysChanged: lists[2]?.items ?? [],
    overriddenChanged: lists[3]?.items ?? [],
    keyCount,
    keysTruncated: lists.some((list) => list.truncated),
    totalKeys: after.totalKeys,
    at: new Date().toISOString(),
  };
}

const STRING_LIST = {
  type: "array",
  items: { type: "string" },
  maxItems: MAX_PAYLOAD_KEYS,
};

/**
 * Watches the texts the installed modules ship: the module list the DMS
 * reports, and a stat-only poll of their files. After a change, it waits
 * until nothing changed for 5 s (startup registers modules in a burst), then
 * diffs the modules catalog against its baseline. The first settled state
 * is the baseline and fires nothing.
 */
export const moduleTextsChangedTrigger: TriggerType<
  ModuleTextsChangedConfig,
  ModuleTextsPayload,
  ModuleTextsHandle
> = {
  id: ID,
  name: texts.name,
  description: texts.description,
  icon: "i-ph-package",
  cluster: "singleton",
  configSchema: objectSchema({
    intervalSeconds: {
      type: "integer",
      minimum: 0,
      maximum: MAX_INTERVAL_SECONDS,
      default: DEFAULT_INTERVAL_SECONDS,
      description: texts.hint("intervalSeconds"),
    },
    keyPrefix: KEY_PREFIX_PORT,
  }),
  outputSchema: objectSchema(
    {
      deliveryId: { type: "string" },
      modulesAdded: { type: "array", items: { type: "string" } },
      modulesRemoved: { type: "array", items: { type: "string" } },
      keysAdded: STRING_LIST,
      keysRemoved: STRING_LIST,
      keysChanged: STRING_LIST,
      overriddenChanged: STRING_LIST,
      keyCount: { type: "number" },
      keysTruncated: { type: "boolean" },
      totalKeys: { type: "number" },
      at: { type: "string", format: "date-time" },
    },
    [
      "deliveryId",
      "modulesAdded",
      "modulesRemoved",
      "keysAdded",
      "keysRemoved",
      "keysChanged",
      "overriddenChanged",
      "keyCount",
      "keysTruncated",
      "totalKeys",
      "at",
    ],
  ),
  async activate(config, emit) {
    const prefix = config.keyPrefix ?? "";
    let baseline: Snapshot | undefined;
    let lastStamp = "";
    let stopped = false;
    let settleTimer: NodeJS.Timeout | undefined;
    const settle = () => {
      if (stopped) return;
      try {
        const current = snapshot();
        lastStamp = current.stamp;
        if (baseline !== undefined && baseline.stamp !== current.stamp) {
          const payload = diffOf(baseline, current, prefix);
          if (payload) emit(payload);
        }
        baseline = current;
      } catch (error) {
        Logging.Error("[dms-lang] module-texts-changed check failed:", error);
      }
    };
    const schedule = () => {
      if (stopped) return;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(settle, SETTLE_MS);
    };
    const unsubscribe = onRegistryChanged(schedule);
    const seconds = config.intervalSeconds ?? DEFAULT_INTERVAL_SECONDS;
    const pollTimer =
      seconds === 0
        ? undefined
        : setInterval(
            () => {
              try {
                if (registryStamp() !== lastStamp) schedule();
              } catch (error) {
                Logging.Error(
                  "[dms-lang] module-texts-changed poll failed:",
                  error,
                );
              }
            },
            Math.min(
              Math.max(seconds, MIN_INTERVAL_SECONDS),
              MAX_INTERVAL_SECONDS,
            ) * 1000,
          );
    schedule();
    return {
      settle,
      stop() {
        stopped = true;
        unsubscribe();
        clearTimeout(settleTimer);
        clearInterval(pollTimer);
      },
    };
  },
  async deactivate(handle) {
    handle.stop();
  },
};
