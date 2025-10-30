import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Shield, Database, Lock, Eye, UserX, Scale } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/theme';

interface PrivacySection {
  icon: any;
  title: string;
  content: string[];
}

const privacyData: PrivacySection[] = [
  {
    icon: Database,
    title: 'جمع البيانات',
    content: [
      'نجمع فقط البيانات الضرورية لتقديم خدماتنا',
      'البيانات الشخصية: الاسم، البريد الإلكتروني، رقم الهاتف',
      'بيانات الموقع: لتحديد عنوان التوصيل وتتبع الطلبات',
      'بيانات الجهاز: نوع الجهاز، نظام التشغيل، معرف الجهاز',
      'بيانات الاستخدام: الصفحات المزارة، الوقت المستغرق، الطلبات',
    ],
  },
  {
    icon: Eye,
    title: 'استخدام البيانات',
    content: [
      'تقديم وتحسين خدماتنا',
      'معالجة الطلبات وإتمام عمليات الدفع',
      'إرسال إشعارات حول حالة الطلب',
      'التواصل معك بخصوص حسابك أو خدماتنا',
      'تحليل استخدام التطبيق لتحسين التجربة',
      'منع الاحتيال وضمان أمان المنصة',
    ],
  },
  {
    icon: UserX,
    title: 'مشاركة البيانات',
    content: [
      'لا نبيع أو نؤجر بياناتك الشخصية لأطراف ثالثة',
      'نشارك البيانات فقط مع: التجار، السائقين، معالجي الدفع',
      'قد نشارك البيانات إذا تطلب القانون ذلك',
      'في حالة اندماج الشركة، قد تُنقل البيانات للشركة الجديدة',
      'نستخدم خدمات سحابية آمنة (Supabase) لتخزين البيانات',
    ],
  },
  {
    icon: Lock,
    title: 'حماية البيانات',
    content: [
      'نستخدم تشفير SSL/TLS لحماية البيانات أثناء النقل',
      'التخزين الآمن في خوادم محمية مع نسخ احتياطي منتظم',
      'الوصول للبيانات محدود للموظفين المصرح لهم فقط',
      'نراقب الأنظمة باستمرار للكشف عن أي نشاط مشبوه',
      'نطبق سياسات قوية لكلمات المرور والمصادقة',
    ],
  },
  {
    icon: UserX,
    title: 'حقوق المستخدم',
    content: [
      'الوصول: يمكنك طلب نسخة من بياناتك الشخصية',
      'التصحيح: يمكنك تحديث أو تصحيح بياناتك',
      'الحذف: يمكنك طلب حذف حسابك وبياناتك',
      'الاعتراض: يمكنك الاعتراض على معالجة بياناتك',
      'النقل: يمكنك طلب نقل بياناتك لخدمة أخرى',
      'السحب: يمكنك سحب موافقتك على معالجة البيانات',
    ],
  },
  {
    icon: Scale,
    title: 'الامتثال القانوني',
    content: [
      'نلتزم بقوانين حماية البيانات المحلية والدولية',
      'نطبق مبادئ GDPR في معالجة البيانات',
      'نحترم خصوصية الأطفال ولا نجمع بياناتهم عمداً',
      'نحتفظ بالبيانات فقط للمدة الضرورية',
      'نراجع ونحدث سياساتنا بانتظام',
    ],
  },
];

export default function PrivacyPolicyScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Shield size={48} color={colors.primary} />
          <Text style={styles.title}>سياسة الخصوصية</Text>
          <Text style={styles.subtitle}>
            نحن نحترم خصوصيتك ونحمي بياناتك الشخصية
          </Text>
        </View>

        {/* Last Updated */}
        <View style={styles.updateInfo}>
          <Text style={styles.updateText}>آخر تحديث: 26 أكتوبر 2025</Text>
        </View>

        {/* Introduction */}
        <View style={styles.introCard}>
          <Text style={styles.introText}>
            هذه السياسة توضح كيف نجمع ونستخدم ونحمي بياناتك الشخصية عند استخدامك لتطبيقنا. نحن ملتزمون بحماية خصوصيتك وضمان أمان معلوماتك.
          </Text>
        </View>

        {/* Privacy Sections */}
        <View style={styles.sectionsContainer}>
          {privacyData.map((section, index) => (
            <View key={index} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.iconContainer}>
                  <section.icon size={24} color={colors.primary} />
                </View>
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
              
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

        {/* Cookies Section */}
        <View style={styles.cookiesCard}>
          <Text style={styles.cookiesTitle}>ملفات تعريف الارتباط (Cookies)</Text>
          <Text style={styles.cookiesText}>
            نستخدم ملفات تعريف الارتباط وتقنيات مماثلة لتحسين تجربتك وتحليل استخدام التطبيق. يمكنك التحكم في الكوكيز من إعدادات المتصفح.
          </Text>
        </View>

        {/* Contact Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerTitle}>تواصل معنا بشأن الخصوصية</Text>
          <Text style={styles.footerText}>
            إذا كان لديك أي استفسار أو طلب بخصوص خصوصيتك وبياناتك:
          </Text>
          <Text style={styles.contactText}>البريد الإلكتروني: privacy@app.com</Text>
          <Text style={styles.contactText}>الهاتف: +966-XXX-XXXX</Text>
          <Text style={styles.footerNote}>
            نلتزم بالرد على جميع الطلبات خلال 30 يوماً
          </Text>
        </View>

        {/* Changes Notice */}
        <View style={styles.changesNotice}>
          <Text style={styles.changesText}>
            قد نقوم بتحديث هذه السياسة من وقت لآخر. سنقوم بإشعارك بأي تغييرات جوهرية عبر التطبيق أو البريد الإلكتروني.
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
  updateInfo: {
    alignItems: 'center',
    paddingVertical: spacing.md,
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
    gap: spacing.md,
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.small,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
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
  cookiesCard: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    ...shadows.small,
  },
  cookiesTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  cookiesText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },
  footer: {
    marginTop: spacing.lg,
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
  footerNote: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: spacing.md,
    fontStyle: 'italic',
  },
  changesNotice: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.md,
    padding: spacing.md,
    backgroundColor: `${colors.warning}15`,
    borderRadius: borderRadius.md,
    borderRightWidth: 3,
    borderRightColor: colors.warning,
  },
  changesText: {
    ...typography.caption,
    color: colors.text,
    lineHeight: 20,
  },
});
