import { Logging } from "@antelopejs/interface-core/logging";

/** What a write through Lang did, as `lang.translations-changed` reports it. */
export const LANG_OPERATIONS = [
  "key-created",
  "key-updated",
  "key-renamed",
  "key-deleted",
  "override-removed",
  "reviewed",
  "language-added",
  "language-removed",
  "base-language-changed",
  "language-imported",
  "workspace-created",
  "workspace-imported",
  "workspace-updated",
  "workspace-renamed",
  "workspace-deleted",
] as const;

export type LangOperation = (typeof LANG_OPERATIONS)[number];

/** Who made a write: a dashboard user, or a procedure step. */
export interface ChangeOrigin {
  origin: "user" | "automation";
  originProcedureId?: string;
  originRunId?: string;
  actorId?: string;
}

/** One write to a translation workspace through Lang, after it succeeded. */
export interface LangChange {
  writeId: string;
  workspace: string;
  workspaceKind: "default" | "added";
  operation: LangOperation;
  keys: string[];
  previousKey?: string;
  previousWorkspace?: string;
  locales: string[];
  origin: ChangeOrigin;
  at: string;
}

/** A write that changed the effective base text of a key. */
export interface BaseTextEvent {
  change: LangChange;
  key: string;
  baseLocale: string;
  previousText: string;
  text: string;
  staleLocales: string[];
}

/** A target language a write left with a text for every key. */
export interface CompletionEvent {
  change: LangChange;
  locale: string;
  baseLocale: string;
  totalKeys: number;
}

type Listener<T> = (event: T) => void;

/** The listeners of one kind of event; a throwing listener never fails the write. */
export class LangChannel<T> {
  private readonly listeners = new Set<Listener<T>>();

  constructor(private readonly name: string) {}

  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  get active(): boolean {
    return this.listeners.size > 0;
  }

  emit(event: T): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        Logging.Error(`[dms-lang] ${this.name} listener failed:`, error);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const changeChannel = new LangChannel<LangChange>("change");
export const baseTextChannel = new LangChannel<BaseTextEvent>("base text");
export const completionChannel = new LangChannel<CompletionEvent>(
  "language completed",
);

/** Drops every trigger subscription (the module stops). */
export function clearLangChannels(): void {
  changeChannel.clear();
  baseTextChannel.clear();
  completionChannel.clear();
}
