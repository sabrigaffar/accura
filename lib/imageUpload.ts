// lib/imageUpload.ts
import { supabase } from './supabase';

/**
 * رفع صورة واحدة إلى Supabase Storage
 * @param imageUri - مسار الصورة المحلي
 * @param userId - معرف المستخدم
 * @returns رابط الصورة العام أو null
 */
export async function uploadSingleImage(imageUri: string, userId: string): Promise<string | null> {
  try {
    // تحويل URI إلى ArrayBuffer (React Native compatible)
    const response = await fetch(imageUri);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    
    // إنشاء اسم فريد للصورة
    const fileExt = imageUri.split('.').pop() || 'jpg';
    const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    console.log('Uploading to:', fileName);
    
    // رفع الصورة إلى Storage
    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(fileName, buffer, {
        contentType: `image/${fileExt}`,
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Error uploading image:', error);
      return null;
    }

    console.log('Upload success:', data);

    // الحصول على الرابط العام للصورة
    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);

    console.log('Public URL:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('Error processing image:', error);
    return null;
  }
}

/**
 * رفع عدة صور إلى Supabase Storage
 * @param imageUris - مصفوفة مسارات الصور المحلية
 * @param userId - معرف المستخدم
 * @returns مصفوفة روابط الصور العامة
 */
export async function uploadMultipleImages(imageUris: string[], userId: string): Promise<string[]> {
  const uploadedUrls: string[] = [];

  for (const imageUri of imageUris) {
    const url = await uploadSingleImage(imageUri, userId);
    if (url) {
      uploadedUrls.push(url);
    }
  }

  return uploadedUrls;
}

/**
 * حذف صورة من Supabase Storage
 * @param imageUrl - رابط الصورة العام
 * @returns true إذا تم الحذف بنجاح
 */
export async function deleteImage(imageUrl: string): Promise<boolean> {
  try {
    // استخراج اسم الملف من الرابط
    const urlParts = imageUrl.split('/product-images/');
    if (urlParts.length < 2) return false;
    
    const filePath = urlParts[1];
    
    const { error } = await supabase.storage
      .from('product-images')
      .remove([filePath]);

    if (error) {
      console.error('Error deleting image:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error processing image deletion:', error);
    return false;
  }
}

/**
 * حذف عدة صور من Supabase Storage
 * @param imageUrls - مصفوفة روابط الصور العامة
 * @returns عدد الصور التي تم حذفها بنجاح
 */
export async function deleteMultipleImages(imageUrls: string[]): Promise<number> {
  let deletedCount = 0;

  for (const imageUrl of imageUrls) {
    const success = await deleteImage(imageUrl);
    if (success) deletedCount++;
  }

  return deletedCount;
}

// =============================
// KYC uploads (private bucket)
// =============================

/**
 * Upload an image to the private 'kyc-images' bucket and return the storage object path.
 * Path format: `${folder}/${ownerId}/${timestamp_rand}.${ext}` where folder is 'drivers' or 'merchants'.
 */
export async function uploadToKyc(
  imageUri: string,
  ownerId: string,
  folder: 'drivers' | 'merchants'
): Promise<string | null> {
  try {
    const response = await fetch(imageUri);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const uriLower = imageUri.toLowerCase();
    let fileExt = 'jpg';
    if (uriLower.includes('.png')) fileExt = 'png';
    else if (uriLower.includes('.jpeg')) fileExt = 'jpeg';
    else if (uriLower.includes('.jpg')) fileExt = 'jpg';

    const fileName = `${folder}/${ownerId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

    const { error } = await supabase.storage
      .from('kyc-images')
      .upload(fileName, buffer, {
        contentType: `image/${fileExt}`,
        cacheControl: '3600',
        upsert: false,
      });
    if (error) {
      console.error('Error uploading KYC image:', error);
      return null;
    }
    // Return storage path (private). Use createSignedUrl to view when needed.
    return fileName;
  } catch (e) {
    console.error('Error processing KYC image:', e);
    return null;
  }
}

/**
 * Create a signed URL for a private KYC object path.
 */
export async function getKycSignedUrl(path: string, expiresInSeconds = 3600): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('kyc-images')
      .createSignedUrl(path, expiresInSeconds);
    if (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }
    return data.signedUrl;
  } catch (e) {
    console.error('Error signing KYC URL:', e);
    return null;
  }
}

// ======================================
// Generic uploads to any Storage bucket
// ======================================

/**
 * Upload any file (image/PDF/...) to a public bucket and return its public URL.
 * If the bucket is private, you can still upload but you'll need to create a signed URL to view.
 */
export async function uploadToBucket(
  fileUri: string,
  bucketId: string,
  keyPrefix: string = '',
  opts?: { forceExt?: string; contentTypeOverride?: string }
): Promise<string | null> {
  try {
    const response = await fetch(fileUri);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const lower = (fileUri || '').toLowerCase();
    let ext = opts?.forceExt || 'bin';
    if (!opts?.forceExt) {
      if (lower.includes('.png')) ext = 'png';
      else if (lower.includes('.jpg')) ext = 'jpg';
      else if (lower.includes('.jpeg')) ext = 'jpeg';
      else if (lower.includes('.webp')) ext = 'webp';
      else if (lower.includes('.pdf')) ext = 'pdf';
    }

    let contentType = opts?.contentTypeOverride || 'application/octet-stream';
    if (!opts?.contentTypeOverride) {
      if (ext === 'pdf') contentType = 'application/pdf';
      else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    }

    const prefix = keyPrefix ? `${keyPrefix.replace(/\/$/, '')}/` : '';
    const fileName = `${prefix}${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(bucketId)
      .upload(fileName, buffer, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      });
    if (upErr) {
      console.error('uploadToBucket error:', upErr);
      return null;
    }

    const { data: pub } = supabase.storage
      .from(bucketId)
      .getPublicUrl(fileName);
    return pub.publicUrl;
  } catch (e) {
    console.error('uploadToBucket processing error:', e);
    return null;
  }
}
