import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

/**
 * @typedef {import("./lang.mjs").Ctx} Ctx
 * @typedef {import("./lang.mjs").Tab} Tab
 */

/** Files the browser saves or asks for, driven through the tab's Playwright page. */

const FILE_ATTEMPTS = 4;
const FILE_WAIT_MS = 8000;

/**
 * Clicks a control that saves a file and reads the file the browser received through Playwright's download event.
 * A click that lands before the page hydrates saves nothing, so the click is repeated, at most four times, while no
 * download has started.
 *
 * @param {Ctx} ctx The journey
 * @param {Tab} tab The tab
 * @param {{ role: string, name: string | RegExp, exact?: boolean }} target The control that saves the file
 * @returns {Promise<{ name: string, text: string } | null>} The suggested file name and the file's text, or null when nothing was saved
 */
export async function downloadOf(ctx, tab, target) {
  const directory = join(ctx.state.home, "downloads");
  mkdirSync(directory, { recursive: true });
  const destination = join(directory, "received");
  rmSync(destination, { force: true });
  /** @type {string[]} */
  const names = [];
  for (let attempt = 0; attempt < FILE_ATTEMPTS; attempt += 1) {
    const received = receiveDownload(tab, destination, names);
    await tab.click(target);
    if (await received) return { name: names[0] ?? "", text: readFileSync(destination, "utf8") };
  }
  return null;
}

/**
 * @param {Tab} tab The tab
 * @param {string} destination Where the downloaded file is saved
 * @param {string[]} names Receives the file name the page suggested
 * @returns {Promise<boolean>} Whether a download arrived and was saved
 */
async function receiveDownload(tab, destination, names) {
  return (
    (await tab.page.waitForEvent("download", { timeout: FILE_WAIT_MS }).then(
      async (file) => {
        names.push(String(file.suggestedFilename()));
        await file.saveAs(destination);
        return true;
      },
      () => false,
    )) === true
  );
}

/**
 * Clicks a control that opens the file chooser and gives the chooser a file, the way a person picks one. The click is
 * repeated, at most four times, while no chooser has opened.
 *
 * @param {Tab} tab The tab
 * @param {{ role: string, name: string | RegExp, exact?: boolean }} target The control that opens the chooser
 * @param {{ name: string, mimeType: string, buffer: Buffer }} file The file to choose
 * @returns {Promise<boolean>} Whether a chooser opened
 */
export async function chooseFile(tab, target, file) {
  for (let attempt = 0; attempt < FILE_ATTEMPTS; attempt += 1) {
    const chosen = receiveChooser(tab, file);
    await tab.click(target);
    if (await chosen) return true;
  }
  return false;
}

/**
 * @param {Tab} tab The tab
 * @param {{ name: string, mimeType: string, buffer: Buffer }} file The file to choose
 * @returns {Promise<boolean>} Whether a chooser opened and took the file
 */
async function receiveChooser(tab, file) {
  return (
    (await tab.page.waitForEvent("filechooser", { timeout: FILE_WAIT_MS }).then(
      async (chooser) => {
        await chooser.setFiles(file);
        return true;
      },
      () => false,
    )) === true
  );
}

/**
 * The column headers of the matrix, in the order they show.
 *
 * @param {Tab} tab The tab on the matrix
 * @param {string[]} names The language names to look for in a header
 * @returns {Promise<string>} `Key`, then the name found in each header, joined by `|`
 */
export async function gridOrder(tab, names) {
  return String(
    await tab.page
      .getByRole("row")
      .first()
      .getByRole("gridcell")
      .evaluateAll((/** @type {Element[]} */ cells, /** @type {string[]} */ known) => cells.map((cell) => known.find((name) => (cell.textContent ?? "").includes(name)) ?? "Key").join("|"), names),
  );
}

/**
 * Drags the handle of one button onto another, the way a person reorders a list.
 *
 * @param {Tab} tab The tab
 * @param {string} from The accessible name of the button to drag
 * @param {string} to The accessible name of the button to drop it on
 * @returns {Promise<void>}
 */
export async function dragButton(tab, from, to) {
  await tab.page.getByRole("button", { name: from, exact: true }).dragTo(tab.page.getByRole("button", { name: to, exact: true }));
}

/**
 * The rows of a table, in the order they show.
 *
 * @param {Tab} tab The tab
 * @param {string} table The accessible name of the table
 * @param {string[]} names The names to look for in a row
 * @returns {Promise<string>} The name found in each row, joined by `|`
 */
export async function rowsOrder(tab, table, names) {
  return String(
    await tab.page
      .getByRole("table", { name: table })
      .getByRole("row")
      .evaluateAll((/** @type {Element[]} */ rows, /** @type {string[]} */ known) => rows.map((row) => known.find((name) => (row.textContent ?? "").includes(name)) ?? "").filter(Boolean).join("|"), names),
  );
}

/**
 * The value of the read-only text fields of the page, joined by `|`.
 *
 * @param {Tab} tab The tab
 * @returns {Promise<string>} The values
 */
export async function readOnlyValues(tab) {
  return String(await tab.page.locator("input[readonly]").evaluateAll((/** @type {HTMLInputElement[]} */ fields) => fields.map((field) => field.value).join("|")));
}

/**
 * Lets the page read the clipboard, so a Copy button can be checked by what it copied.
 *
 * @param {Ctx} ctx The journey
 * @param {Tab} tab The tab
 * @returns {Promise<void>}
 */
export async function allowClipboard(ctx, tab) {
  await tab.page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: ctx.state.webUrl });
}

/**
 * Clicks one of the page's Copy buttons and reads what the clipboard holds.
 *
 * @param {Tab} tab The tab
 * @param {number} nth Which Copy button, from 0
 * @returns {Promise<string>} The clipboard text
 */
export async function copiedBy(tab, nth) {
  await tab.click({ role: "button", name: "Copy", nth });
  return String(await tab.page.evaluate(() => navigator.clipboard.readText().catch(() => "")));
}

/**
 * The accessible name of the element that has the focus.
 *
 * @param {Tab} tab The tab
 * @returns {Promise<string>} Its aria-label, or its tag name when it has none
 */
export async function focusedName(tab) {
  return String(await tab.page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.tagName ?? ""));
}

/**
 * The `dir` attribute of an element.
 *
 * @param {Tab} tab The tab
 * @param {{ role: string, name: string | RegExp }} target The element
 * @returns {Promise<string>} Its direction, or "none" when it has none
 */
export async function directionOf(tab, target) {
  return String((await tab.locator(target).first().getAttribute("dir")) ?? "none");
}

/**
 * The names found in the elements of a role, in the order they show.
 *
 * @param {Tab} tab The tab
 * @param {string} role The role of the elements
 * @param {string[]} names The names to look for in an element
 * @returns {Promise<string>} The names found, joined by `|`
 */
export async function namesInOrder(tab, role, names) {
  return String(
    await tab.page
      .getByRole(role)
      .evaluateAll((/** @type {Element[]} */ elements, /** @type {string[]} */ known) => elements.map((element) => known.find((name) => (element.textContent ?? "").trim() === name) ?? "").filter(Boolean).join("|"), names),
  );
}

/**
 * The address of the page.
 *
 * @param {Tab} tab The tab
 * @returns {string} The URL
 */
export function currentUrl(tab) {
  return String(tab.page.url());
}


/**
 * Whether a heatmap cell is drawn green, amber or red, read from the classes of its link.
 *
 * @param {Tab} tab The tab on the Overview
 * @param {RegExp} name The accessible name of the cell's link
 * @returns {Promise<string>} `success`, `warning`, `error` or `unknown`
 */
export async function heatTone(tab, name) {
  const html = String(await tab.page.getByRole("link", { name }).first().evaluate((/** @type {Element} */ element) => element.className));
  return /bg-success/.test(html) ? "success" : /bg-warning/.test(html) ? "warning" : /bg-error/.test(html) ? "error" : "unknown";
}

/**
 * Scrolls the last row button of the matrix into view, so the next batch of rows is drawn.
 *
 * @param {Tab} tab The tab on the matrix
 * @returns {Promise<number>} How many key buttons are drawn afterwards
 */
export async function scrollRows(tab) {
  await tab.page.getByRole("button", { name: /^Open .+ in the panel$/ }).last().scrollIntoViewIfNeeded();
  await tab.page.waitForTimeout(1200);
  return drawnRows(tab);
}

/**
 * @param {Tab} tab The tab
 * @returns {Promise<number>} How many key buttons are drawn
 */
export async function drawnRows(tab) {
  return Number(await tab.page.getByRole("button", { name: /^Open .+ in the panel$/ }).count());
}

/**
 * How far the bottom of an element is from the bottom of a dialog, in pixels.
 *
 * @param {Tab} tab The tab
 * @param {string} dialog The accessible name of the dialog
 * @param {string} button The accessible name of a button in its footer
 * @returns {Promise<number>} The gap, or -1 when a box is missing
 */
export async function footerGap(tab, dialog, button) {
  return Number(
    await tab.page.getByRole("dialog", { name: dialog }).evaluate((/** @type {Element} */ element, /** @type {string} */ label) => {
      const foot = [...element.querySelectorAll("button")].find((candidate) => (candidate.textContent ?? "").trim() === label);
      if (!foot) return -1;
      return Math.round(element.getBoundingClientRect().bottom - foot.getBoundingClientRect().bottom);
    }, button),
  );
}

/**
 * Whether a radio of the page is checked.
 *
 * @param {Tab} tab The tab
 * @param {RegExp} name The radio's accessible name
 * @returns {Promise<boolean>} Its state
 */
export async function radioChecked(tab, name) {
  return (await tab.page.getByRole("radio", { name }).first().isChecked()) === true;
}

/**
 * The accessible texts of the links of a name, in the order they show.
 *
 * @param {Tab} tab The tab
 * @param {RegExp} name What the links are named
 * @returns {Promise<string>} The link texts joined by `|`
 */
export async function linkTexts(tab, name) {
  return String(await tab.page.getByRole("link", { name }).evaluateAll((/** @type {Element[]} */ els) => els.map((el) => (el.textContent ?? "").trim()).join("|")));
}

/**
 * The leading lowercase word of the text of each button of a name, in the order they show.
 *
 * @param {Tab} tab The tab
 * @param {RegExp} name What the buttons are named
 * @returns {Promise<string>} The words joined by `|`
 */
export async function leadingNames(tab, name) {
  return String(await tab.page.getByRole("button", { name }).evaluateAll((/** @type {Element[]} */ els) => els.map((el) => /^[a-z]+/.exec((el.textContent ?? "").trim())?.[0] ?? "").join("|")));
}

/**
 * The aria-labels of the elements of a name, in the order they show.
 *
 * @param {Tab} tab The tab
 * @param {string} role The role of the elements
 * @param {RegExp} name What they are named
 * @returns {Promise<string>} The labels joined by `|`
 */
export async function labelsOf(tab, role, name) {
  return String(await tab.page.getByRole(role, { name }).evaluateAll((/** @type {Element[]} */ els) => els.map((el) => el.getAttribute("aria-label") ?? "").join("|")));
}

/**
 * The full text of the first element of a role and name, including text hidden from the accessibility tree such as a language tile.
 *
 * @param {Tab} tab The tab
 * @param {string} role The role
 * @param {RegExp} name Its accessible name
 * @returns {Promise<string>} Its text content
 */
export async function textOf(tab, role, name) {
  return String(await tab.page.getByRole(role, { name }).first().evaluate((/** @type {Element} */ element) => element.textContent ?? ""));
}

/**
 * The text of the workspace bar, found from its Switch workspace button: the smallest ancestor that holds the base language, so the language table of the page cannot answer for it.
 *
 * @param {Tab} tab The tab
 * @returns {Promise<string>} The bar's text
 */
export async function scopeBarText(tab) {
  return String(
    await tab.page.getByRole("button", { name: "Switch workspace" }).first().evaluate((/** @type {Element} */ button) => {
      let node = button.parentElement;
      for (let level = 0; level < 5 && node; level += 1) {
        if (/Base/.test(node.textContent ?? "")) return (node.textContent ?? "").replace(/\s+/g, " ");
        node = node.parentElement;
      }
      return "";
    }),
  );
}

/** The user agent a macOS browser sends, which the DMS reads to bind Command to its shortcuts. */
export const MAC_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Makes the page read a macOS user agent from its first load on.
 *
 * @param {Tab} tab The tab, before it opens any page
 * @returns {Promise<void>}
 */
export async function pretendToBeAMac(tab) {
  await tab.page.addInitScript((/** @type {string} */ agent) => Object.defineProperty(Navigator.prototype, "userAgent", { get: () => agent }), MAC_USER_AGENT);
}
