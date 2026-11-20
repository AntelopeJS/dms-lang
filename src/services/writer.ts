import { randomUUID } from "node:crypto";
import type { User } from "@antelopejs/interface-dms/auth/db";
import {
  baseTextChannel,
  type ChangeOrigin,
  changeChannel,
  completionChannel,
  type LangChange,
  type LangOperation,
} from "../automation/events";
import { announce } from "../utils/announce";
import type { BaseTextChange } from "../utils/keys";
import {
  type FlatCounts,
  flatCounts,
  resolveFlat,
  resolveRow,
} from "../utils/resolve";
import { workspaceKind } from "../utils/workspaces";

/** A dashboard user writing from a tab of the dashboard. */
export interface UserWriter {
  kind: "user";
  actor: User;
  session?: string;
}

/** A procedure step writing. */
export interface AutomationWriter {
  kind: "automation";
  procedureId: string;
  runId: string;
  nodeId: string;
}

/** Who writes: what a change is announced and reported with. */
export type Writer = UserWriter | AutomationWriter;

export interface WriteOptions {
  /** Runs every check and writes nothing: no file, no announcement, no event. */
  dryRun?: boolean;
}

export function originOf(writer: Writer): ChangeOrigin {
  return writer.kind === "user"
    ? { origin: "user", actorId: writer.actor._id }
    : {
        origin: "automation",
        originProcedureId: writer.procedureId,
        originRunId: writer.runId,
      };
}

/** Tells the open pages a workspace changed (only its `keys` when given). */
export function announceWrite(
  writer: Writer,
  workspace: string,
  keys?: string[],
): void {
  if (writer.kind === "user")
    announce({ actor: writer.actor, session: writer.session, workspace, keys });
  else announce({ workspace, keys });
}

/** What a write changed, for its change record. */
export interface ChangeDetails {
  keys?: string[];
  previousKey?: string;
  previousWorkspace?: string;
  locales?: string[];
}

/** The figures a completion is detected against, read only while a trigger listens for one. */
export function countsBeforeWrite(
  workspace: string,
  options: WriteOptions,
): FlatCounts | undefined {
  if (options.dryRun || !completionChannel.active) return undefined;
  return flatCounts(workspace);
}

function emitCompletions(change: LangChange, before?: FlatCounts): void {
  if (before === undefined || !completionChannel.active) return;
  const after = resolveFlat(change.workspace);
  if (after.totalKeys === 0) return;
  for (const locale of after.locales) {
    if (locale === after.defaultLocale) continue;
    const missing = before.localeMissing[locale];
    if (missing === undefined || missing === 0) continue;
    if (after.localeMissing[locale] !== 0) continue;
    completionChannel.emit({
      change,
      locale,
      baseLocale: after.defaultLocale,
      totalKeys: after.totalKeys,
    });
  }
}

/** Reports a successful write to the triggers: its change record, then the languages it completed. */
export function recordChange(
  writer: Writer,
  workspace: string,
  operation: LangOperation,
  details: ChangeDetails = {},
  before?: FlatCounts,
): LangChange {
  const kind = workspaceKind(workspace) === "default" ? "default" : "added";
  const change: LangChange = {
    writeId: randomUUID(),
    workspace,
    workspaceKind: kind,
    operation,
    keys: details.keys ?? [],
    locales: details.locales ?? [],
    origin: originOf(writer),
    at: new Date().toISOString(),
  };
  if (details.previousKey !== undefined)
    change.previousKey = details.previousKey;
  if (details.previousWorkspace !== undefined)
    change.previousWorkspace = details.previousWorkspace;
  changeChannel.emit(change);
  emitCompletions(change, before);
  return change;
}

function staleLocales(workspace: string, key: string): string[] {
  const flat = resolveFlat(workspace);
  const row = resolveRow(workspace, key);
  if (row === undefined) return [];
  if (workspaceKind(workspace) === "added") return row.outdated ?? [];
  return flat.locales.filter(
    (locale) =>
      locale !== flat.defaultLocale &&
      row.values[locale] !== undefined &&
      row.values[locale] !== null,
  );
}

/** Reports the change of a key's base text that a write made. */
export function recordBaseChange(
  change: LangChange,
  key: string,
  baseChange: BaseTextChange | undefined,
): void {
  if (baseChange === undefined || !baseTextChannel.active) return;
  baseTextChannel.emit({
    change,
    key,
    baseLocale: resolveFlat(change.workspace).defaultLocale,
    previousText: baseChange.previousText,
    text: baseChange.text,
    staleLocales: staleLocales(change.workspace, key),
  });
}
