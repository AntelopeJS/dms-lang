import { FALLBACK_LOCALE, listAllWorkspaces } from "./catalog";
import { dropsPlaceholder } from "./placeholders";
import { type FlatResult, isRowMissing, resolveFlat } from "./resolve";
import {
  averageCoverage,
  countTranslated,
  sumMissing,
  targetLocales,
} from "./summary";

const TEXTS = "dms_lang";
const FULL_COVERAGE = 100;
const PERCENT = 100;
const NAMESPACE_SEPARATOR = ".";
const WORKSPACES_FOLDER = "i18n-workspaces";
const HIGH_COVERAGE = 90;
const MID_COVERAGE = 60;

type Tone = "neutral" | "primary" | "success" | "warning" | "error";

interface CountParam {
  type: "count";
  value: number;
}

interface NumberParam {
  type: "number";
  value: number;
  format?: "decimal" | "percent" | "compact";
}

interface ComposedText {
  key: string;
  params?: Record<string, CountParam | NumberParam | string>;
}

type BlockText = string | ComposedText;

export interface StatItem {
  id: string;
  icon: string;
  tone: Tone;
  eyebrow: BlockText;
  value: BlockText | number;
  detail?: BlockText;
  detailTone?: Tone;
}

export interface KeyValueItem {
  id: string;
  label: BlockText;
  value: BlockText | number;
  type?: "text" | "mono";
  tone?: Tone;
}

export interface BlockItems<T> {
  items: T[];
}

function counted(key: string, value: number): ComposedText {
  return { key: `${TEXTS}.${key}`, params: { n: { type: "count", value } } };
}

function percent(value: number): ComposedText {
  return {
    key: `${TEXTS}.common.value`,
    params: {
      value: { type: "number", value: value / PERCENT, format: "percent" },
    },
  };
}

function namespaceCount(flat: FlatResult): number {
  return new Set(flat.rows.map((row) => row.key.split(NAMESPACE_SEPARATOR)[0]))
    .size;
}

function missingTone(missing: number): Tone {
  return missing > 0 ? "warning" : "success";
}

/** The four headline figures of a workspace (Overview). */
export function workspaceKpis(workspace: string): BlockItems<StatItem> {
  const flat = resolveFlat(workspace, FALLBACK_LOCALE);
  const targets = targetLocales(flat).length;
  const missing = sumMissing(flat);
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
        detail: counted("kpis.keys_detail", namespaceCount(flat)),
      },
      {
        id: "missing",
        icon: "i-ph-warning",
        tone: missingTone(missing),
        eyebrow: `$${TEXTS}.kpis.missing`,
        value: missing,
        detail: counted("kpis.missing_detail", targets),
      },
      {
        id: "coverage",
        icon: "i-ph-chart-bar",
        tone: "primary",
        eyebrow: `$${TEXTS}.kpis.coverage`,
        value: flat.totalKeys ? percent(averageCoverage(flat)) : "—",
        detail: `$${TEXTS}.kpis.coverage_detail`,
      },
    ],
  };
}

function folderOf(workspace: string, kind: string): string {
  return kind === "added"
    ? `${WORKSPACES_FOLDER}/${workspace}`
    : `$${TEXTS}.workspace_kinds.${kind}.folder`;
}

/** Kind, size and folder of a workspace (workspace settings). */
export function workspaceAbout(workspace: string): BlockItems<KeyValueItem> {
  const summary = listAllWorkspaces().find((entry) => entry.id === workspace);
  if (!summary) return { items: [] };
  const flat = resolveFlat(workspace, FALLBACK_LOCALE);
  return {
    items: [
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
        value: flat.totalKeys,
        type: "mono",
      },
      {
        id: "strings",
        label: `$${TEXTS}.about.strings`,
        value: countTranslated(flat),
        type: "mono",
      },
      {
        id: "folder",
        label: `$${TEXTS}.about.folder`,
        value: folderOf(workspace, summary.kind),
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

/** Translated, missing and placeholder issues of one language (Language page). */
export function localeStats(
  workspace: string,
  locale: string,
): BlockItems<StatItem> {
  const flat = resolveFlat(workspace, FALLBACK_LOCALE);
  if (!flat.locales.includes(locale)) return { items: [] };
  const missing = flat.rows.filter((row) => isRowMissing(row, locale)).length;
  const translated = flat.rows.length - missing;
  const coverage = flat.rows.length
    ? Math.round((translated / flat.rows.length) * PERCENT)
    : FULL_COVERAGE;
  const issues =
    locale === flat.defaultLocale
      ? 0
      : flat.rows.filter((row) =>
          dropsPlaceholder(row.values[flat.defaultLocale], row.values[locale]),
        ).length;
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
        tone: missingTone(missing),
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
