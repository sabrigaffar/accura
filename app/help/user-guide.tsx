import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookOpen, UserPlus, ShoppingBag, MapPin, CreditCard, Headphones } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/theme';

interface GuideCard {
  icon: any;
  title: string;
  description: string;
  steps: string[];
}

const guideItems: GuideCard[] = [
  {
    icon: UserPlus,
    title: 'كيف تسجل حساب',
    description: 'خطوات بسيطة لإنشاء حسابك',
    steps: [
      'قم بتحميل التطبيق من متجر التطبيقات',
      'اضغط على "إنشاء حساب جديد"',
      'أدخل بريدك الإلكتروني أو رقم هاتفك',
      'أنشئ كلمة مرور قوية',
      'أكمل بياناتك الشخصية',
      'ابدأ في استخدام التطبيق!',
    ],
  },
  {
    icon: ShoppingBag,
    title: 'كيف تطلب خدمة أو توصيل',
    description: 'اطلب ما تحتاجه بسهولة',
    steps: [
      'اختر نوع الخدمة من الصفحة الرئيسية',
      'تصفح المتاجر أو المنتجات المتاحة',
      'أضف المنتجات إلى سلة التسوق',
      'حدد عنوان التوصيل',
      'اختر طريقة الدفع المناسبة',
      'أكد الطلب وانتظر التوصيل',
    ],
  },
  {
    icon: MapPin,
    title: 'تتبع الطلب',
    description: 'راقب طلبك لحظة بلحظة',
    steps: [
      'افتح صفحة "طلباتي" من القائمة الرئيسية',
      'اختر الطلب الذي تريد متابعته',
      'شاهد حالة الطلب الحالية',
      'تتبع موقع السائق على الخريطة',
      'ستصلك إشعارات بتحديثات الطلب',
      'يمكنك التواصل مع السائق مباشرة',
    ],
  },
  {
    icon: CreditCard,
    title: 'طرق الدفع',
    description: 'ادفع بالطريقة التي تناسبك',
    steps: [
      'الدفع نقداً عند الاستلام',
      'الدفع ببطاقة الائتمان/الخصم',
      'الدفع عبر المحفظة الإلكترونية',
      'جميع المدفوعات آمنة ومحمية',
      'يمكنك حفظ بطاقتك للدفع السريع',
      'ستحصل على فاتورة مفصلة',
    ],
  },
  {
    icon: Headphones,
    title: 'الدعم الفني',
    description: 'نحن هنا لمساعدتك',
    steps: [
      'افتح قسم "المساعدة" من الحساب',
      'تواصل معنا عبر الدردشة المباشرة',
      'أو أرسل بريد إلكتروني لـ: sabrigaafar@gmail.com',
      'اتصل بنا على الرقم: +20-1001551310',
      'نرد على استفساراتك خلال 24 ساعة',
      'فريق الدعم متاح 7 أيام في الأسبوع',
    ],
  },
];

export default function UserGuideScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <BookOpen size={48} color={colors.primary} />
          <Text style={styles.title}>دليل الاستخدام</Text>
          <Text style={styles.subtitle}>
            كل ما تحتاج معرفته لاستخدام التطبيق بسهولة
          </Text>
        </View>

        {/* Guide Cards */}
        <View style={styles.cardsContainer}>
          {guideItems.map((item, index) => (
            <View key={index} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.iconContainer}>
                  <item.icon size={28} color={colors.primary} />
                </View>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardDescription}>{item.description}</Text>
                </View>
              </View>

              <View style={styles.stepsContainer}>
                {item.steps.map((step, stepIndex) => (
                  <View key={stepIndex} style={styles.stepRow}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>{stepIndex + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            هل لديك أسئلة أخرى؟ تواصل معنا عبر قسم الدعم الفني
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textLight,
    textAlign: 'center',
  },
  cardsContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.medium,
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },
  cardHeaderText: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  cardDescription: {
    ...typography.caption,
    color: colors.textLight,
  },
  stepsContainer: {
    gap: spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  stepNumberText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '700',
  },
  stepText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    lineHeight: 24,
  },
  footer: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: `${colors.primary}10`,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.md,
  },
  footerText: {
    ...typography.body,
    color: colors.text,
    textAlign: 'center',
  },
});
