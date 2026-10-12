import { serializeConfirmDialog } from "@antelopejs/interface-dms/base/confirm-dialog";
import type {
  ConfirmDialog,
  ConfirmDialogImpact,
  ConfirmDialogSecondaryAction,
  ConfirmDialogSerialized,
} from "@antelopejs/interface-dms/base/types";
import { findWorkspace } from "./catalog";
import { LANG_TEXTS, PUBLIC_PATH } from "./constants";
import { fail } from "./errors";
import { nativeName } from "./languages";
import { findLocale } from "./locale-codes";
import { publicLocaleUrl } from "./public-url";
import { type FlatResult, isRowMissing, resolveFlat } from "./resolve";

const LISTED_KEYS = 20;
const SHOWN_KEYS = 5;
const LANGUAGE_FILE = "{code}.json";

/** Saves the file of the language before it goes, from the public route. */
const DOWNLOAD_LANGUAGE: ConfirmDialogSecondaryAction = {
  label: `$${LANG_TEXTS}.language_remove.download`,
  icon: "i-ph-download-simple",
  target: {
    type: "download",
    url: `${PUBLIC_PATH}/{workspace}/${LANGUAGE_FILE}`,
    filename: LANGUAGE_FILE,
  },
};

/** The dialog confirming a new base language, with what a caller wording its own dialog needs. */
export interface BaseConfirm extends ConfirmDialogSerialized {
  missing: number;
  keys: string[];
}

/** The workspace's own code for `code`, matched on its canonical form; 404 when it has no such language. */
function knownLocale(flat: FlatResult, code: string): string {
  const found = findLocale(flat.locales, code);
  if (found === undefined) fail("unknown_locale", { locale: code });
  return found;
}

function countStrings(flat: FlatResult, code: string): number {
  return flat.totalKeys - (flat.localeMissing[code] ?? 0);
}

/**
 * The dialog confirming the removal of a language, worded by the server: the
 * code to type and a button saving its file first, only when texts would be
 * lost.
 */
export function removalConfirm(
  workspace: string,
  requested: string,
  origin: string,
): ConfirmDialogSerialized {
  const summary = findWorkspace(workspace);
  const flat = resolveFlat(summary.id);
  const code = knownLocale(flat, requested);
  const strings = countStrings(flat, code);
  const impact: ConfirmDialogImpact[] = [
    { icon: "i-ph-file", label: `$${LANG_TEXTS}.language_remove.file` },
  ];
  const dialog: ConfirmDialog = {
    title: `$${LANG_TEXTS}.language_remove.title`,
    description: `$${LANG_TEXTS}.language_remove.description`,
    params: {
      name: nativeName(code, flat.locales),
      workspace: summary.id,
      code,
      url: publicLocaleUrl(origin, summary, code) ?? "",
      file: `${code}.json`,
    },
    color: "error",
    confirmLabel: `$${LANG_TEXTS}.language_remove.submit`,
    impact,
  };
  if (!strings) return serializeConfirmDialog(dialog);
  dialog.description = `$${LANG_TEXTS}.language_remove.description_backup`;
  dialog.confirmText = code;
  dialog.secondaryAction = DOWNLOAD_LANGUAGE;
  impact.push({
    icon: "i-ph-text-aa",
    label: `$${LANG_TEXTS}.language_remove.strings`,
    count: strings,
  });
  return serializeConfirmDialog(dialog);
}

function keyImpact(keys: string[], missing: number): ConfirmDialogImpact[] {
  const shown = keys
    .slice(0, SHOWN_KEYS)
    .map((key) => ({ icon: "i-ph-key", label: key }));
  const rest = missing - shown.length;
  return rest > 0
    ? [
        ...shown,
        {
          icon: "i-ph-dots-three",
          label: `$${LANG_TEXTS}.language_base.more_keys`,
          count: rest,
        },
      ]
    : shown;
}

/**
 * The dialog confirming a new base language: the keys that have no text in
 * it (then missing in the base), with their count and the first of them
 * (`missing`, `keys`) for a caller that words its own dialog.
 */
export function baseConfirm(workspace: string, requested: string): BaseConfirm {
  const flat = resolveFlat(findWorkspace(workspace).id);
  const code = knownLocale(flat, requested);
  const missingRows = flat.rows.filter((row) => isRowMissing(row, code));
  const keys = missingRows.slice(0, LISTED_KEYS).map((row) => row.key);
  const missing = missingRows.length;
  const dialog = serializeConfirmDialog({
    title: `$${LANG_TEXTS}.language_base.confirm_title`,
    description: missing
      ? `$${LANG_TEXTS}.language_base.confirm_missing`
      : `$${LANG_TEXTS}.language_base.confirm_complete`,
    params: { name: nativeName(code, flat.locales), count: missing },
    icon: "i-ph-star",
    color: "primary",
    confirmLabel: `$${LANG_TEXTS}.language_base.confirm_submit`,
    impact: keyImpact(keys, missing),
  });
  return { ...dialog, missing, keys };
}
