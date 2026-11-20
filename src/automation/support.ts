import type {
  ActionType,
  DataNodeType,
  ExecutionCtx,
  JsonObject,
  JsonSchema,
} from "@antelopejs/interface-dms-automation";
import { HTTPResult } from "@antelopejs/interface-api";
import type { ZodType, ZodTypeDef } from "zod";
import type { AutomationWriter, WriteOptions } from "../services/writer";
import {
  assertEditable,
  DEFAULT_WORKSPACE,
  MODULES_WORKSPACE,
  normalizeWorkspaceId,
} from "../utils/workspaces";
import { stepError } from "./errors";

/**
 * The automation builder runs node names, descriptions and field texts
 * through `processI18n`: a `$`-prefixed text is a key of the Lang locales.
 */
const AUTOMATION_TEXTS = "$dms_lang.automation";

export type NodeKind = "triggers" | "actions" | "data";

/** The key segment of a node id: `lang.set-translation` is `setTranslation`. */
function segmentOf(id: string): string {
  return id
    .replace(/^lang\./, "")
    .replace(/-(\w)/g, (_match, letter: string) => letter.toUpperCase());
}

/** The `$` keys of a node's texts. */
export interface NodeTexts {
  name: string;
  description: string;
  hint(field: string): string;
}

export function nodeTexts(kind: NodeKind, id: string): NodeTexts {
  const base = `${AUTOMATION_TEXTS}.${kind}.${segmentOf(id)}`;
  return {
    name: `${base}.name`,
    description: `${base}.description`,
    hint: (field) => `${base}.fields.${field}`,
  };
}

/** An object schema whose properties are titled by their shared `$` field label. */
export function objectSchema(
  properties: Record<string, JsonSchema>,
  required: string[] = [],
): JsonSchema {
  const titled = Object.fromEntries(
    Object.entries(properties).map(([name, schema]) => [
      name,
      { title: `${AUTOMATION_TEXTS}.fields.${name}`, ...schema },
    ]),
  );
  return { type: "object", properties: titled, required };
}

/** Checks a node's input, failing the step with the node id and each refused field. */
function parseInput<T>(
  nodeId: string,
  schema: ZodType<T, ZodTypeDef, unknown>,
  value: JsonObject | undefined,
): T {
  const parsed = schema.safeParse(value ?? {});
  if (parsed.success) return parsed.data;
  const problems = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
    .join("; ");
  throw new Error(`${nodeId}: invalid input (${problems})`);
}

function writerOf(ctx: ExecutionCtx): AutomationWriter {
  return {
    kind: "automation",
    procedureId: ctx.procedureId,
    runId: ctx.runId,
    nodeId: ctx.nodeId,
  };
}

async function asStep<T>(
  nodeId: string,
  work: () => T | Promise<T>,
): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw stepError(
      error instanceof Error || error instanceof HTTPResult
        ? error
        : new Error(String(error)),
      nodeId,
    );
  }
}

interface NodeIdentity {
  id: string;
  kind: NodeKind;
  icon: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
}

function identity(node: NodeIdentity) {
  const texts = nodeTexts(node.kind, node.id);
  return {
    id: node.id,
    name: texts.name,
    description: texts.description,
    icon: node.icon,
    inputSchema: node.inputSchema,
    outputSchema: node.outputSchema,
  };
}

export interface WriteDefinition<I, O extends JsonObject> extends Omit<
  NodeIdentity,
  "kind"
> {
  input: ZodType<I, ZodTypeDef, unknown>;
  run(
    input: I,
    writer: AutomationWriter,
    options: WriteOptions,
  ): O | Promise<O>;
}

/**
 * A write action: `dryRun` runs the same checks on the same code path and
 * writes nothing, so a test run fails where the real run would.
 */
export function writeAction<I, O extends JsonObject>(
  definition: WriteDefinition<I, O>,
): ActionType<JsonObject, O> {
  const run = (raw: JsonObject, ctx: ExecutionCtx, dryRun: boolean) =>
    asStep(definition.id, () => {
      assertEditable();
      return definition.run(
        parseInput(definition.id, definition.input, raw),
        writerOf(ctx),
        { dryRun },
      );
    });
  return {
    ...identity({ ...definition, kind: "actions" }),
    sideEffects: true,
    dryRun: (raw, ctx) => run(raw, ctx, true),
    execute: (raw, ctx) => run(raw, ctx, false),
  };
}

export interface ReadDefinition<I, O extends JsonObject> extends Omit<
  NodeIdentity,
  "kind"
> {
  input: ZodType<I, ZodTypeDef, unknown>;
  run(input: I): O | Promise<O>;
}

/** A read action: no side effect, runs as is in a test run. */
export function readAction<I, O extends JsonObject>(
  definition: ReadDefinition<I, O>,
): ActionType<JsonObject, O> {
  return {
    ...identity({ ...definition, kind: "actions" }),
    sideEffects: false,
    execute: (raw) =>
      asStep(definition.id, () =>
        definition.run(parseInput(definition.id, definition.input, raw)),
      ),
  };
}

export interface DataDefinition<I, O extends JsonObject> extends Omit<
  NodeIdentity,
  "kind"
> {
  input: ZodType<I, ZodTypeDef, unknown>;
  evaluate(input: I): O;
}

/** A data node: a pure computation on its wired inputs, labelled "Text" in the builder. */
export function dataNode<I, O extends JsonObject>(
  definition: DataDefinition<I, O>,
): DataNodeType<JsonObject, O> {
  return {
    ...identity({ ...definition, kind: "data" }),
    category: "string",
    evaluate: (raw) =>
      definition.evaluate(parseInput(definition.id, definition.input, raw)),
  };
}

/**
 * Refuses the project files and the modules for a node that works on added
 * translation workspaces only, before the utility answers a confusing 404.
 */
export function assertAdded(nodeId: string, workspace: string): void {
  const id = normalizeWorkspaceId(workspace);
  if (id !== DEFAULT_WORKSPACE && id !== MODULES_WORKSPACE) return;
  throw new Error(
    `${nodeId} works on added translation workspaces only; "${id}" is the ${id === DEFAULT_WORKSPACE ? "project files" : "modules"} translation workspace (added_only)`,
  );
}
