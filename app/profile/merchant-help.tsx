import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Phone,
  Mail,
  MessageCircle,
  FileText,
  HelpCircle,
  ChevronRight,
  ExternalLink,
} from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

export default function MerchantHelp() {
  const handleCall = () => {
    Linking.openURL('tel:+201001551310');
  };

  const handleEmail = () => {
    Linking.openURL('mailto:sabrigaafar@gmail.com?subject=دعم تطبيق التاجر');
  };

  const handleWhatsApp = () => {
    Linking.openURL('https://wa.me/201001551310');
  };

  const contactOptions = [
    {
      icon: Phone,
      title: 'اتصل بنا',
      description: '+201001551310',
      color: colors.secondary,
      onPress: handleCall,
    },
    {
      icon: Mail,
      title: 'البريد الإلكتروني',
      description: 'sabrigaafar@gmail.com',
      color: colors.primary,
      onPress: handleEmail,
    },
    {
      icon: MessageCircle,
      title: 'واتساب',
      description: '+20 100 155 1310',
      color: '#25D366',
      onPress: handleWhatsApp,
    },
  ];

  const helpTopics = [
    {
      icon: HelpCircle,
      title: 'الأسئلة الشائعة',
      description: 'إجابات على أكثر الأسئلة شيوعاً',
      onPress: () => Alert.alert('قريباً', 'قسم الأسئلة الشائعة قيد التطوير'),
    },
    {
      icon: FileText,
      title: 'دليل التاجر',
      description: 'كيفية استخدام التطبيق',
      onPress: () => Alert.alert('قريباً', 'دليل التاجر قيد التطوير'),
    },
    {
      icon: FileText,
      title: 'الشروط والأحكام',
      description: 'اطلع على شروط الخدمة',
      onPress: () => Alert.alert('قريباً', 'قسم الشروط والأحكام قيد التطوير'),
    },
    {
      icon: FileText,
      title: 'سياسة الخصوصية',
      description: 'كيف نحمي بياناتك',
      onPress: () => Alert.alert('قريباً', 'سياسة الخصوصية قيد التطوير'),
    },
  ];

  const faqData = [
    {
      question: 'كيف أضيف منتج جديد؟',
      answer: 'اذهب إلى تبويب "المنتجات" واضغط على زر "+" لإضافة منتج جديد مع صورة ووصف.',
    },
    {
      question: 'كيف أدير الطلبات؟',
      answer: 'في تبويب "الطلبات" يمكنك قبول/رفض الطلبات وتحديث حالتها حتى تصبح جاهزة للتوصيل.',
    },
    {
      question: 'كيف أتتبع مبيعاتي؟',
      answer: 'تبويب "الإحصائيات" يعرض تقارير شاملة عن المبيعات والطلبات والمنتجات الأكثر مبيعاً.',
    },
    {
      question: 'كيف أغير معلومات المتجر؟',
      answer: 'اذهب إلى "حسابي" ثم "ملف المتجر" لتعديل اسم المتجر، العنوان، وساعات العمل.',
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>المساعدة والدعم</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        {/* Contact Us */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>تواصل معنا</Text>
          <View style={styles.card}>
            {contactOptions.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.contactItem,
                  index === contactOptions.length - 1 && styles.lastItem,
                ]}
                onPress={item.onPress}
              >
                <View style={[styles.contactIcon, { backgroundColor: item.color + '15' }]}>
                  <item.icon size={24} color={item.color} />
                </View>
                <View style={styles.contactContent}>
                  <Text style={styles.contactTitle}>{item.title}</Text>
                  <Text style={styles.contactDescription}>{item.description}</Text>
                </View>
                <ExternalLink size={20} color={colors.textLight} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Help Topics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>مواضيع المساعدة</Text>
          <View style={styles.card}>
            {helpTopics.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.helpItem,
                  index === helpTopics.length - 1 && styles.lastItem,
                ]}
                onPress={item.onPress}
              >
                <View style={styles.helpIcon}>
                  <item.icon size={20} color={colors.primary} />
                </View>
                <View style={styles.helpContent}>
                  <Text style={styles.helpTitle}>{item.title}</Text>
                  <Text style={styles.helpDescription}>{item.description}</Text>
                </View>
                <ChevronRight size={20} color={colors.textLight} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick FAQ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>أسئلة شائعة</Text>
          <View style={styles.card}>
            {faqData.map((item, index) => (
              <View
                key={index}
                style={[
                  styles.faqItem,
                  index === faqData.length - 1 && styles.lastItem,
                ]}
              >
                <Text style={styles.faqQuestion}>س: {item.question}</Text>
                <Text style={styles.faqAnswer}>ج: {item.answer}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Working Hours */}
        <View style={styles.infoBox}>
          <HelpCircle size={20} color={colors.primary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>ساعات العمل</Text>
            <Text style={styles.infoText}>
              فريق الدعم متاح من السبت إلى الخميس{'\n'}
              من 9 صباحاً إلى 9 مساءً
            </Text>
          </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    fontSize: 16,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  contactIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  contactContent: {
    flex: 1,
  },
  contactTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  contactDescription: {
    ...typography.caption,
    color: colors.textLight,
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  helpIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  helpContent: {
    flex: 1,
  },
  helpTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  helpDescription: {
    ...typography.caption,
    color: colors.textLight,
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  faqItem: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  faqQuestion: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  faqAnswer: {
    ...typography.body,
    color: colors.textLight,
    lineHeight: 20,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primary + '10',
    padding: spacing.lg,
    margin: spacing.lg,
    borderRadius: borderRadius.md,
    gap: spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    ...typography.bodyMedium,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  infoText: {
    ...typography.caption,
    color: colors.primary,
    lineHeight: 18,
  },
});
