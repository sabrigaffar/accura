import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/theme';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const faqData: FAQItem[] = [
  {
    category: 'الحساب والتسجيل',
    question: 'كيف أنشئ حساب جديد؟',
    answer: 'يمكنك إنشاء حساب بإدخال بريدك الإلكتروني أو رقم هاتفك مع كلمة مرور قوية. ثم أكمل بياناتك الشخصية وابدأ في استخدام التطبيق فوراً.',
  },
  {
    category: 'الحساب والتسجيل',
    question: 'نسيت كلمة المرور، ماذا أفعل؟',
    answer: 'اضغط على "نسيت كلمة المرور" في صفحة تسجيل الدخول، ثم اختر استرجاع عبر البريد الإلكتروني أو رقم الهاتف. ستصلك تعليمات لإعادة تعيين كلمة المرور.',
  },
  {
    category: 'الحساب والتسجيل',
    question: 'هل يمكنني تغيير رقم هاتفي أو بريدي الإلكتروني؟',
    answer: 'نعم، يمكنك تحديث بياناتك من صفحة "الحساب" في البروفايل. قد يتطلب ذلك التحقق من الرقم أو البريد الجديد.',
  },
  {
    category: 'الطلبات والتوصيل',
    question: 'كم يستغرق التوصيل؟',
    answer: 'عادةً يستغرق التوصيل من 30-60 دقيقة حسب المسافة وازدحام الطرق. يمكنك تتبع طلبك لحظة بلحظة عبر التطبيق.',
  },
  {
    category: 'الطلبات والتوصيل',
    question: 'هل يمكنني إلغاء الطلب؟',
    answer: 'نعم، يمكنك إلغاء الطلب مجاناً قبل بدء التحضير. بعد بدء التحضير، قد تُطبق رسوم إلغاء. لا يمكن الإلغاء بعد خروج الطلب للتوصيل.',
  },
  {
    category: 'الطلبات والتوصيل',
    question: 'كيف أتتبع طلبي؟',
    answer: 'افتح صفحة "طلباتي" واختر الطلب المطلوب. ستشاهد حالة الطلب الحالية وموقع السائق على الخريطة مع وقت الوصول المتوقع.',
  },
  {
    category: 'الطلبات والتوصيل',
    question: 'ماذا أفعل إذا تأخر الطلب؟',
    answer: 'يمكنك التواصل مع السائق مباشرة عبر التطبيق. إذا كان التأخير كبيراً جداً، تواصل مع الدعم الفني وسنساعدك.',
  },
  {
    category: 'الدفع',
    question: 'ما هي طرق الدفع المتاحة؟',
    answer: 'نوفر عدة خيارات: الدفع نقداً عند الاستلام، بطاقة الائتمان/الخصم، أو المحفظة الإلكترونية. جميع المدفوعات آمنة ومحمية.',
  },
  {
    category: 'الدفع',
    question: 'هل المدفوعات الإلكترونية آمنة؟',
    answer: 'نعم، نستخدم أعلى معايير الأمان (PCI DSS) وتشفير SSL لحماية بياناتك المالية. لا نحتفظ بتفاصيل بطاقتك على خوادمنا.',
  },
  {
    category: 'الدفع',
    question: 'لماذا تم رفض بطاقتي؟',
    answer: 'قد يحدث ذلك لعدة أسباب: رصيد غير كافٍ، بطاقة منتهية، أو قيود من البنك. تحقق من البطاقة أو جرب طريقة دفع أخرى.',
  },
  {
    category: 'المشاكل والشكاوى',
    question: 'الطلب وصل بشكل خاطئ أو ناقص',
    answer: 'نأسف لذلك! افتح تفاصيل الطلب واضغط "الإبلاغ عن مشكلة". سنراجع الطلب ونحل المشكلة خلال 24 ساعة.',
  },
  {
    category: 'المشاكل والشكاوى',
    question: 'كيف أقيّم تجربتي؟',
    answer: 'بعد استلام الطلب، ستظهر لك خيار التقييم. يمكنك تقييم التاجر والسائق من 1-5 نجوم وكتابة ملاحظات.',
  },
  {
    category: 'المشاكل والشكاوى',
    question: 'كيف أتواصل مع الدعم الفني؟',
    answer: 'يمكنك التواصل معنا عبر الدردشة المباشرة في التطبيق، أو البريد الإلكتروني، أو الهاتف. نرد على جميع الاستفسارات خلال 24 ساعة.',
  },
  {
    category: 'الحساب',
    question: 'كيف أحذف حسابي؟',
    answer: 'من صفحة الإعدادات، اختر "حذف الحساب". سيتم حذف جميع بياناتك الشخصية نهائياً. هذا الإجراء لا يمكن التراجع عنه.',
  },
  {
    category: 'عام',
    question: 'هل التطبيق مجاني؟',
    answer: 'التطبيق مجاني للتحميل والاستخدام. نحن نفرض رسوم خدمة صغيرة على كل طلب لتغطية تكاليف التشغيل والتوصيل.',
  },
];

const categories = Array.from(new Set(faqData.map(item => item.category)));

export default function FAQScreen() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');

  const filteredFAQ = selectedCategory === 'الكل' 
    ? faqData 
    : faqData.filter(item => item.category === selectedCategory);

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <HelpCircle size={48} color={colors.primary} />
          <Text style={styles.title}>الأسئلة الشائعة</Text>
          <Text style={styles.subtitle}>
            إجابات سريعة على أكثر الأسئلة شيوعاً
          </Text>
        </View>

        {/* Category Filter */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesScroll}
          contentContainerStyle={styles.categoriesContainer}
        >
          <TouchableOpacity
            style={[
              styles.categoryChip,
              selectedCategory === 'الكل' && styles.categoryChipActive
            ]}
            onPress={() => setSelectedCategory('الكل')}
          >
            <Text style={[
              styles.categoryChipText,
              selectedCategory === 'الكل' && styles.categoryChipTextActive
            ]}>
              الكل
            </Text>
          </TouchableOpacity>
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryChip,
                selectedCategory === category && styles.categoryChipActive
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text style={[
                styles.categoryChipText,
                selectedCategory === category && styles.categoryChipTextActive
              ]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* FAQ Items */}
        <View style={styles.faqContainer}>
          {filteredFAQ.map((item, index) => (
            <View key={index} style={styles.faqItem}>
              <TouchableOpacity
                style={styles.questionContainer}
                onPress={() => toggleExpand(index)}
                activeOpacity={0.7}
              >
                <View style={styles.questionContent}>
                  <Text style={styles.questionText}>{item.question}</Text>
                  {expandedIndex === index ? (
                    <ChevronUp size={20} color={colors.primary} />
                  ) : (
                    <ChevronDown size={20} color={colors.textLight} />
                  )}
                </View>
              </TouchableOpacity>
              
              {expandedIndex === index && (
                <View style={styles.answerContainer}>
                  <Text style={styles.answerText}>{item.answer}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Contact Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerTitle}>لم تجد إجابة؟</Text>
          <Text style={styles.footerText}>
            تواصل معنا عبر الدعم الفني وسنساعدك خلال 24 ساعة
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
  categoriesScroll: {
    marginTop: spacing.md,
  },
  categoriesContainer: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    ...typography.body,
    color: colors.text,
  },
  categoryChipTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  faqContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  faqItem: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    ...shadows.small,
  },
  questionContainer: {
    padding: spacing.md,
  },
  questionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  questionText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
    marginLeft: spacing.sm,
  },
  answerContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  answerText: {
    ...typography.body,
    color: colors.textLight,
    lineHeight: 22,
  },
  footer: {
    marginTop: spacing.xl,
    marginHorizontal: spacing.md,
    padding: spacing.lg,
    backgroundColor: `${colors.primary}10`,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  footerTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  footerText: {
    ...typography.body,
    color: colors.textLight,
    textAlign: 'center',
  },
});
