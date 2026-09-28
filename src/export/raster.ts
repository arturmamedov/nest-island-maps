import { ARTBOARD, EXPORT_SCALE, JPEG_QUALITY, WHITE } from '../shared/tokens';

/* PNG and JPG are the web SVG (fonts embedded, since an <img> cannot use the
   page's fonts) drawn onto a canvas at twice the artboard. The browser
   re-rasterises the vector at the canvas size, so the export is sharp, not an
   upscaled 1080 bitmap; tests/render/export.spec.ts holds it to a Chromium
   screenshot of the same map at DPR 2. decode() waits until the image, and
   the faces inside it, are ready to draw. */

export type RasterFormat = 'png' | 'jpg';

const MIME: Record<RasterFormat, string> = { png: 'image/png', jpg: 'image/jpeg' };

/** PNG is transparent; JPG is flattened onto white. Both are 2160 × 2160. */
export async function rasterise(svg: string, format: RasterFormat): Promise<Blob> {
  const size = ARTBOARD * EXPORT_SCALE;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available, so the map cannot be rasterised');
    if (format === 'jpg') {
      ctx.fillStyle = WHITE;
      ctx.fillRect(0, 0, size, size);
    }
    ctx.drawImage(img, 0, 0, size, size);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error(`The browser could not encode the ${format.toUpperCase()}`))),
        MIME[format],
        format === 'jpg' ? JPEG_QUALITY : undefined,
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
