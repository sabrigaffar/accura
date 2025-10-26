import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'password' | 'otp'>('password');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1) تسجيل الدخول بكلمة المرور
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) throw signInErr;

      // 2) التأكد أن المستخدم أدمن
      const userId = data.user?.id;
      if (!userId) throw new Error('فشل تسجيل الدخول');
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (profileError) throw profileError;
      if (profile.user_type !== 'admin') {
        await supabase.auth.signOut();
        throw new Error('الدخول مرفوض. يتطلب صلاحيات الأدمن.');
      }

      // 3) قراءة إعداد المصادقة الثنائية
      const { data: settingsRow } = await supabase
        .from('app_settings')
        .select('two_factor_auth')
        .eq('id', 'global')
        .maybeSingle();
      const twoFAEnabled = !!settingsRow?.two_factor_auth;

      if (!twoFAEnabled) {
        // بدون 2FA -> متابعة مباشرة
        navigate('/');
        return;
      }

      // 4) إرسال رمز إلى البريد (2FA عبر البريد)
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (otpErr) throw otpErr;

      // 5) نغلق الجلسة الحالية حتى لا يمر دون 2FA
      await supabase.auth.signOut();

      setStep('otp');
    } catch (err: any) {
      setError('حدث خطأ غير متوقع');

      if (err?.message) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // 6) التحقق من رمز البريد
      const { data, error: verifyErr } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      } as any);
      if (verifyErr) throw verifyErr;

      // 7) التأكد مجددًا أن الحساب أدمن
      const userId = data.user?.id;
      if (!userId) throw new Error('فشل التحقق من الرمز');
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (profileError) throw profileError;
      if (profile.user_type !== 'admin') {
        await supabase.auth.signOut();
        throw new Error('الدخول مرفوض. يتطلب صلاحيات الأدمن.');
      }

      await refreshUser();
      navigate('/');
    } catch (err: any) {
      setError(err?.message || 'فشل التحقق من الرمز');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            تسجيل الدخول إلى لوحة تحكم الأدمن
          </h2>
        </div>
        {step === 'password' ? (
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">
                  {error}
                </div>
              </div>
            )}
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="email-address" className="sr-only">البريد الإلكتروني</label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                  placeholder="البريد الإلكتروني"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">كلمة المرور</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                  placeholder="كلمة المرور"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
              </button>
            </div>
          </form>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleVerifyOtp}>
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700">رمز التحقق (المُرسل للبريد)</label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                pattern="\\d*"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                placeholder="أدخل الرمز المكون من 6 أرقام"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => { setStep('password'); setOtp(''); setError(null); }}
                className="text-sm text-gray-600 hover:text-gray-800"
                disabled={loading}
              >
                رجوع
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                {loading ? 'جاري التحقق...' : 'تأكيد الرمز'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginPage;