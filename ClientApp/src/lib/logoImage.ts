// The organisation's logo, made fit for everywhere it is shown.
//
// Whatever is picked — a 4 MB photo, an SVG, a PNG with a huge canvas — is
// drawn once at a modest size and stored as PNG. Three things depend on that:
//
//   * The spreadsheet export embeds it. Excel holds PNG and JPEG and nothing
//     else, so an SVG stored as-is would appear in the print document and be
//     missing from the workbook.
//   * The settings row travels inside a JSON body. A logo stored at photo size
//     put that body past the proxy's limit and the save failed with a 413
//     nobody saw.
//   * The screen and the print header show it at ~44px tall; a 3000px image
//     there is bandwidth on every page load for nothing.
//
// Runs in the browser so the server never needs an image library.

/** Longest side of the stored logo, in pixels. Ample for a 44px header at 4x. */
export const LOGO_MAX_SIDE = 512;

/** Read a picked file into an <img>, which the browser decodes for us — SVG included. */
function load(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('undecodable'));
    };
    img.src = url;
  });
}

/**
 * The file as a PNG data URL no longer than LOGO_MAX_SIDE on its long side.
 *
 * Transparent logos stay transparent — the canvas is not painted first — so
 * one drawn for a dark header still works on the light paper of a report.
 */
export async function normaliseLogo(file: File): Promise<string> {
  const img = await load(file);
  // An SVG with no intrinsic size reports 0×0; give it something to scale from.
  const w = img.naturalWidth || 300;
  const h = img.naturalHeight || 120;
  const scale = Math.min(1, LOGO_MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no-canvas');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}
