/**
 * A camera photo is 3 to 12 MB; the task needs a clear picture, not a print.
 * So it is redrawn at most 1600px on its long side as a JPEG (about 150 to
 * 400 KB) before it leaves the phone. Drawing through an <img> keeps the
 * camera's rotation (browsers apply EXIF orientation to images by default).
 */
export async function shrinkPhoto(file: File, longSide = 1600): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, longSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    if (!blob) throw new Error('encode');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * A profile photo: a square around where a face is in a portrait — centred
 * across, from a little below the top (people frame themselves with the face
 * in the upper part) — at most `side` pixels. The circle then shows a face,
 * not a whole scene with a small person in it.
 */
export async function squarePortrait(file: File, side = 640): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const crop = Math.round(Math.min(width, height) * (height > width ? 0.78 : 0.9));
    const x = Math.round((width - crop) / 2);
    const y = height > width ? Math.round(Math.min(height * 0.1, height - crop)) : Math.round((height - crop) / 2);
    const out = Math.min(side, crop);
    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    canvas.getContext('2d')!.drawImage(image, x, y, crop, crop, 0, 0, out, out);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
    if (!blob) throw new Error('encode');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
