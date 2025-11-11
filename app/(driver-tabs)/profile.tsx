import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Truck, LogOut, Settings, Bell, HelpCircle, Key } from 'lucide-react-native';
import { spacing, typography, borderRadius } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';

export default function DriverProfile() {
  const { profile, user, signOut } = useAuth();
  const { theme } = useTheme();
  const colors = theme;
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = React.useState(false);
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        if (!user?.id) return;
        const { data: prof } = await supabase
          .from('profiles')
          .select('avatar_url, full_name')
          .eq('id', user.id)
          .single();
        const { data: dprof } = await supabase
          .from('driver_profiles')
          .select('photo_url')
          .eq('id', user.id)
          .single();
        setAvatarUrl(prof?.avatar_url ?? null);
        setPhotoUrl(dprof?.photo_url ?? null);
      } catch (e) {
        console.warn('load driver images error', e);
      }
    })();
  }, [user?.id]);

  const pickAndUpload = async (target: 'avatar' | 'driver', source: 'library' | 'camera' = 'library') => {
    try {
      let res: ImagePicker.ImagePickerResult;
      if (source === 'library') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status !== 'granted') {
          Alert.alert('إذن الصور مطلوب', 'يرجى منح إذن الوصول للصور لاختيار صورة.');
          return;
        }
        res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
      } else {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (perm.status !== 'granted') {
          Alert.alert('إذن الكاميرا مطلوب', 'يرجى منح إذن الكاميرا لالتقاط صورة.');
          return;
        }
        res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      }
      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const asset = res.assets[0];
      if (!asset.uri) return;

      setLoading(true);
      // رفع إلى تخزين Supabase
      const ext = asset.fileName?.split('.').pop() || 'jpg';
      const fileName = `${user?.id}_${target}_${Date.now()}.${ext}`;
      const bucket = 'driver-photos';

      // احصل على البيانات كـ Base64 ثم حوّلها إلى ArrayBuffer (أفضل أسلوب مع React Native)
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' as any });

      // محول Base64 -> ArrayBuffer بدون الاعتماد على مكتبات خارجية
      const base64ToArrayBuffer = (b64: string): ArrayBuffer => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        let bufferLength = b64.length * 0.75;
        if (b64.endsWith('==')) bufferLength -= 2;
        else if (b64.endsWith('=')) bufferLength -= 1;
        const bytes = new Uint8Array(bufferLength);
        let encoded1, encoded2, encoded3, encoded4;
        let p = 0;
        for (let i = 0; i < b64.length; i += 4) {
          encoded1 = chars.indexOf(b64[i]);
          encoded2 = chars.indexOf(b64[i + 1]);
          encoded3 = chars.indexOf(b64[i + 2]);
          encoded4 = chars.indexOf(b64[i + 3]);
          const triplet = (encoded1 << 18) | (encoded2 << 12) | ((encoded3 & 63) << 6) | (encoded4 & 63);
          if (b64[i + 2] === '=') {
            bytes[p++] = (triplet >> 16) & 0xff;
          } else if (b64[i + 3] === '=') {
            bytes[p++] = (triplet >> 16) & 0xff;
            bytes[p++] = (triplet >> 8) & 0xff;
          } else {
            bytes[p++] = (triplet >> 16) & 0xff;
            bytes[p++] = (triplet >> 8) & 0xff;
            bytes[p++] = triplet & 0xff;
          }
        }
        return bytes.buffer;
      };

      const arrayBuffer = base64ToArrayBuffer(base64);

      // احفظ داخل مجلد المستخدم ليتوافق مع سياسة RLS
      const objectPath = `${user?.id}/${fileName}`;
      const contentType = asset.mimeType || (ext.toLowerCase() === 'png' ? 'image/png' : 'image/jpeg');
      const { error: uploadErr } = await supabase.storage.from(bucket).upload(objectPath, arrayBuffer, {
        cacheControl: '3600',
        upsert: true,
        contentType,
      });
      if (uploadErr) {
        console.error('upload error', uploadErr);
        Alert.alert('خطأ', 'فشل رفع الصورة. تأكد من وجود الحاوية driver-photos وأنها عامة.');
        return;
      }

      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(objectPath);
      const publicUrl = pub?.publicUrl;
      if (!publicUrl) {
        Alert.alert('خطأ', 'تعذر إنشاء رابط عام للصورة.');
        return;
      }

      if (target === 'avatar') {
        await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user?.id);
        setAvatarUrl(publicUrl);
      } else {
        await supabase.from('driver_profiles').update({ photo_url: publicUrl }).eq('id', user?.id);
        setPhotoUrl(publicUrl);
      }

      Alert.alert('تم', 'تم تحديث صورتك بنجاح');
    } catch (e) {
      console.error('pick/upload error', e);
      Alert.alert('خطأ', 'حدث خطأ أثناء رفع الصورة');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'تسجيل الخروج',
      'هل أنت متأكد من تسجيل الخروج؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تسجيل الخروج',
          style: 'destructive',
          onPress: async () => {
            router.replace('/auth');
            setTimeout(() => { signOut(); }, 0);
          }
        }
      ]
    );
  };

  const menuItems = [
    {
      icon: User,
      title: 'معلومات الحساب',
      subtitle: 'البريد الإلكتروني ورقم الهاتف',
      onPress: () => router.push('/profile/driver-account-info' as any),
    },
    {
      icon: Key,
      title: 'تغيير كلمة المرور',
      subtitle: 'تحديث كلمة مرور حسابك',
      onPress: () => router.push('/settings/change-password' as any),
    },
    {
      icon: Bell,
      title: 'الإشعارات',
      subtitle: 'إدارة إشعاراتك',
      onPress: () => router.push('/profile/driver-notifications' as any),
    },
    {
      icon: Settings,
      title: 'الإعدادات',
      subtitle: 'تخصيص التطبيق',
      onPress: () => router.push('/profile/driver-settings' as any),
    },
    {
      icon: HelpCircle,
      title: 'المساعدة والدعم',
      subtitle: 'تواصل معنا',
      onPress: () => router.push('/profile/driver-help' as any),
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>حسابي</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.profileCard}>
          {photoUrl || avatarUrl ? (
            <Image source={{ uri: photoUrl || avatarUrl! }} style={styles.avatarImage} resizeMode="cover" />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <User size={32} color={colors.white} />
            </View>
          )}
          <Text style={styles.name}>{profile?.full_name || 'سائق'}</Text>
          <View style={styles.badge}>
            <Truck size={14} color={colors.primary} />
            <Text style={styles.badgeText}>سائق</Text>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => pickAndUpload('driver', 'library')} disabled={loading}>
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryBtnText} numberOfLines={1} ellipsizeMode="tail">تغيير صورة السائق</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => pickAndUpload('avatar', 'library')} disabled={loading}>
              <Text style={styles.secondaryBtnText} numberOfLines={1} ellipsizeMode="tail">تغيير صورة الحساب</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => pickAndUpload('driver', 'camera')} disabled={loading}>
              <Text style={styles.secondaryBtnText} numberOfLines={1} ellipsizeMode="tail">التقاط بالكاميرا</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity key={index} style={styles.menuItem} onPress={item.onPress}>
              <View style={styles.menuIcon}>
                <item.icon size={20} color={colors.primary} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <LogOut size={20} color={colors.error} />
          <Text style={styles.signOutText}>تسجيل الخروج</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { ...typography.h2, color: colors.text },
  content: { flex: 1 },
  profileCard: { backgroundColor: colors.white, padding: spacing.xl, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  avatarPlaceholder: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  avatarImage: { width: 96, height: 96, borderRadius: 48, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  name: { ...typography.h2, color: colors.text, marginBottom: spacing.md },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary + '20', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.lg, gap: spacing.xs },
  badgeText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm },
  primaryBtn: { backgroundColor: colors.primary, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.lg, flexBasis: '48%', flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { ...typography.body, color: colors.white },
  secondaryBtn: { borderWidth: 1, borderColor: colors.primary, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.lg, flexBasis: '48%', flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { ...typography.body, color: colors.primary },
  menuContainer: { marginTop: spacing.lg, backgroundColor: colors.white },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  menuIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + '10', justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  menuContent: { flex: 1 },
  menuTitle: { ...typography.bodyMedium, color: colors.text, marginBottom: spacing.xs },
  menuSubtitle: { ...typography.caption, color: colors.textLight },
  signOutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, margin: spacing.lg, padding: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.error, gap: spacing.sm },
  signOutText: { ...typography.bodyMedium, color: colors.error },
});
