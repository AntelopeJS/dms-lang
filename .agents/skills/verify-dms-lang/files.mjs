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
