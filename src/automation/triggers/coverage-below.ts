import type { TriggerType } from "@antelopejs/interface-dms-automation";
import { Logging } from "@antelopejs/interface-core/logging";
import { listAllWorkspaces, resolveWorkspaceId } from "../../utils/catalog";
import { findLocale } from "../../utils/locale-codes";
import { resolveFlat } from "../../utils/resolve";
import {
  MODULES_WORKSPACE,
  type WorkspaceKind,
  workspaceKind,
} from "../../utils/workspaces";
import { LOCALE_PORT, WORKSPACE_PORT } from "../fields";
import { nodeTexts, objectSchema } from "../support";
import { watchedWorkspace } from "./shared";

const ID = "lang.coverage-below";
const texts = nodeTexts("triggers", ID);
const DEFAULT_THRESHOLD = 100;
const DEFAULT_INTERVAL_SECONDS = 300;
const MIN_INTERVAL_SECONDS = 60;
const MAX_INTERVAL_SECONDS = 86_400;

export interface CoverageBelowConfig {
  workspace?: string;
  locale?: string;
  threshold?: number;
  intervalSeconds?: number;
  fireOnStart?: boolean;
}

export interface CoverageBelowPayload {
  [field: string]: string | number | undefined;
  deliveryId: string;
  workspace: string;
  workspaceKind: WorkspaceKind;
  locale: string;
  coverage: number;
  previousCoverage?: number;
  threshold: number;
  missing: number;
  totalKeys: number;
  at: string;
}

/** An armed poller: `poll` reads the coverage now, `stop` ends it. */
export interface CoverageHandle {
  stop(): void;
  poll(): void;
}

interface Reading {
  workspace: string;
  locale: string;
  coverage: number;
  missing: number;
  totalKeys: number;
}

function watchedIds(config: CoverageBelowConfig): string[] {
  const named = watchedWorkspace(config.workspace);
  if (named !== "") return [resolveWorkspaceId(named)];
  return listAllWorkspaces()
    .filter((workspace) => workspace.id !== MODULES_WORKSPACE)
    .map((workspace) => workspace.id);
}

function readingsOf(config: CoverageBelowConfig): Reading[] {
  const wanted = config.locale?.trim() ?? "";
  return watchedIds(config).flatMap((workspace) => {
    const flat = resolveFlat(workspace);
    return flat.locales
      .filter((locale) => locale !== flat.defaultLocale)
      .filter(
        (locale) => wanted === "" || findLocale([locale], wanted) !== undefined,
      )
      .map((locale) => ({
        workspace,
        locale,
        coverage: flat.localeProgress[locale] ?? 0,
        missing: flat.localeMissing[locale] ?? 0,
        totalKeys: flat.totalKeys,
      }));
  });
}

function intervalMsOf(config: CoverageBelowConfig): number {
  const seconds = Math.min(
    Math.max(
      config.intervalSeconds ?? DEFAULT_INTERVAL_SECONDS,
      MIN_INTERVAL_SECONDS,
    ),
    MAX_INTERVAL_SECONDS,
  );
  return seconds * 1000;
}

/**
 * Polls the coverage of the watched languages and emits when one goes from at
 * least the threshold to below it. The first poll seeds the baseline without
 * emitting (unless `fireOnStart`); a language gone is forgotten and starts a
 * new baseline when it comes back. A failing poll never stops the interval.
 */
export const coverageBelowTrigger: TriggerType<
  CoverageBelowConfig,
  CoverageBelowPayload,
  CoverageHandle
> = {
  id: ID,
  name: texts.name,
  description: texts.description,
  icon: "i-ph-chart-line-down",
  cluster: "singleton",
  configSchema: objectSchema({
    workspace: { ...WORKSPACE_PORT, description: texts.hint("workspace") },
    locale: { ...LOCALE_PORT, description: texts.hint("locale") },
    threshold: {
      type: "integer",
      minimum: 1,
      maximum: 100,
      default: DEFAULT_THRESHOLD,
      description: texts.hint("threshold"),
    },
    intervalSeconds: {
      type: "integer",
      minimum: MIN_INTERVAL_SECONDS,
      maximum: MAX_INTERVAL_SECONDS,
      default: DEFAULT_INTERVAL_SECONDS,
      description: "$dms_lang.automation.hints.intervalSeconds",
    },
    fireOnStart: {
      type: "boolean",
      default: false,
      description: texts.hint("fireOnStart"),
    },
  }),
  outputSchema: objectSchema(
    {
      deliveryId: { type: "string" },
      workspace: { type: "string" },
      workspaceKind: { type: "string", enum: ["default", "modules", "added"] },
      locale: { type: "string" },
      coverage: { type: "number" },
      previousCoverage: { type: "number" },
      threshold: { type: "number" },
      missing: { type: "number" },
      totalKeys: { type: "number" },
      at: { type: "string", format: "date-time" },
    },
    [
      "deliveryId",
      "workspace",
      "workspaceKind",
      "locale",
      "coverage",
      "threshold",
      "missing",
      "totalKeys",
      "at",
    ],
  ),
  async activate(config, emit) {
    const threshold = config.threshold ?? DEFAULT_THRESHOLD;
    const previous = new Map<string, number>();
    let seeded = false;
    let stopped = false;
    let lastFailure: string | undefined;
    const fire = (reading: Reading, at: string, previousCoverage?: number) => {
      const payload: CoverageBelowPayload = {
        deliveryId: `${reading.workspace}:${reading.locale}:${threshold}:${at}`,
        workspace: reading.workspace,
        workspaceKind: workspaceKind(reading.workspace),
        locale: reading.locale,
        coverage: reading.coverage,
        threshold,
        missing: reading.missing,
        totalKeys: reading.totalKeys,
        at,
      };
      if (previousCoverage !== undefined)
        payload.previousCoverage = previousCoverage;
      emit(payload);
    };
    const poll = () => {
      if (stopped) return;
      try {
        const at = new Date().toISOString();
        const seen = new Set<string>();
        for (const reading of readingsOf(config)) {
          const id = `${reading.workspace}|${reading.locale}`;
          seen.add(id);
          const before = previous.get(id);
          previous.set(id, reading.coverage);
          if (reading.coverage >= threshold) continue;
          if (!seeded && config.fireOnStart === true) fire(reading, at);
          else if (seeded && before !== undefined && before >= threshold)
            fire(reading, at, before);
        }
        for (const id of previous.keys())
          if (!seen.has(id)) previous.delete(id);
        seeded = true;
        lastFailure = undefined;
      } catch (error) {
        previous.clear();
        const message = error instanceof Error ? error.message : String(error);
        if (message !== lastFailure)
          Logging.Error("[dms-lang] coverage-below poll failed:", error);
        lastFailure = message;
      }
    };
    poll();
    const timer = setInterval(poll, intervalMsOf(config));
    return {
      poll,
      stop() {
        stopped = true;
        clearInterval(timer);
      },
    };
  },
  async deactivate(handle) {
    handle.stop();
  },
};
