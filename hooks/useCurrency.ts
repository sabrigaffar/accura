// Hook لجلب واستخدام العملة المفضلة
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { DEFAULT_CURRENCY } from '@/constants/currencies';

/**
 * Hook لجلب العملة المفضلة للمستخدم الحالي
 * يعمل مع جميع أنواع المستخدمين (تاجر، سائق، عميل)
 * 
 * @returns {string} كود العملة (SAR, EGP, إلخ)
 */
export const useCurrency = () => {
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserCurrency();
  }, []);

  const fetchUserCurrency = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      // محاولة جلب العملة من جدول profiles
      const { data: profileData } = await supabase
        .from('profiles')
        .select('preferred_currency')
        .eq('id', user.id)
        .single();

      if (profileData?.preferred_currency) {
        setCurrency(profileData.preferred_currency);
      }
    } catch (error) {
      console.error('Error fetching currency:', error);
    } finally {
      setLoading(false);
    }
  };

  return { currency, loading, refreshCurrency: fetchUserCurrency };
};
