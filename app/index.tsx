import { Redirect } from 'expo-router';

export default function Index() {
  // ابدأ دائماً من مجموعة auth، ومن هناك ستنتقل حسب تدفق التسجيل/الدخول
  return <Redirect href="/auth" />;
}