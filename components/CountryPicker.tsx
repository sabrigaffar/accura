import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';

// قائمة شاملة برموز البلدان مع أسمائها بالعربية
const COUNTRIES = [
  { code: '+93', name: 'أفغانستان', flag: '🇦🇫' },
  { code: '+355', name: 'ألبانيا', flag: '🇦🇱' },
  { code: '+213', name: 'الجزائر', flag: '🇩🇿' },
  { code: '+376', name: 'أندورا', flag: '🇦🇩' },
  { code: '+244', name: 'أنغولا', flag: '🇦🇴' },
  { code: '+54', name: 'الأرجنتين', flag: '🇦🇷' },
  { code: '+374', name: 'أرمينيا', flag: '🇦🇲' },
  { code: '+297', name: 'أروبا', flag: '🇦🇼' },
  { code: '+61', name: 'أستراليا', flag: '🇦🇺' },
  { code: '+43', name: 'النمسا', flag: '🇦🇹' },
  { code: '+994', name: 'أذربيجان', flag: '🇦🇿' },
  { code: '+973', name: 'البحرين', flag: '🇧🇭' },
  { code: '+880', name: 'بنغلاديش', flag: '🇧🇩' },
  { code: '+375', name: 'بيلاروس', flag: '🇧🇾' },
  { code: '+32', name: 'بلجيكا', flag: '🇧🇪' },
  { code: '+501', name: 'بليز', flag: '🇧🇿' },
  { code: '+229', name: 'بنين', flag: '🇧🇯' },
  { code: '+975', name: 'بوتان', flag: '🇧🇹' },
  { code: '+591', name: 'بوليفيا', flag: '🇧🇴' },
  { code: '+387', name: 'البوسنة والهرسك', flag: '🇧🇦' },
  { code: '+267', name: 'بوتسوانا', flag: '🇧🇼' },
  { code: '+55', name: 'البرازيل', flag: '🇧🇷' },
  { code: '+673', name: 'بروناي', flag: '🇧🇳' },
  { code: '+359', name: 'بلغاريا', flag: '🇧🇬' },
  { code: '+226', name: 'بوركينا فاسو', flag: '🇧🇫' },
  { code: '+257', name: 'بوروندي', flag: '🇧🇮' },
  { code: '+855', name: 'كمبوديا', flag: '🇰🇭' },
  { code: '+237', name: 'الكاميرون', flag: '🇨🇲' },
  { code: '+1', name: 'كندا', flag: '🇨🇦' },
  { code: '+238', name: 'الرأس الأخضر', flag: '🇨🇻' },
  { code: '+236', name: 'جمهورية أفريقيا الوسطى', flag: '🇨🇫' },
  { code: '+235', name: 'تشاد', flag: '🇹🇩' },
  { code: '+56', name: 'تشيلي', flag: '🇨🇱' },
  { code: '+86', name: 'الصين', flag: '🇨🇳' },
  { code: '+57', name: 'كولومبيا', flag: '🇨🇴' },
  { code: '+269', name: 'جزر القمر', flag: '🇰🇲' },
  { code: '+242', name: 'جمهورية الكونغو', flag: '🇨🇬' },
  { code: '+243', name: 'جمهورية الكونغو الديمقراطية', flag: '🇨🇩' },
  { code: '+506', name: 'كوستاريكا', flag: '🇨🇷' },
  { code: '+385', name: 'كرواتيا', flag: '🇭🇷' },
  { code: '+53', name: 'كوبا', flag: '🇨🇺' },
  { code: '+357', name: 'قبرص', flag: '🇨🇾' },
  { code: '+420', name: 'التشيك', flag: '🇨🇿' },
  { code: '+45', name: 'الدنمارك', flag: '🇩🇰' },
  { code: '+253', name: 'جيبوتي', flag: '🇩🇯' },
  { code: '+593', name: 'الإكوادور', flag: '🇪🇨' },
  { code: '+20', name: 'مصر', flag: '🇪🇬' },
  { code: '+503', name: 'السلفادور', flag: '🇸🇻' },
  { code: '+240', name: 'غينيا الاستوائية', flag: '🇬🇶' },
  { code: '+291', name: 'إريتريا', flag: '🇪🇷' },
  { code: '+372', name: 'إستونيا', flag: '🇪🇪' },
  { code: '+251', name: 'إثيوبيا', flag: '🇪🇹' },
  { code: '+298', name: 'جزر فارو', flag: '🇫🇴' },
  { code: '+679', name: 'فيجي', flag: '🇫🇯' },
  { code: '+358', name: 'فنلندا', flag: '🇫🇮' },
  { code: '+33', name: 'فرنسا', flag: '🇫🇷' },
  { code: '+241', name: 'الغابون', flag: '🇬🇦' },
  { code: '+220', name: 'غامبيا', flag: '🇬🇲' },
  { code: '+995', name: 'جورجيا', flag: '🇬🇪' },
  { code: '+49', name: 'ألمانيا', flag: '🇩🇪' },
  { code: '+233', name: 'غانا', flag: '🇬🇭' },
  { code: '+30', name: 'اليونان', flag: '🇬🇷' },
  { code: '+299', name: 'غرينلاند', flag: '🇬🇱' },
  { code: '+502', name: 'غواتيمالا', flag: '🇬🇹' },
  { code: '+224', name: 'غينيا', flag: '🇬🇳' },
  { code: '+245', name: 'غينيا بيساو', flag: '🇬🇼' },
  { code: '+592', name: 'غيانا', flag: '🇬🇾' },
  { code: '+509', name: 'هايتي', flag: '🇭🇹' },
  { code: '+504', name: 'هندوراس', flag: '🇭🇳' },
  { code: '+852', name: 'هونغ كونغ', flag: '🇭🇰' },
  { code: '+36', name: 'المجر', flag: '🇭🇺' },
  { code: '+354', name: 'آيسلندا', flag: '🇮🇸' },
  { code: '+91', name: 'الهند', flag: '🇮🇳' },
  { code: '+62', name: 'إندونيسيا', flag: '🇮🇩' },
  { code: '+98', name: 'إيران', flag: '🇮🇷' },
  { code: '+964', name: 'العراق', flag: '🇮🇶' },
  { code: '+353', name: 'أيرلندا', flag: '🇮🇪' },
  { code: '+972', name: 'إسرائيل', flag: '🇮🇱' },
  { code: '+39', name: 'إيطاليا', flag: '🇮🇹' },
  { code: '+225', name: 'ساحل العاج', flag: '🇨🇮' },
  { code: '+81', name: 'اليابان', flag: '🇯🇵' },
  { code: '+962', name: 'الأردن', flag: '🇯🇴' },
  { code: '+7', name: 'كازاخستان', flag: '🇰🇿' },
  { code: '+254', name: 'كينيا', flag: '🇰🇪' },
  { code: '+686', name: 'كيريباتي', flag: '🇰🇮' },
  { code: '+965', name: 'الكويت', flag: '🇰🇼' },
  { code: '+996', name: 'قيرغيزستان', flag: '🇰🇬' },
  { code: '+856', name: 'لاوس', flag: '🇱🇦' },
  { code: '+371', name: 'لاتفيا', flag: '🇱🇻' },
  { code: '+961', name: 'لبنان', flag: '🇱🇧' },
  { code: '+266', name: 'ليسوتو', flag: '🇱🇸' },
  { code: '+231', name: 'ليبيريا', flag: '🇱🇷' },
  { code: '+218', name: 'ليبيا', flag: '🇱🇾' },
  { code: '+423', name: 'ليختنشتاين', flag: '🇱🇮' },
  { code: '+370', name: 'ليتوانيا', flag: '🇱🇹' },
  { code: '+352', name: 'لوكسمبورغ', flag: '🇱🇺' },
  { code: '+853', name: 'ماكاو', flag: '🇲🇴' },
  { code: '+389', name: 'مقدونيا', flag: '🇲🇰' },
  { code: '+261', name: 'مدغشقر', flag: '🇲🇬' },
  { code: '+265', name: 'ملاوي', flag: '🇲🇼' },
  { code: '+60', name: 'ماليزيا', flag: '🇲🇾' },
  { code: '+960', name: 'جزر المالديف', flag: '🇲🇻' },
  { code: '+223', name: 'مالي', flag: '🇲🇱' },
  { code: '+356', name: 'مالطا', flag: '🇲🇹' },
  { code: '+692', name: 'جزر مارشال', flag: '🇲🇭' },
  { code: '+222', name: 'موريتانيا', flag: '🇲🇷' },
  { code: '+230', name: 'موريشيوس', flag: '🇲🇺' },
  { code: '+52', name: 'المكسيك', flag: '🇲🇽' },
  { code: '+691', name: 'ولايات ميكرونيسيا المتحدة', flag: '🇫🇲' },
  { code: '+373', name: 'مولدوفا', flag: '🇲🇩' },
  { code: '+377', name: 'موناكو', flag: '🇲🇨' },
  { code: '+976', name: 'منغوليا', flag: '🇲🇳' },
  { code: '+382', name: 'الجبل الأسود', flag: '🇲🇪' },
  { code: '+212', name: 'المغرب', flag: '🇲🇦' },
  { code: '+258', name: 'موزمبيق', flag: '🇲🇿' },
  { code: '+95', name: 'ميانمار', flag: '🇲🇲' },
  { code: '+264', name: 'ناميبيا', flag: '🇳🇦' },
  { code: '+674', name: 'ناورو', flag: '🇳🇷' },
  { code: '+977', name: 'نيبال', flag: '🇳🇵' },
  { code: '+31', name: 'هولندا', flag: '🇳🇱' },
  { code: '+64', name: 'نيوزيلندا', flag: '🇳🇿' },
  { code: '+505', name: 'نيكاراغوا', flag: '🇳🇮' },
  { code: '+227', name: 'النيجر', flag: '🇳🇪' },
  { code: '+234', name: 'نيجيريا', flag: '🇳🇬' },
  { code: '+47', name: 'النرويج', flag: '🇳🇴' },
  { code: '+968', name: 'عمان', flag: '🇴🇲' },
  { code: '+92', name: 'باكستان', flag: '🇵🇰' },
  { code: '+680', name: 'بالاو', flag: '🇵🇼' },
  { code: '+970', name: 'فلسطين', flag: '🇵🇸' },
  { code: '+507', name: 'بنما', flag: '🇵🇦' },
  { code: '+675', name: 'بابوا غينيا الجديدة', flag: '🇵🇬' },
  { code: '+595', name: 'باراغواي', flag: '🇵🇾' },
  { code: '+51', name: 'بيرو', flag: '🇵🇪' },
  { code: '+63', name: 'الفلبين', flag: '🇵🇭' },
  { code: '+48', name: 'بولندا', flag: '🇵🇱' },
  { code: '+351', name: 'البرتغال', flag: '🇵🇹' },
  { code: '+974', name: 'قطر', flag: '🇶🇦' },
  { code: '+40', name: 'رومانيا', flag: '🇷🇴' },
  { code: '+7', name: 'روسيا', flag: '🇷🇺' },
  { code: '+250', name: 'رواندا', flag: '🇷🇼' },
  { code: '+685', name: 'ساموا', flag: '🇼🇸' },
  { code: '+378', name: 'سان مارينو', flag: '🇸🇲' },
  { code: '+239', name: 'ساو تومي وبرينسيب', flag: '🇸🇹' },
  { code: '+966', name: 'السعودية', flag: '🇸🇦' },
  { code: '+221', name: 'السنغال', flag: '🇸🇳' },
  { code: '+381', name: 'صربيا', flag: '🇷🇸' },
  { code: '+248', name: 'سيشل', flag: '🇸🇨' },
  { code: '+232', name: 'سيراليون', flag: '🇸🇱' },
  { code: '+65', name: 'سنغافورة', flag: '🇸🇬' },
  { code: '+421', name: 'سلوفاكيا', flag: '🇸🇰' },
  { code: '+386', name: 'سلوفينيا', flag: '🇸🇮' },
  { code: '+677', name: 'جزر سليمان', flag: '🇸🇧' },
  { code: '+252', name: 'الصومال', flag: '🇸🇴' },
  { code: '+27', name: 'جنوب أفريقيا', flag: '🇿🇦' },
  { code: '+82', name: 'كوريا الجنوبية', flag: '🇰🇷' },
  { code: '+34', name: 'إسبانيا', flag: '🇪🇸' },
  { code: '+94', name: 'سريلانكا', flag: '🇱🇰' },
  { code: '+249', name: 'السودان', flag: '🇸🇩' },
  { code: '+597', name: 'سورينام', flag: '🇸🇷' },
  { code: '+268', name: 'إسواتيني', flag: '🇸🇿' },
  { code: '+46', name: 'السويد', flag: '🇸🇪' },
  { code: '+41', name: 'سويسرا', flag: '🇨🇭' },
  { code: '+963', name: 'سوريا', flag: '🇸🇾' },
  { code: '+886', name: 'تايوان', flag: '🇹🇼' },
  { code: '+992', name: 'طاجيكستان', flag: '🇹🇯' },
  { code: '+255', name: 'تنزانيا', flag: '🇹🇿' },
  { code: '+66', name: 'تايلاند', flag: '🇹🇭' },
  { code: '+228', name: 'توغو', flag: '🇹🇬' },
  { code: '+690', name: 'توكيلاو', flag: '🇹🇰' },
  { code: '+676', name: 'تونغا', flag: '🇹🇴' },
  { code: '+216', name: 'تونس', flag: '🇹🇳' },
  { code: '+90', name: 'تركيا', flag: '🇹🇷' },
  { code: '+993', name: 'تركمانستان', flag: '🇹🇲' },
  { code: '+688', name: 'توفالو', flag: '🇹🇻' },
  { code: '+256', name: 'أوغندا', flag: '🇺🇬' },
  { code: '+380', name: 'أوكرانيا', flag: '🇺🇦' },
  { code: '+971', name: 'الإمارات العربية المتحدة', flag: '🇦🇪' },
  { code: '+44', name: 'المملكة المتحدة', flag: '🇬🇧' },
  { code: '+1', name: 'الولايات المتحدة', flag: '🇺🇸' },
  { code: '+598', name: 'أوروغواي', flag: '🇺🇾' },
  { code: '+998', name: 'أوزبكستان', flag: '🇺🇿' },
  { code: '+678', name: 'فانواتو', flag: '🇻🇺' },
  { code: '+58', name: 'فنزويلا', flag: '🇻🇪' },
  { code: '+84', name: 'فيتنام', flag: '🇻🇳' },
  { code: '+967', name: 'اليمن', flag: '🇾🇪' },
  { code: '+260', name: 'زامبيا', flag: '🇿🇲' },
  { code: '+263', name: 'زيمبابوي', flag: '🇿🇼' },
];

interface CountryPickerProps {
  selectedCountry: { code: string; name: string; flag: string };
  onCountrySelect: (country: { code: string; name: string; flag: string }) => void;
}

export default function CountryPicker({ selectedCountry, onCountrySelect }: CountryPickerProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCountries = COUNTRIES.filter(country =>
    country.name.includes(searchQuery) || country.code.includes(searchQuery)
  );

  const renderCountryItem = ({ item }: { item: { code: string; name: string; flag: string } }) => (
    <TouchableOpacity
      style={styles.countryItem}
      onPress={() => {
        onCountrySelect(item);
        setModalVisible(false);
      }}
    >
      <Text style={styles.countryFlag}>{item.flag}</Text>
      <View style={styles.countryInfo}>
        <Text style={styles.countryName}>{item.name}</Text>
        <Text style={styles.countryCode}>{item.code}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View>
      <TouchableOpacity
        style={styles.selectedCountry}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.selectedCountryFlag}>{selectedCountry.flag}</Text>
        <Text style={styles.selectedCountryCode}>{selectedCountry.code}</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>اختر البلد</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>إغلاق</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="ابحث عن البلد..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={colors.textLight}
            />
          </View>

          <FlatList
            data={filteredCountries}
            renderItem={renderCountryItem}
            keyExtractor={(item) => item.code}
            style={styles.countriesList}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  selectedCountry: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.lightGray,
    minWidth: 80,
  },
  selectedCountryFlag: {
    fontSize: 20,
    marginRight: spacing.xs,
  },
  selectedCountryCode: {
    ...typography.body,
    color: colors.text,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
  },
  closeButton: {
    padding: spacing.sm,
  },
  closeButtonText: {
    ...typography.body,
    color: colors.primary,
  },
  searchContainer: {
    padding: spacing.md,
    backgroundColor: colors.white,
  },
  searchInput: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.lightGray,
  },
  countriesList: {
    flex: 1,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  countryFlag: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  countryInfo: {
    flex: 1,
  },
  countryName: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  countryCode: {
    ...typography.caption,
    color: colors.textLight,
  },
});