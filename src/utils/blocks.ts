import type { KeyValueListItem } from "@antelopejs/interface-dms/base/key-value-list";
import type { StatGroupItem } from "@antelopejs/interface-dms/base/stat-group";
import type {
  BlockText,
  ComposedText,
  Tone,
} from "@antelopejs/interface-dms/base/types";
import { listAllWorkspaces, resolveWorkspaceId } from "./catalog";
import { coveragePercent } from "./coverage";
import { percentParam } from "./languages";
import { dropsPlaceholder } from "./placeholders";
import { type FlatResult, isRowMissing, resolveFlat } from "./resolve";
import {
  countTranslated,
  sumMissing,
  targetCoverage,
  targetLocales,
} from "./summary";
import type { WorkspaceSummary } from "./workspaces";

const TEXTS = "dms_lang";
const NAMESPACE_SEPARATOR = ".";
const WORKSPACES_FOLDER = "i18n-workspaces";
const HIGH_COVERAGE = 90;
const MID_COVERAGE = 60;
const NO_VALUE = "—";

export interface BlockItems<T> {
  items: T[];
}

function counted(key: string, value: number): ComposedText {
  return { key: `${TEXTS}.${key}`, params: { n: { type: "count", value } } };
}

function percent(value: number): ComposedText {
  return {
    key: `${TEXTS}.common.value`,
    params: { value: percentParam(value) },
  };
}

/** A number written in the reader's format ("2,439"). */
function amount(value: number): ComposedText {
  return {
    key: `${TEXTS}.common.value`,
    params: { value: { type: "number", value } },
  };
}

function namespaceCount(flat: FlatResult): number {
  return new Set(flat.rows.map((row) => row.key.split(NAMESPACE_SEPARATOR)[0]))
    .size;
}

/** Nothing to translate reads neutral, not as a success. */
function missingTone(missing: number, hasWork: boolean): Tone {
  if (!hasWork) return "neutral";
  return missing > 0 ? "warning" : "success";
}

/** How many namespaces the keys sit in, and next to it how many have no base text: the translators have nothing to start from. */
function keysDetail(
  flat: FlatResult,
): Pick<StatGroupItem, "detail" | "detailTone"> {
  const namespaces = counted("kpis.keys_detail", namespaceCount(flat));
  if (!flat.baseMissing) return { detail: namespaces };
  return {
    detail: {
      key: `${TEXTS}.kpis.keys_detail_base_missing`,
      params: {
        namespaces,
        missing: counted("kpis.keys_base_missing", flat.baseMissing),
      },
    },
    detailTone: "warning",
  };
}

/** The four headline figures of a workspace (Overview). */
export function workspaceKpis(workspace: string): BlockItems<StatGroupItem> {
  const flat = resolveFlat(resolveWorkspaceId(workspace));
  const targets = targetLocales(flat).length;
  const missing = sumMissing(flat);
  const coverage = targetCoverage(flat);
  return {
    items: [
      {
        id: "languages",
        icon: "i-ph-globe",
        tone: "primary",
        eyebrow: `$${TEXTS}.kpis.languages`,
        value: flat.locales.length,
        detail: counted("kpis.languages_detail", targets),
      },
      {
        id: "keys",
        icon: "i-ph-key",
        tone: "neutral",
        eyebrow: `$${TEXTS}.kpis.keys`,
        value: flat.totalKeys,
        ...keysDetail(flat),
      },
      {
        id: "missing",
        icon: "i-ph-warning",
        tone: missingTone(missing, coverage !== undefined),
        eyebrow: `$${TEXTS}.kpis.missing`,
        value: missing,
        detail: counted("kpis.missing_detail", targets),
      },
      {
        id: "coverage",
        icon: "i-ph-chart-bar",
        tone: "primary",
        eyebrow: `$${TEXTS}.kpis.coverage`,
        value: coverage === undefined ? NO_VALUE : percent(coverage),
        detail: `$${TEXTS}.kpis.coverage_detail`,
      },
    ],
  };
}

function folderOf(summary: WorkspaceSummary): BlockText {
  return summary.kind === "added"
    ? `${WORKSPACES_FOLDER}/${summary.id}`
    : { key: `${TEXTS}.workspace_kinds.${summary.kind}.folder` };
}

function detailItems(summary: WorkspaceSummary): KeyValueListItem[] {
  const items: KeyValueListItem[] = [];
  if (summary.description) {
    items.push({
      id: "description",
      label: `$${TEXTS}.workspace_details.description_label`,
      value: summary.description,
    });
  }
  if (summary.type) {
    items.push({
      id: "type",
      label: `$${TEXTS}.workspace_details.type_label`,
      value: `$${TEXTS}.workspace_types.${summary.type}`,
    });
  }
  return items;
}

/** Description, kind, size and folder of a workspace (workspace settings). */
export function workspaceAbout(
  workspace: string,
): BlockItems<KeyValueListItem> {
  const id = resolveWorkspaceId(workspace);
  const summary = listAllWorkspaces().find((entry) => entry.id === id);
  if (!summary) return { items: [] };
  const flat = resolveFlat(id);
  return {
    items: [
      ...detailItems(summary),
      {
        id: "kind",
        label: `$${TEXTS}.about.kind`,
        value: `$${TEXTS}.workspace_kinds.${summary.kind}.kind`,
      },
      {
        id: "editable",
        label: `$${TEXTS}.about.editable`,
        value: `$${TEXTS}.about.${summary.editable ? "yes" : "no"}`,
        tone: summary.editable ? "success" : "warning",
      },
      {
        id: "keys",
        label: `$${TEXTS}.about.keys`,
        value: amount(flat.totalKeys),
      },
      {
        id: "strings",
        label: `$${TEXTS}.about.strings`,
        value: amount(countTranslated(flat)),
      },
      {
        id: "folder",
        label: `$${TEXTS}.about.folder`,
        value: folderOf(summary),
        type: "mono",
      },
    ],
  };
}

function coverageTone(coverage: number): Tone {
  if (coverage >= HIGH_COVERAGE) return "success";
  if (coverage >= MID_COVERAGE) return "warning";
  return "error";
}

function countIssues(flat: FlatResult, locale: string): number {
  if (locale === flat.defaultLocale) return 0;
  return flat.rows.filter((row) =>
    dropsPlaceholder(row.values[flat.defaultLocale], row.values[locale]),
  ).length;
}

/** Translated, missing and placeholder issues of one language (Language page). */
export function localeStats(
  workspace: string,
  locale: string,
): BlockItems<StatGroupItem> {
  const flat = resolveFlat(resolveWorkspaceId(workspace));
  if (!flat.locales.includes(locale)) return { items: [] };
  const missing = flat.rows.filter((row) => isRowMissing(row, locale)).length;
  const translated = flat.rows.length - missing;
  const coverage = coveragePercent(translated, flat.rows.length);
  const issues = countIssues(flat, locale);
  return {
    items: [
      {
        id: "coverage",
        icon: "i-ph-chart-donut",
        tone: coverageTone(coverage),
        eyebrow: `$${TEXTS}.progress.coverage`,
        value: percent(coverage),
        detail: counted("progress.coverage_detail", flat.rows.length),
      },
      {
        id: "translated",
        icon: "i-ph-check-circle",
        tone: "success",
        eyebrow: `$${TEXTS}.progress.translated`,
        value: translated,
      },
      {
        id: "missing",
        icon: "i-ph-warning",
        tone: missingTone(missing, flat.rows.length > 0),
        eyebrow: `$${TEXTS}.progress.missing`,
        value: missing,
      },
      {
        id: "issues",
        icon: "i-ph-brackets-curly",
        tone: issues ? "error" : "success",
        eyebrow: `$${TEXTS}.progress.issues`,
        value: issues,
      },
    ],
  };
}
