// Downloading a report the SERVER built.
//
// WHY THE CLIENT DOES NOT BUILD THESE
//
// An export means "every row the current filters match", and a client cannot ask
// for that — it can only ask for a page. Building the file here meant requesting
// one enormous page and hoping it was large enough, which is why both sides used
// to carry a maximum page size that had to agree.
//
// Now the filters travel, the file comes back, and neither side has an opinion
// about how many rows that is. Page size goes back to meaning what it says: how
// many rows a grid shows.
import { env } from '../env';
import { STORAGE_KEYS } from '../config';
import { getToken } from './http';
import { downloadBlob } from '../download';

/** Same filters the grid is showing, as query parameters. */
export type ExportParams = Record<string, string | number | boolean | null | undefined>;

function toQuery(params: ExportParams): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    q.set(key, String(value));
  }
  return q.toString();
}

/**
 * Fetch a generated file and hand it to the browser.
 *
 * Not `apiFetch`: that parses JSON and unwraps the response envelope, and this
 * is a binary body. The pieces it shares — the base URL, the bearer token, the
 * language header the server labels the columns from — are taken from the same
 * places, so the two cannot drift.
 *
 * A FAILURE IS STILL JSON. When the server refuses (403, or a validation error)
 * it answers with the normal error envelope, so the content type decides how to
 * read the body: anything that is not a spreadsheet is an error to surface, not
 * a file to save.
 */
async function request(path: string, params: ExportParams): Promise<Response> {
  const query = toQuery(params);
  const lang = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.LANG) || 'ar' : 'ar';
  const token = getToken();

  const res = await fetch(`${env.apiUrl}${path}${query ? `?${query}` : ''}`, {
    headers: {
      'Accept-Language': lang,
      'x-language': lang,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  });

  if (!res.ok || (res.headers.get('content-type') ?? '').includes('application/json')) {
    // Read the envelope so the caller can show the server's own message rather
    // than a generic failure.
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string; error?: string };
      message = body.message ?? body.error ?? message;
    } catch {
      /* not JSON either — keep the status */
    }
    throw new Error(message);
  }

  return res;
}

/** Fetch the generated spreadsheet and hand it to the browser to save. */
export async function downloadReport(path: string, params: ExportParams, filename: string): Promise<void> {
  const res = await request(path, { ...params, format: 'xlsx' });
  downloadBlob(await res.blob(), filename);
}

/**
 * Open the server's print-ready report and let the browser make the PDF.
 *
 * NOT `window.open(url)`: a new window carries no Authorization header, so the
 * document is fetched here — with the token — and written into a window opened
 * first. Opening the window BEFORE the await matters; a popup opened after one
 * is no longer tied to the click that asked for it and gets blocked.
 *
 * The document prints itself once its fonts have loaded (see the server's
 * report-html.ts), and "Save as PDF" in that dialog produces the file. The
 * browser is doing the one part of this no Node library does correctly: Arabic
 * shaping and bidirectional layout.
 */
export async function printReportFromServer(path: string, params: ExportParams): Promise<void> {
  const win = window.open('', '_blank');
  if (!win) throw new Error('popup-blocked');

  try {
    const html = await fetchReport(path, { ...params, format: 'pdf' });
    win.document.open();
    win.document.write(html);
    win.document.close();
  } catch (err) {
    win.close();
    throw err;
  }
}

/** The shared request: same base URL, token and language header as apiFetch. */
async function fetchReport(path: string, params: ExportParams): Promise<string> {
  const res = await request(path, params);
  return res.text();
}
