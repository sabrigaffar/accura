// العملاء يستخدمون صفحة الملف الشخصي الموحدة
import { Redirect } from 'expo-router';

export default function CustomerProfile() {
  return <Redirect href="/(tabs)/profile" />;
}
