// نفس محتوى app/(tabs)/index.tsx - صفحة الرئيسية للعملاء
import { Redirect } from 'expo-router';

export default function CustomerHome() {
  // نعيد التوجيه إلى الصفحة الأصلية لحين نقلها
  return <Redirect href="/(tabs)" />;
}
