export interface Currency {
  code: string;
  nameAr: string;
  nameEn: string;
  symbol: string;
}

export const SUPPORTED_CURRENCIES: Currency[] = [
  { code: 'SAR', nameAr: 'ريال سعودي', nameEn: 'Saudi Riyal', symbol: 'ر.س' },
  { code: 'EGP', nameAr: 'جنيه مصري', nameEn: 'Egyptian Pound', symbol: 'ج.م' },
  { code: 'AED', nameAr: 'درهم إماراتي', nameEn: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'USD', nameAr: 'دولار أمريكي', nameEn: 'US Dollar', symbol: '$' },
  { code: 'EUR', nameAr: 'يورو', nameEn: 'Euro', symbol: '€' },
];

export const DEFAULT_CURRENCY = 'SAR';

export const getCurrencyByCode = (code: string): Currency => {
  return SUPPORTED_CURRENCIES.find(c => c.code === code) || SUPPORTED_CURRENCIES[0];
};

export const formatCurrency = (amount: number, currencyCode: string): string => {
  const currency = getCurrencyByCode(currencyCode);
  return `${currency.symbol} ${amount.toFixed(2)}`;
};
