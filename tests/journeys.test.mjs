import assert from "node:assert/strict";
import { test } from "node:test";
import {
  config,
  features,
  journeysOf,
  playgroundExists,
} from "./helpers/journeys-suite.mjs";

void test("journeys config: the playground it names is an antelope project in this repository", () => {
  assert.ok(
    playgroundExists(),
    `${config.playground} holds no antelope.config.ts`,
  );
});

void test("journeys config: the smoke feature it names has a journey tagged @smoke", async () => {
  assert.ok(
    features().includes(config.smoke),
    `no e2e/journeys/${config.smoke}.mjs`,
  );
  const journeys = (await journeysOf(config.smoke)) ?? [];
  assert.ok(
    journeys.some((journey) => [journey.tag].flat().includes("@smoke")),
    `${config.smoke} has no @smoke journey`,
  );
});

void test("journeys: every feature exports journeys, and no two journeys share an id", async () => {
  const ids = [];
  for (const feature of features()) {
    const journeys = await journeysOf(feature);
    assert.ok(
      journeys,
      `e2e/journeys/${feature}.mjs exports no journeys with ids`,
    );
    ids.push(...journeys.map((journey) => journey.id));
  }
  assert.deepEqual(
    ids.filter((id, at) => ids.indexOf(id) !== at),
    [],
  );
});
