/** The square of the source a centre crop keeps at `zoom` (1 = the largest centred square). */
export function centerCropRect(width: number, height: number, zoom: number): { sx: number; sy: number; side: number } {
  const side = Math.min(width, height) / Math.max(1, zoom);
  return { sx: (width - side) / 2, sy: (height - side) / 2, side };
}

export type AvatarImageType = "image/png" | "image/jpeg" | "image/webp";

const EXTENSION: Record<AvatarImageType, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/**
 * Draws the centre square of a decoded image at `zoom` onto a `size` × `size`
 * canvas and encodes it. The image is the one on screen, so what is uploaded
 * is what the preview showed (both are a centred cover scaled by `zoom`).
 * Rejects when the browser cannot draw or encode it.
 */
export async function cropToSquare(
  image: HTMLImageElement,
  { zoom, size, type, name }: { zoom: number; size: number; type: AvatarImageType; name: string },
): Promise<File> {
  const { sx, sy, side } = centerCropRect(image.naturalWidth, image.naturalHeight, zoom);
  const canvas = image.ownerDocument.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context || side <= 0) throw new Error("The image could not be drawn.");
  context.imageSmoothingQuality = "high";
  context.drawImage(image, sx, sy, side, side, 0, 0, size, size);
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, type, 0.92));
  if (!blob) throw new Error("The image could not be encoded.");
  const stem = name.replace(/\.[^./\\]+$/, "") || "avatar";
  // A browser that cannot encode the type asked for falls back to PNG; name the file by what it got.
  const got = (blob.type in EXTENSION ? blob.type : type) as AvatarImageType;
  return new File([blob], `${stem}.${EXTENSION[got]}`, { type: blob.type || type });
}
