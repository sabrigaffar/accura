/**
 * Retry Utility
 * توفير آلية لإعادة المحاولة عند فشل العمليات
 */

interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  exponentialBackoff?: boolean;
  onRetry?: (attempt: number, error: any) => void;
}

/**
 * تنفيذ دالة مع إعادة المحاولة عند الفشل
 * 
 * @param fn - الدالة المراد تنفيذها
 * @param options - خيارات إعادة المحاولة
 * @returns نتيجة الدالة أو رمي خطأ بعد استنفاذ المحاولات
 * 
 * @example
 * const data = await fetchWithRetry(
 *   () => supabase.from('orders').select('*'),
 *   { maxRetries: 3, delayMs: 1000 }
 * );
 */
export async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delayMs = 1000,
    exponentialBackoff = true,
    onRetry,
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // محاولة تنفيذ الدالة
      const result = await fn();
      
      // نجحت العملية
      if (attempt > 0) {
        console.log(`✅ [Retry] Succeeded after ${attempt} retries`);
      }
      
      return result;
    } catch (error: any) {
      lastError = error;
      
      // إذا كانت هذه آخر محاولة، نرمي الخطأ
      if (attempt === maxRetries) {
        console.error(`❌ [Retry] Failed after ${maxRetries} retries:`, error);
        throw error;
      }

      // حساب وقت الانتظار
      const delay = exponentialBackoff 
        ? delayMs * Math.pow(2, attempt) 
        : delayMs;

      console.warn(
        `⚠️ [Retry] Attempt ${attempt + 1}/${maxRetries + 1} failed. Retrying in ${delay}ms...`,
        error.message
      );

      // استدعاء callback إن وجد
      if (onRetry) {
        onRetry(attempt + 1, error);
      }

      // الانتظار قبل إعادة المحاولة
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // هذا السطر لن يصل إليه أبداً (للـ TypeScript)
  throw lastError;
}

/**
 * دالة لإعادة محاولة عمليات Supabase
 */
export async function supabaseRetry<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  options: RetryOptions = {}
): Promise<T> {
  return fetchWithRetry(async () => {
    const { data, error } = await queryFn();
    
    if (error) {
      throw error;
    }
    
    if (data === null) {
      throw new Error('No data returned from query');
    }
    
    return data;
  }, options);
}

/**
 * معالج أخطاء عام لعرض رسائل مفيدة للمستخدم
 */
export function getErrorMessage(error: any): string {
  // أخطاء الشبكة
  if (error.message?.includes('NetworkError') || error.message?.includes('fetch')) {
    return 'تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت.';
  }

  // أخطاء المصادقة
  if (error.message?.includes('JWT') || error.message?.includes('auth')) {
    return 'انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.';
  }

  // أخطاء الصلاحيات
  if (error.message?.includes('permission') || error.message?.includes('policy')) {
    return 'ليس لديك صلاحية للقيام بهذا الإجراء.';
  }

  // أخطاء قاعدة البيانات
  if (error.code === '23505') {
    return 'هذا العنصر موجود بالفعل.';
  }

  if (error.code === '23503') {
    return 'لا يمكن حذف هذا العنصر لأنه مرتبط بعناصر أخرى.';
  }

  // رسالة الخطأ الأصلية أو رسالة عامة
  return error.message || 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.';
}

/**
 * دالة مساعدة لمعالجة الأخطاء وعرضها للمستخدم
 */
export function handleError(error: any, context?: string): void {
  const message = getErrorMessage(error);
  const prefix = context ? `[${context}] ` : '';
  
  console.error(`${prefix}Error:`, error);
  
  // يمكن هنا إضافة تسجيل الأخطاء في خدمة خارجية
  // logToErrorService(error, context);
}

/**
 * Type guard للتحقق من أن الخطأ هو خطأ شبكة
 */
export function isNetworkError(error: any): boolean {
  return (
    error.message?.includes('NetworkError') ||
    error.message?.includes('fetch') ||
    error.message?.includes('timeout') ||
    !navigator.onLine
  );
}

/**
 * Type guard للتحقق من أن الخطأ هو خطأ مصادقة
 */
export function isAuthError(error: any): boolean {
  return (
    error.message?.includes('JWT') ||
    error.message?.includes('auth') ||
    error.status === 401
  );
}

/**
 * wrapper لعرض Loading State أثناء العمليات
 */
export async function withLoading<T>(
  fn: () => Promise<T>,
  setLoading: (loading: boolean) => void,
  onError?: (error: any) => void
): Promise<T | null> {
  try {
    setLoading(true);
    const result = await fn();
    return result;
  } catch (error) {
    console.error('Error in withLoading:', error);
    if (onError) {
      onError(error);
    }
    return null;
  } finally {
    setLoading(false);
  }
}
