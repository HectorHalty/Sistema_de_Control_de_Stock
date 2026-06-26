/**
 * Converts the brand logo into an ESC/POS raster bit image command (GS v 0)
 * so it can be printed on thermal printers. The PNG is embedded as base64 to
 * stay self-contained across dev/prod builds. The result is cached per paper
 * width because the conversion is relatively expensive.
 */
import sharp from 'sharp';
import { LOGO_PNG_BASE64 } from './logo-data';

const GS = 0x1d;

/** Printable dots for each paper width (typical 203 dpi printers). */
const DOTS_BY_WIDTH: Record<58 | 80, number> = { 58: 384, 80: 576 };

/** Pixels darker than this (0-255 luminance) are printed black. */
const THRESHOLD = 160;

const cache = new Map<58 | 80, Buffer | null>();

/**
 * Builds the GS v 0 raster command for the logo at the given paper width.
 * Returns null if the logo can't be loaded so printing degrades gracefully.
 */
export async function getLogoRaster(paperWidth: 58 | 80): Promise<Buffer | null> {
  if (cache.has(paperWidth)) return cache.get(paperWidth)!;

  try {
    const targetDots = DOTS_BY_WIDTH[paperWidth];
    const { data, info } = await sharp(Buffer.from(LOGO_PNG_BASE64, 'base64'))
      .resize({ width: targetDots, withoutEnlargement: true })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    const bytesPerRow = Math.ceil(width / 8);

    const raster = Buffer.alloc(bytesPerRow * height, 0);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const luminance = data[y * width + x];
        if (luminance < THRESHOLD) {
          raster[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
        }
      }
    }

    const header = Buffer.from([
      GS, 0x76, 0x30, 0x00,
      bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff,
      height & 0xff, (height >> 8) & 0xff,
    ]);

    const command = Buffer.concat([header, raster]);
    cache.set(paperWidth, command);
    return command;
  } catch {
    cache.set(paperWidth, null);
    return null;
  }
}
