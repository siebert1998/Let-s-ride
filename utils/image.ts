const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const loadImageElement = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not process this image.'));
    };

    image.src = objectUrl;
  });

export const optimizeImageForUpload = async (file: File): Promise<File> => {
  if (!IMAGE_MIME_TYPES.has(file.type)) {
    return file;
  }

  const maxDimension = 2048;
  const quality = 0.82;

  const image = await loadImageElement(file);

  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  if (scale === 1 && file.size < 2 * 1024 * 1024) {
    return file;
  }

  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    return file;
  }

  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', quality);
  });

  if (!blob) {
    return file;
  }

  const nextName = file.name.replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], `${nextName}.jpg`, { type: 'image/jpeg' });
};
