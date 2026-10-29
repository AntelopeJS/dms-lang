import { readFileSync } from "node:fs";

/** The message of `key` (`a.b.c`) in the frontend's locale file `file`. */
export function localeMessage(file, key) {
  const messages = JSON.parse(
    readFileSync(
      new URL(`../../frontend-vue/i18n/locales/${file}`, import.meta.url),
      "utf8",
    ),
  );
  return key.split(".").reduce((node, name) => node?.[name], messages);
}
