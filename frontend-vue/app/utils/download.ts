const JSON_INDENT = 2
const JSON_TYPE = 'application/json'
/** Long enough for the browser to start the download before the URL goes. */
const REVOKE_DELAY_MS = 1000

/** Downloads a text as a file, through the DMS `downloadFile`. */
export function downloadText(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  downloadFile(url, name)
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
}

/** Downloads data as an indented JSON file. */
export function downloadJson(name: string, data: unknown) {
  downloadText(name, JSON.stringify(data, null, JSON_INDENT), JSON_TYPE)
}
