import { getSupabaseClient } from '../lib/supabase';

const RIDE_PHOTOS_BUCKET = 'ride-photos';

const sanitizeFileName = (fileName: string): string =>
  fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export const uploadRidePhoto = async (slotKey: string, file: File): Promise<string> => {
  const supabase = getSupabaseClient();
  const safeName = sanitizeFileName(file.name) || 'photo.jpg';
  const path = `${slotKey}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from(RIDE_PHOTOS_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/jpeg',
  });

  if (error) {
    throw new Error(`Could not upload photo: ${error.message}`);
  }

  const { data } = supabase.storage.from(RIDE_PHOTOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

export const deleteRidePhotoByUrl = async (publicUrl: string): Promise<void> => {
  const marker = `/storage/v1/object/public/${RIDE_PHOTOS_BUCKET}/`;
  const markerIndex = publicUrl.indexOf(marker);

  if (markerIndex < 0) {
    return;
  }

  const encodedPath = publicUrl.slice(markerIndex + marker.length);
  const path = decodeURIComponent(encodedPath);
  if (!path) {
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(RIDE_PHOTOS_BUCKET).remove([path]);

  if (error) {
    throw new Error(`Could not delete photo: ${error.message}`);
  }
};
