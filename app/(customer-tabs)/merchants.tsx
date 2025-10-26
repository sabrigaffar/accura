// نعيد التوجيه إلى صفحة المتاجر الأصلية
import { Redirect } from 'expo-router';

export default function CustomerMerchants() {
  return <Redirect href="/(tabs)/merchants" />;
}
