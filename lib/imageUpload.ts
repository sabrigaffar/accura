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
