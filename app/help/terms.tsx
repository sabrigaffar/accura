import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FileText, CheckCircle } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/theme';

interface TermSection {
  title: string;
  content: string[];
}

const termsData: TermSection[] = [
  {
    title: '1. استخدام التطبيق',
    content: [
      'يجب استخدام التطبيق في أغراض قانونية فقط',
      'يُمنع استخدام التطبيق لأي نشاط غير قانوني أو ضار',
      'يجب أن تكون البيانات المقدمة صحيحة ودقيقة',
      'المستخدم مسؤول عن الحفاظ على سرية حسابه وكلمة المرور',
    ],
  },
  {
    title: '2. الطلبات والتوصيل',
    content: [
      'تُنفذ الطلبات بناءً على توافر الخدمة والمندوبين',
      'أوقات التوصيل المقدرة هي تقريبية وقد تتغير حسب الظروف',
      'التطبيق غير مسؤول عن جودة المنتجات المقدمة من التجار',
      'يمكن إلغاء الطلب قبل بدء التحضير دون رسوم إضافية',
    ],
  },
  {
    title: '3. المسؤولية',
    content: [
      'التطبيق لا يتحمل مسؤولية أي تأخير ناتج عن ظروف خارجة عن الإرادة',
      'التطبيق وسيط بين العميل والتاجر وغير مسؤول عن جودة المنتجات',
      'المستخدم مسؤول عن التحقق من الطلب عند الاستلام',
      'أي نزاع يتم حله وفقاً لسياسات الاسترجاع المعمول بها',
    ],
  },
  {
    title: '4. الأسعار والمدفوعات',
    content: [
      'جميع الأسعار تشمل ضريبة القيمة المضافة',
      'قد تتغير الأسعار حسب المنطقة والتاجر',
      'رسوم التوصيل تُحدد حسب المسافة والطلب',
      'يتم احتساب رسوم الخدمة على كل طلب',
      'المدفوعات آمنة ومحمية وفقاً لمعايير PCI DSS',
    ],
  },
  {
    title: '5. البيانات الشخصية',
    content: [
      'يجب أن تكون جميع البيانات المقدمة صحيحة',
      'التطبيق يحتفظ بحق التحقق من صحة المعلومات',
      'يُمنع مشاركة حسابك مع أشخاص آخرين',
      'أنت مسؤول عن جميع الأنشطة التي تتم من خلال حسابك',
    ],
  },
  {
    title: '6. الإلغاء والاسترجاع',
    content: [
      'يمكن إلغاء الطلب قبل بدء التحضير مجاناً',
      'بعد بدء التحضير، قد تُطبق رسوم إلغاء',
      'لا يمكن إلغاء الطلب بعد خروجه للتوصيل',
      'في حالة وجود مشكلة، يمكن طلب استرجاع خلال 24 ساعة',
    ],
  },
  {
    title: '7. التعديلات على الشروط',
    content: [
      'نحتفظ بحق تعديل هذه الشروط في أي وقت',
      'سيتم إشعار المستخدمين بأي تغييرات جوهرية',
      'استمرار استخدام التطبيق يعني قبول الشروط المحدثة',
    ],
  },
  {
    title: '8. إنهاء الحساب',
    content: [
      'يمكن للمستخدم حذف حسابه في أي وقت',
      'نحتفظ بحق إيقاف أو إنهاء الحسابات المخالفة',
      'عند إنهاء الحساب، تُحذف جميع البيانات الشخصية',
    ],
  },
];

export default function TermsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <FileText size={48} color={colors.primary} />
          <Text style={styles.title}>الشروط والأحكام</Text>
          <Text style={styles.subtitle}>
            يرجى قراءة هذه الشروط بعناية قبل استخدام التطبيق
          </Text>
        </View>

        {/* Last Updated */}
        <View style={styles.updateInfo}>
          <CheckCircle size={16} color={colors.primary} />
          <Text style={styles.updateText}>آخر تحديث: 26 أكتوبر 2025</Text>
        </View>

        {/* Introduction */}
        <View style={styles.introCard}>
          <Text style={styles.introText}>
            مرحباً بك في تطبيقنا. باستخدامك لهذا التطبيق، فإنك توافق على الالتزام بالشروط والأحكام التالية. إذا كنت لا توافق على أي من هذه الشروط، يرجى عدم استخدام التطبيق.
          </Text>
        </View>

        {/* Terms Sections */}
        <View style={styles.sectionsContainer}>
          {termsData.map((section, index) => (
            <View key={index} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.contentList}>
                {section.content.map((item, itemIndex) => (
                  <View key={itemIndex} style={styles.listItem}>
                    <View style={styles.bullet} />
                    <Text style={styles.listItemText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Contact Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerTitle}>تواصل معنا</Text>
          <Text style={styles.footerText}>
            إذا كان لديك أي استفسار بخصوص الشروط والأحكام، يمكنك التواصل معنا عبر:
          </Text>
          <Text style={styles.contactText}>البريد الإلكتروني: legal@app.com</Text>
          <Text style={styles.contactText}>الهاتف: +966-XXX-XXXX</Text>
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
  updateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  updateText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  introCard: {
    backgroundColor: `${colors.primary}10`,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: borderRadius.md,
    borderRightWidth: 4,
    borderRightColor: colors.primary,
  },
  introText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 24,
  },
  sectionsContainer: {
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.small,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  contentList: {
    gap: spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 8,
    marginLeft: spacing.sm,
  },
  listItemText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    lineHeight: 22,
  },
  footer: {
    marginTop: spacing.xl,
    marginHorizontal: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    ...shadows.medium,
  },
  footerTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  footerText: {
    ...typography.body,
    color: colors.textLight,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  contactText: {
    ...typography.body,
    color: colors.text,
    marginTop: spacing.xs,
  },
});
