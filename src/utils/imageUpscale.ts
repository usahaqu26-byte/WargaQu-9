/**
 * Utilitas Auto-Upscale Foto & Ekspor Gambar HD Penuh Warna (Client-Side)
 * - Meningkatkan resolusi foto tersimpan (220-400px) ke kualitas HD (2x-3x, ~960-1280px)
 *   menggunakan progressive bicubic resampling + edge-preserving sharpen filter.
 * - Menjaga warna asli RGB 100% (tanpa mengubah tone menjadi hitam-putih).
 * - Menyelesaikan URL eksternal melalui CORS fetch ke Data URL agar aman untuk Canvas & html-to-image.
 */

export interface UpscaleOptions {
  scaleFactor?: number;
  minDimension?: number;
  maxDimension?: number;
  sharpenStrength?: number;
  outputMime?: 'image/jpeg' | 'image/png';
  quality?: number;
}

const resolvedUrlCache = new Map<string, string>();
const upscaledPhotoCache = new Map<string, string>();

export async function resolveImageUrlForCanvas(src: string): Promise<string> {
  const clean = (src || '').trim();
  if (!clean) return '';
  if (clean.startsWith('data:') || clean.startsWith('blob:')) return clean;

  const cached = resolvedUrlCache.get(clean);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 3500);
    const res = await fetch(clean, { mode: 'cors', signal: controller.signal });
    window.clearTimeout(timer);
    if (!res.ok) return clean;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Gagal membaca blob gambar'));
      reader.readAsDataURL(blob);
    });
    if (dataUrl) {
      resolvedUrlCache.set(clean, dataUrl);
      return dataUrl;
    }
  } catch {
    // Fallback ke src asli bila server eksternal tidak mengizinkan CORS
  }
  return clean;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    if (/^https?:\/\//i.test(src)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gagal memuat gambar untuk upscale'));
    img.src = src;
  });
}

/**
 * Menerapkan convolution sharpening 3x3 ringan (Unsharp-style) pada canvas
 * untuk memperjelas detail wajah/teks tanpa merusak warna asli.
 */
function applyMildSharpenFilter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strength = 0.24
): void {
  if (strength <= 0 || width <= 2 || height <= 2) return;
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const src = imgData.data;
    const out = new Uint8ClampedArray(src);
    const s = Math.min(0.6, Math.max(0.05, strength));
    const center = 1 + 4 * s;
    const neighbor = -s;

    for (let y = 1; y < height - 1; y++) {
      const rowOffset = y * width;
      for (let x = 1; x < width - 1; x++) {
        const idx = (rowOffset + x) * 4;
        const up = idx - width * 4;
        const down = idx + width * 4;
        const left = idx - 4;
        const right = idx + 4;

        out[idx] =
          src[idx] * center +
          (src[up] + src[down] + src[left] + src[right]) * neighbor;
        out[idx + 1] =
          src[idx + 1] * center +
          (src[up + 1] + src[down + 1] + src[left + 1] + src[right + 1]) * neighbor;
        out[idx + 2] =
          src[idx + 2] * center +
          (src[up + 2] + src[down + 2] + src[left + 2] + src[right + 2]) * neighbor;
        out[idx + 3] = src[idx + 3];
      }
    }

    imgData.data.set(out);
    ctx.putImageData(imgData, 0, 0);
  } catch {
    // Jika canvas tainted karena gambar eksternal non-CORS, biarkan hasil drawImage tetap utuh
  }
}

/**
 * Meng-upscale satu gambar/foto secara bertahap (progressive bicubic + sharpen)
 * agar tetap tajam dan penuh warna saat diunduh atau dicetak ukuran A0-A4.
 */
export async function upscaleImageToHdDataUrl(
  src: string,
  options: UpscaleOptions = {}
): Promise<string> {
  const clean = (src || '').trim();
  if (!clean) return '';

  const {
    scaleFactor = 2.5,
    minDimension = 880,
    maxDimension = 1440,
    sharpenStrength = 0.24,
    outputMime = 'image/jpeg',
    quality = 0.94,
  } = options;

  const cacheKey = `${clean.slice(0, 80)}_${clean.length}_${scaleFactor}_${minDimension}_${outputMime}`;
  const cached = upscaledPhotoCache.get(cacheKey);
  if (cached) return cached;

  try {
    const safeSrc = await resolveImageUrlForCanvas(clean);
    const img = await loadImageElement(safeSrc);
    const srcW = Math.max(1, img.naturalWidth || img.width);
    const srcH = Math.max(1, img.naturalHeight || img.height);
    const maxSrcSide = Math.max(srcW, srcH);

    // Hitung ukuran target HD: minimal minDimension (atau src * scaleFactor), dibatasi maxDimension
    let targetMaxSide = Math.round(Math.max(maxSrcSide * scaleFactor, minDimension));
    targetMaxSide = Math.min(maxDimension, Math.max(maxSrcSide, targetMaxSide));

    const ratio = targetMaxSide / maxSrcSide;
    const targetW = Math.max(1, Math.round(srcW * ratio));
    const targetH = Math.max(1, Math.round(srcH * ratio));

    // Progressive step-up canvas agar tepi wajah halus dan tidak kotak-kotak
    let currentCanvas = document.createElement('canvas');
    currentCanvas.width = srcW;
    currentCanvas.height = srcH;
    const baseCtx = currentCanvas.getContext('2d');
    if (!baseCtx) return safeSrc;
    baseCtx.imageSmoothingEnabled = true;
    baseCtx.imageSmoothingQuality = 'high';
    baseCtx.drawImage(img, 0, 0, srcW, srcH);

    let currW = srcW;
    let currH = srcH;
    while (currW < targetW || currH < targetH) {
      const nextW = Math.min(targetW, Math.round(currW * 1.6));
      const nextH = Math.min(targetH, Math.round(currH * 1.6));
      if (nextW === currW && nextH === currH) break;

      const stepCanvas = document.createElement('canvas');
      stepCanvas.width = nextW;
      stepCanvas.height = nextH;
      const stepCtx = stepCanvas.getContext('2d');
      if (!stepCtx) break;
      stepCtx.imageSmoothingEnabled = true;
      stepCtx.imageSmoothingQuality = 'high';
      stepCtx.drawImage(currentCanvas, 0, 0, nextW, nextH);

      currentCanvas = stepCanvas;
      currW = nextW;
      currH = nextH;
    }

    const finalCtx = currentCanvas.getContext('2d');
    if (finalCtx && ratio > 1.05) {
      applyMildSharpenFilter(finalCtx, currW, currH, sharpenStrength);
    }

    const result =
      outputMime === 'image/png'
        ? currentCanvas.toDataURL('image/png')
        : currentCanvas.toDataURL('image/jpeg', quality);

    if (upscaledPhotoCache.size > 160) {
      upscaledPhotoCache.clear();
    }
    upscaledPhotoCache.set(cacheKey, result);
    return result;
  } catch {
    return clean;
  }
}

/**
 * Meng-upscale kumpulan URL foto unik (batch paralel aman memori)
 * dan mengembalikan map { originalSrc: upscaledDataUrl }.
 */
export async function upscalePhotoMap(
  urls: string[],
  options: UpscaleOptions = {}
): Promise<Record<string, string>> {
  const uniqueUrls = Array.from(
    new Set(urls.map((u) => (u || '').trim()).filter(Boolean))
  );
  const map: Record<string, string> = {};
  if (uniqueUrls.length === 0) return map;

  const CHUNK_SIZE = 5;
  for (let i = 0; i < uniqueUrls.length; i += CHUNK_SIZE) {
    const chunk = uniqueUrls.slice(i, i + CHUNK_SIZE);
    const results = await Promise.all(
      chunk.map(async (orig) => {
        const up = await upscaleImageToHdDataUrl(orig, options);
        return [orig, up] as const;
      })
    );
    results.forEach(([orig, up]) => {
      map[orig] = up;
    });
  }
  return map;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const header = parts[0] || '';
  const body = parts[1] || '';
  const mimeMatch = header.match(/data:([^;]+);/);
  const mime = mimeMatch?.[1] || 'image/png';
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export async function saveOrShareFileBlob(
  blob: Blob,
  filename: string,
  title?: string
): Promise<'shared' | 'downloaded'> {
  // Coba download via Blob ObjectURL terlebih dahulu di browser desktop/PWA
  const triggerAnchorDownload = () => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  try {
    const file = new File([blob], filename, { type: blob.type || 'image/png' });
    const nav = navigator as Navigator & {
      canShare?: (data: { files?: File[] }) => boolean;
    };
    const isTouchOrMobile =
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '') ||
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse)').matches);

    if (
      isTouchOrMobile &&
      typeof nav.share === 'function' &&
      typeof nav.canShare === 'function' &&
      nav.canShare({ files: [file] })
    ) {
      await nav.share({
        files: [file],
        title: title || filename,
      });
      return 'shared';
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return 'shared';
    }
    // Lanjut ke fallback anchor download
  }

  triggerAnchorDownload();
  return 'downloaded';
}
