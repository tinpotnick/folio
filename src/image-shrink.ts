/**
 * Keep embedded images small enough that the Markdown source stays
 * workable. A folio document is ONE file (ADR-0005): images embed as
 * data URIs, and a camera-resolution photo pasted raw is multi-MB - its
 * base64 is a single huge line in the source view, and laying that line
 * out is what made switching to the Markdown view feel locked up. Like
 * Word, we downscale on the way in.
 *
 * UI-side on purpose: createImageBitmap/canvas are browser APIs, so
 * this lives outside the zero-UI-dependency engine. The sizing decision
 * is pure (`shrinkPlan`) and unit-tested headlessly.
 */

/** Files at or under this embed unchanged. */
export const TARGET_EMBED_BYTES = 400_000;

const KEEP_KEY = "folio.images.keep-originals.v1";

let keepOriginalsState = ((): boolean => {
  try {
    return localStorage.getItem(KEEP_KEY) === "1";
  } catch {
    return false;
  }
})();

/** "Keep original image quality": when on, files embed untouched
 * (downscaling is the default because a multi-MB data URI is one huge
 * source line; but the image is the document, so the user can opt out
 * of any resizing). Persisted per origin. */
export function keepOriginals(): boolean {
  return keepOriginalsState;
}

export function setKeepOriginals(on: boolean): void {
  keepOriginalsState = on;
  try {
    if (on) localStorage.setItem(KEEP_KEY, "1");
    else localStorage.removeItem(KEEP_KEY);
  } catch {
    // private mode - session only
  }
}

/** Longest edge after downscaling, in pixels. */
export const MAX_IMAGE_DIM = 2048;

/** JPEG quality for opaque images (alpha keeps PNG). */
export const JPEG_QUALITY = 0.85;

/** Pure sizing decision: scale so the longest edge fits MAX_IMAGE_DIM,
 * never upscale. */
export function shrinkPlan(
  width: number,
  height: number,
  maxDim = MAX_IMAGE_DIM,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (!(longest > 0) || longest <= maxDim) {
    return {
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
    };
  }
  const scale = maxDim / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export interface ShrinkResult {
  file: File;
  /** True when the bytes actually changed (downscaled/re-encoded). */
  resized: boolean;
}

/** Downscale + re-encode an image file so its data URI stays small.
 * Never grows the file: if re-encoding doesn't help (or the image
 * can't be decoded), the original file is returned untouched. */
export async function shrinkImageFile(file: File): Promise<ShrinkResult> {
  if (keepOriginals() || file.size <= TARGET_EMBED_BYTES) {
    return { file, resized: false };
  }
  if (!/^image\//.test(file.type) || file.type === "image/svg+xml") {
    return { file, resized: false };
  }
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    return { file, resized: false }; // undecodable - embed as-is
  }
  try {
    const plan = shrinkPlan(bmp.width, bmp.height);
    const canvas = document.createElement("canvas");
    canvas.width = plan.width;
    canvas.height = plan.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { file, resized: false };
    ctx.drawImage(bmp, 0, 0, plan.width, plan.height);
    // one scan of the SCALED pixels (<= 2048^2) to detect transparency
    const data = ctx.getImageData(0, 0, plan.width, plan.height).data;
    let hasAlpha = false;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 255) {
        hasAlpha = true;
        break;
      }
    }
    // alpha keeps PNG (one shot); opaque images get a JPEG quality
    // ladder down to the target, so even pathological content lands
    // near TARGET_EMBED_BYTES
    if (hasAlpha) {
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/png"),
      );
      if (!blob || blob.size >= file.size) return { file, resized: false };
      return {
        file: new File([blob], file.name.replace(/\.[^.]*$/, ".png"), {
          type: "image/png",
        }),
        resized: true,
      };
    }
    let best: Blob | null = null;
    for (const q of [JPEG_QUALITY, 0.7, 0.55]) {
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/jpeg", q),
      );
      if (!blob) continue;
      if (!best || blob.size < best.size) best = blob;
      if (blob.size <= TARGET_EMBED_BYTES) break;
    }
    // never grow the file - if re-encoding doesn't win, keep the original
    if (!best || best.size >= file.size) return { file, resized: false };
    return {
      file: new File([best], file.name.replace(/\.[^.]*$/, ".jpg"), {
        type: "image/jpeg",
      }),
      resized: true,
    };
  } finally {
    bmp.close();
  }
}
