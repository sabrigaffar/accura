// نعيد التوجيه إلى صفحة الطلبات الأصلية
import { Redirect } from 'expo-router';

export default function CustomerOrders() {
  return <Redirect href="/(tabs)/orders" />;
}
