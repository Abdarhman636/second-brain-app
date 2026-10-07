/*
 * Turns an image the user picked into a plain raster image that is safe and
 * small enough to store: large pictures are scaled down, and every format is
 * re-encoded as PNG or JPEG. SVGs are rasterized too, since an SVG file can
 * carry scripts; GIFs keep their first frame. The storage bucket only accepts
 * PNG, JPEG and WebP.
 */

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];
const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

export class ImageFileError extends Error {}

/** Decode any accepted image into something drawable, with its natural size. */
async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (file.type !== 'image/svg+xml') {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  }

  // SVGs decode through <img>; their natural size may be tiny, so scale them up to fill.
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  await image.decode();
  const width = image.naturalWidth || 300;
  const height = image.naturalHeight || 150;
  const scale = MAX_DIMENSION / Math.max(width, height);
  return {
    source: image,
    width: Math.round(width * scale),
    height: Math.round(height * scale),
    release: () => URL.revokeObjectURL(url),
  };
}

export async function prepareImageFile(file: File): Promise<string> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new ImageFileError('اختر صورة بصيغة PNG أو JPG أو WebP أو GIF أو SVG.');
  }
  if (file.size > MAX_INPUT_BYTES) throw new ImageFileError('الصورة كبيرة جدًا. الحد الأقصى 15 ميجابايت.');

  let decoded: Awaited<ReturnType<typeof decode>>;
  try {
    decoded = await decode(file);
  } catch {
    throw new ImageFileError('تعذّر فتح هذه الصورة. جرّب صورة أخرى.');
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(decoded.width, decoded.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(decoded.width * scale);
  canvas.height = Math.round(decoded.height * scale);
  const context = canvas.getContext('2d');
  // Transparent areas become white, so diagrams stay readable in both themes.
  if (context && file.type !== 'image/png') {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context?.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
  decoded.release();

  // PNG keeps sharp edges and transparency (screenshots, diagrams); photos compress better as JPEG.
  const keepsDetail = file.type === 'image/png' || file.type === 'image/svg+xml' || file.type === 'image/gif';
  return keepsDetail ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}
