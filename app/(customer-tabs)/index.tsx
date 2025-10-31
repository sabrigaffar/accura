import { Redirect } from 'expo-router';

export default function CustomerHome() {
  // توجيه داخل مجموعة العميل بدلاً من مجموعة (tabs)
  return <Redirect href="/(customer-tabs)/merchants" />;
}
