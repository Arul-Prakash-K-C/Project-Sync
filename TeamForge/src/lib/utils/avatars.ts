/**
 * Profile pictures. A user's `avatar` is one of:
 *  - a preset cartoon shipped with the app (`/avatars/preset-NN.svg`),
 *  - an uploaded photo, stored inline as a small square WebP/JPEG data URL,
 *  - a remote URL (older DiceBear avatars from before presets existed),
 *  - '' for initials only.
 *
 * Uploaded photos are cropped and re-encoded in the browser to 256×256, so a
 * profile row stays a few tens of kilobytes whether the app runs locally or
 * syncs the row to Supabase.
 */

export interface PresetAvatar {
  id: string;
  src: string;
  label: string;
}

/**
 * Ten cartoon characters: DiceBear "Adventurer" by Lisa Wischofsky, CC BY 4.0
 * (credits in static/avatars/CREDITS.md; the licence is also embedded in each SVG).
 */
export const PRESET_AVATARS: PresetAvatar[] = [
  { id: 'preset-01', src: '/avatars/preset-01.svg', label: 'Aria' },
  { id: 'preset-02', src: '/avatars/preset-02.svg', label: 'Kai' },
  { id: 'preset-03', src: '/avatars/preset-03.svg', label: 'Zara' },
  { id: 'preset-04', src: '/avatars/preset-04.svg', label: 'Leo' },
  { id: 'preset-05', src: '/avatars/preset-05.svg', label: 'Maya' },
  { id: 'preset-06', src: '/avatars/preset-06.svg', label: 'Nico' },
  { id: 'preset-07', src: '/avatars/preset-07.svg', label: 'Priya' },
  { id: 'preset-08', src: '/avatars/preset-08.svg', label: 'Omar' },
  { id: 'preset-09', src: '/avatars/preset-09.svg', label: 'Sofia' },
  { id: 'preset-10', src: '/avatars/preset-10.svg', label: 'Jin' }
];

/** Encoded photos larger than this are refused (a 256px WebP is typically 10–40 KB). */
export const MAX_AVATAR_DATA_URL_BYTES = 200 * 1024;
/** Source files larger than this are refused before decoding. */
export const MAX_AVATAR_UPLOAD_BYTES = 8 * 1024 * 1024;
export const AVATAR_OUTPUT_SIZE = 256;

const DATA_URL = /^data:image\/(webp|jpeg|png);base64,[a-z0-9+/=]+$/i;

export type AvatarKind = 'preset' | 'upload' | 'remote' | 'initials';

export function avatarKind(avatar: string): AvatarKind {
  if (!avatar) return 'initials';
  if (avatar.startsWith('data:')) return 'upload';
  if (PRESET_AVATARS.some((p) => p.src === avatar)) return 'preset';
  return 'remote';
}

/**
 * Whether a value may be saved as someone's avatar. Anything else (other data
 * types, scripts, oversized payloads, arbitrary local paths) is rejected.
 */
export function validateAvatar(avatar: string): string | null {
  if (avatar === '') return null;
  if (PRESET_AVATARS.some((p) => p.src === avatar)) return null;
  if (avatar.startsWith('data:')) {
    if (!DATA_URL.test(avatar)) return 'An uploaded photo must be a PNG, JPEG or WebP image.';
    if (avatar.length > MAX_AVATAR_DATA_URL_BYTES) return 'That photo is too large. Try a smaller crop.';
    return null;
  }
  if (/^https:\/\/api\.dicebear\.com\//.test(avatar)) return null;
  return 'Choose one of the preset avatars or upload a photo.';
}

export interface CropState {
  /** Zoom factor, 1 = the image just covers the square. */
  zoom: number;
  /** Offset of the image centre from the square's centre, as a fraction of the square (−0.5 … 0.5). */
  x: number;
  y: number;
}

/**
 * Geometry for drawing `img` into a square of side `size` so it covers the
 * square at `zoom`, shifted by the crop offsets. Offsets are clamped so the
 * image always covers the square (no empty edges).
 */
export function coverRect(imgW: number, imgH: number, size: number, crop: CropState) {
  const scale = Math.max(size / imgW, size / imgH) * Math.max(1, crop.zoom);
  const w = imgW * scale;
  const h = imgH * scale;
  const maxX = (w - size) / 2 / size;
  const maxY = (h - size) / 2 / size;
  const x = Math.max(-maxX, Math.min(maxX, crop.x));
  const y = Math.max(-maxY, Math.min(maxY, crop.y));
  return { w, h, left: (size - w) / 2 + x * size, top: (size - h) / 2 + y * size, x, y };
}

/** Crops and re-encodes an image to a square data URL (WebP, falling back to JPEG). */
export function encodeAvatar(img: HTMLImageElement, crop: CropState, size = AVATAR_OUTPUT_SIZE): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot process images.');
  const r = coverRect(img.naturalWidth, img.naturalHeight, size, crop);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, r.left, r.top, r.w, r.h);
  let url = canvas.toDataURL('image/webp', 0.86);
  // Browsers without WebP encoding silently return PNG; JPEG is far smaller.
  if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', 0.86);
  return url;
}

/** Loads a user-chosen file into an image element, rejecting non-images and huge files. */
export function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp|gif|avif)$/i.test(file.type)) {
      reject(new Error('Choose a PNG, JPEG, WebP, GIF or AVIF image.'));
      return;
    }
    if (file.size > MAX_AVATAR_UPLOAD_BYTES) {
      reject(new Error('That image is over 8 MB. Choose a smaller one.'));
      return;
    }
    // Read as a data URL rather than an object URL: the cropper keeps showing
    // this image long after loading, so its source must never be revoked.
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That file couldn't be read."));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("That file couldn't be read as an image."));
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
