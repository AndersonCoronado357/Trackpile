/**
 * Recorta una imagen al cuadrado por el centro y la reduce, para no mandar
 * varios megas al servidor. Devuelve un data URL en WebP.
 */
export async function squareThumbnail(file: File, size = 288): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('El navegador no permitió procesar la imagen');

  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();

  return canvas.toDataURL('image/webp', 0.86);
}

export const isImage = (file: File): boolean => file.type.startsWith('image/');
