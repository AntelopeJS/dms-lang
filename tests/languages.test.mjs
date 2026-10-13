import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canonicalLocale,
  lastSubtag,
  searchLanguages,
  sharesLanguage,
  textDirection,
  typedLocaleCode,
} from "../frontend-vue/app/utils/languages.ts";

const candidates = [
  { code: "en-GB", names: ["English (United Kingdom)", "British English"] },
  { code: "en", names: ["English"] },
  { code: "fr", names: ["Français", "French"] },
  { code: "fr-FR", names: ["Français (France)", "French (France)"] },
  { code: "sv", names: ["Svenska", "Swedish"] },
  { code: "it", names: ["Italiano", "Italian"] },
  { code: "pt-BR", names: ["Português (Brasil)", "Portuguese (Brazil)"] },
];

const codesOf = (list) => list.map((candidate) => candidate.code);

test("a code is written in its canonical BCP 47 form", () => {
  assert.equal(canonicalLocale("fr_FR"), "fr-FR");
  assert.equal(canonicalLocale("zh-hant-tw"), "zh-Hant-TW");
  assert.equal(canonicalLocale("de-CH-1996"), "de-CH-1996");
  assert.equal(canonicalLocale("i-klingon"), null);
});

test("a search spells a code only with a real language subtag", () => {
  assert.equal(typedLocaleCode("es-419"), "es-419");
  assert.equal(typedLocaleCode("FR_ca"), "fr-CA");
  assert.equal(typedLocaleCode("french"), null);
  assert.equal(typedLocaleCode("a"), null);
});

test("the exact code comes first and a search inside a word finds nothing", () => {
  assert.deepEqual(codesOf(searchLanguages(candidates, "it")), ["it"]);
  assert.deepEqual(codesOf(searchLanguages(candidates, "en")), ["en", "en-GB"]);
});

test("languages are found by code, native name and English name", () => {
  assert.deepEqual(codesOf(searchLanguages(candidates, "pt-br")), ["pt-BR"]);
  assert.deepEqual(codesOf(searchLanguages(candidates, "french")), [
    "fr",
    "fr-FR",
  ]);
  assert.deepEqual(codesOf(searchLanguages(candidates, "brazil")), ["pt-BR"]);
  assert.deepEqual(codesOf(searchLanguages(candidates, "fr_FR")), ["fr-FR"]);
});

const regional = [
  {
    code: "en-GB",
    names: ["English (United Kingdom)", "Anglais (Royaume-Uni)"],
  },
  { code: "en", names: ["English", "Anglais"] },
  { code: "pt-BR", names: ["Português (Brasil)", "Portuguese (Brazil)"] },
  { code: "fr-CH", names: ["Français (Suisse)", "French (Switzerland)"] },
  { code: "de-CH", names: ["Deutsch (Schweiz)", "Allemand (Suisse)"] },
  { code: "fr", names: ["Français", "French"] },
  { code: "uk", names: ["Українська", "Ukrainian", "Ukrainien"] },
];

test("a search of several words finds names with each word, region included", () => {
  assert.deepEqual(codesOf(searchLanguages(regional, "United Kingdom")), [
    "en-GB",
  ]);
  assert.deepEqual(codesOf(searchLanguages(regional, "royaume-uni")), [
    "en-GB",
  ]);
  assert.deepEqual(codesOf(searchLanguages(regional, "kingdom english")), [
    "en-GB",
  ]);
  assert.deepEqual(codesOf(searchLanguages(regional, "Brasil")), ["pt-BR"]);
  assert.deepEqual(codesOf(searchLanguages(regional, "suisse")), [
    "fr-CH",
    "de-CH",
  ]);
  assert.deepEqual(codesOf(searchLanguages(regional, "united states")), []);
});

test("accents and case are ignored", () => {
  assert.deepEqual(codesOf(searchLanguages(regional, "FRANCAIS")), [
    "fr-CH",
    "fr",
  ]);
  assert.deepEqual(codesOf(searchLanguages(regional, "portugues bra")), [
    "pt-BR",
  ]);
});

test("the exact code still comes before names", () => {
  assert.deepEqual(codesOf(searchLanguages(regional, "uk")), ["uk"]);
  assert.deepEqual(codesOf(searchLanguages(regional, "fr")), ["fr", "fr-CH"]);
});

test("a search of separators only finds nothing", () => {
  assert.deepEqual(codesOf(searchLanguages(regional, "( - )")), []);
});

test("an empty search keeps every language in order", () => {
  assert.deepEqual(
    codesOf(searchLanguages(candidates, " ")),
    codesOf(candidates),
  );
});

test("variants of one language are told apart", () => {
  assert.equal(sharesLanguage("pt-BR", ["pt-BR", "pt-PT", "en"]), true);
  assert.equal(sharesLanguage("en", ["pt-BR", "pt-PT", "en"]), false);
  assert.equal(lastSubtag("zh-Hant-TW"), "TW");
});

test("Arabic, Hebrew and Persian are written right to left, in any region", () => {
  assert.equal(textDirection("ar"), "rtl");
  assert.equal(textDirection("he-IL"), "rtl");
  assert.equal(textDirection("fa_IR"), "rtl");
  assert.equal(textDirection("fr"), "ltr");
  assert.equal(textDirection("en-GB"), "ltr");
});
