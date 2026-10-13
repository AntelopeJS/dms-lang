import assert from "node:assert/strict";
import { test } from "node:test";
import {
  advancePass,
  completeKey,
  currentKey,
  goToIndex,
  pendingAfter,
  pendingKeys,
  previousKey,
  skipCurrent,
  startPass,
} from "../frontend-vue/app/utils/queuePass.ts";
import {
  draftGroups,
  draftIdOf,
  parseDraftId,
  settledDrafts,
  takeDrafts,
  withDraft,
} from "../frontend-vue/app/utils/queueDrafts.ts";

const KEYS = ["a", "b", "c", "d"];

function openAll() {
  return true;
}

function openOnly(...keys) {
  const open = new Set(keys);
  return (key) => open.has(key);
}

test("a pass starts on the key asked for, else on its first key", () => {
  assert.equal(currentKey(startPass(KEYS, "c", openAll)), "c");
  assert.equal(currentKey(startPass(KEYS, "zz", openAll)), "a");
  assert.equal(currentKey(startPass(KEYS, "", openAll)), "a");
});

test("a pass with nothing to do starts finished", () => {
  const pass = startPass(KEYS, "", openOnly());
  assert.equal(pass.isFinished, true);
  assert.equal(currentKey(pass), undefined);
  assert.equal(startPass([], "", openAll).isFinished, true);
});

test("advancing moves to the next key to do", () => {
  const { pass, step } = advancePass(startPass(KEYS, "a", openAll), openAll);
  assert.equal(step, "moved");
  assert.equal(currentKey(pass), "b");
  assert.deepEqual(pass.history, [0]);
});

test("advancing passes over keys no longer to do", () => {
  const isOpen = openOnly("a", "d");
  const { pass } = advancePass(startPass(KEYS, "a", isOpen), isOpen);
  assert.equal(currentKey(pass), "d");
});

test("a skipped key comes back once the others are done", () => {
  let pass = startPass(KEYS, "a", openAll);
  ({ pass } = skipCurrent(pass, openAll));
  assert.equal(pass.status.a, "skipped");
  for (const key of ["b", "c"]) {
    ({ pass } = completeKey(pass, key, true, openAll));
  }
  const move = completeKey(pass, "d", true, openAll);
  assert.equal(move.step, "wrapped");
  assert.equal(currentKey(move.pass), "a");
  assert.equal(pendingKeys(move.pass, openAll).join(), "a");
});

test("skipping the last key left stays on it", () => {
  let pass = startPass(KEYS, "a", openAll);
  for (const key of ["a", "b", "c"]) {
    ({ pass } = completeKey(pass, key, true, openAll));
  }
  const move = skipCurrent(pass, openAll);
  assert.equal(move.step, "last");
  assert.equal(currentKey(move.pass), "d");
  assert.equal(move.pass.status.d, "skipped");
});

test("saving the last key finishes the pass", () => {
  let pass = startPass(KEYS, "a", openAll);
  let step;
  for (const key of KEYS)
    ({ pass, step } = completeKey(pass, key, true, openAll));
  assert.equal(step, "finished");
  assert.equal(pass.isFinished, true);
  assert.equal(currentKey(pass), undefined);
  assert.deepEqual(pendingKeys(pass, openAll), []);
});

test("saving in place marks the key done without moving", () => {
  const pass = startPass(KEYS, "b", openAll);
  const change = completeKey(pass, "b", false, openAll);
  assert.equal(change.step, undefined);
  assert.equal(currentKey(change.pass), "b");
  assert.equal(change.pass.status.b, "done");
});

test("saving another key than the one shown does not move", () => {
  const pass = startPass(KEYS, "a", openAll);
  const change = completeKey(pass, "c", true, openAll);
  assert.equal(change.step, undefined);
  assert.equal(currentKey(change.pass), "a");
  assert.deepEqual(pendingAfter(change.pass, 0, openAll), [1, 3]);
});

test("previous walks back through the keys shown, a finished pass included", () => {
  let pass = startPass(KEYS, "a", openAll);
  for (const key of KEYS) ({ pass } = completeKey(pass, key, true, openAll));
  pass = previousKey(pass);
  assert.equal(pass.isFinished, false);
  assert.equal(currentKey(pass), "d");
  pass = previousKey(previousKey(pass));
  assert.equal(currentKey(pass), "b");
  pass = previousKey(previousKey(pass));
  assert.equal(currentKey(pass), "a");
  assert.equal(previousKey(pass), pass, "nothing before the first key");
});

test("going to a key remembers the one left, not a finished pass", () => {
  let pass = goToIndex(startPass(KEYS, "a", openAll), 2);
  assert.equal(currentKey(pass), "c");
  assert.deepEqual(pass.history, [0]);
  pass = { ...pass, isFinished: true };
  assert.deepEqual(goToIndex(pass, 1).history, [0]);
});

test("the keys after one go round to the start, without it", () => {
  const pass = startPass(KEYS, "c", openAll);
  assert.deepEqual(pendingAfter(pass, 2, openAll), [3, 0, 1]);
  assert.deepEqual(
    pendingAfter(startPass(["a"], "a", openAll), 0, openAll),
    [],
  );
});

test("draft ids keep keys holding the separator", () => {
  const id = { workspace: "web", locale: "fr", key: "a.b" };
  assert.deepEqual(parseDraftId(draftIdOf(id)), id);
});

test("a text back to the one it started on is no draft", () => {
  const id = draftIdOf({ workspace: "web", locale: "fr", key: "a" });
  const drafts = withDraft({}, id, { value: "Salut", start: null });
  assert.deepEqual(drafts[id], { value: "Salut", start: null });
  assert.deepEqual(withDraft(drafts, id, { value: "", start: null }), {});
  assert.deepEqual(
    withDraft({}, id, { value: "Bonjour", start: "Bonjour" }),
    {},
  );
});

test("a save drops the draft only when it is still the text sent", () => {
  const id = draftIdOf({ workspace: "web", locale: "fr", key: "a" });
  const sent = { typed: "Salut ", stored: "Salut " };
  const drafts = { [id]: { value: "Salut ", start: null } };
  assert.deepEqual(settledDrafts(drafts, id, sent), {});
  const typed = { [id]: { value: "Salut !", start: null } };
  assert.deepEqual(settledDrafts(typed, id, sent), {
    [id]: { value: "Salut !", start: "Salut " },
  });
  assert.deepEqual(settledDrafts({}, id, sent), {});
  const cleared = { [id]: { value: "  ", start: "Salut" } };
  assert.deepEqual(
    settledDrafts(cleared, id, { typed: "  ", stored: null }),
    {},
    "spaces sent as no text are no draft once saved",
  );
});

test("drafts group per workspace and language", () => {
  const drafts = Object.fromEntries(
    [
      ["web", "fr", "a"],
      ["web", "fr", "b"],
      ["web", "de", "a"],
      ["app", "fr", "a"],
    ].map(([workspace, locale, key]) => [
      draftIdOf({ workspace, locale, key }),
      { value: "x", start: null },
    ]),
  );
  assert.deepEqual(draftGroups(drafts), [
    { workspace: "web", locale: "fr", count: 2 },
    { workspace: "web", locale: "de", count: 1 },
    { workspace: "app", locale: "fr", count: 1 },
  ]);
});

test("orphan drafts are taken out with their text, the others kept", () => {
  const kept = draftIdOf({ workspace: "web", locale: "fr", key: "a" });
  const gone = draftIdOf({ workspace: "old", locale: "fr", key: "a" });
  const drafts = {
    [kept]: { value: "Salut", start: null },
    [gone]: { value: "Adieu", start: null },
  };
  const split = takeDrafts(drafts, (id) => id.workspace === "old");
  assert.deepEqual(split.kept, { [kept]: drafts[kept] });
  assert.deepEqual(split.taken, [
    { workspace: "old", locale: "fr", key: "a", value: "Adieu" },
  ]);
});
