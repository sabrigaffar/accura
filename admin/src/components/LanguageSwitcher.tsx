import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    const newLanguage = language === 'ar' ? 'en' : 'ar';
    setLanguage(newLanguage);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center text-gray-700 hover:text-gray-900"
      aria-label={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
    >
      {language === 'ar' ? (
        <>
          <span className="mr-1">EN</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7 2a1 1 0 011 1v1h3a1 1 0 110 2H9.578a18.87 18.87 0 01-1.724 4.78c.29.354.596.696.914 1.026a1 1 0 11-1.44 1.389c-.254-.269-.5-.546-.735-.832-.065.089-.132.177-.203.263a1 1 0 01-1.55-1.263 18.86 18.86 0 01-1.04-.71 1 1 0 01.64-1.77c.081.012.163.023.245.033.025-.113.051-.226.08-.338a1 1 0 011.54-.74c.12.12.232.248.336.382a18.85 18.85 0 01-1.304-3.745H3a1 1 0 110-2h3V3a1 1 0 011-1zm6 6a1 1 0 01.894.553l2.991 5.982a.902.902 0 01.02.037l.99 1.98a1 1 0 11-1.79.895L15.383 16h-4.764l-.724 1.447a1 1 0 11-1.788-.894l.99-1.98.019-.038 2.99-5.982A1 1 0 0113 8zm-1.382 6h2.764L13 11.236 11.618 14z" clipRule="evenodd" />
          </svg>
        </>
      ) : (
        <>
          <span className="mr-1">AR</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7 2a1 1 0 011 1v1h3a1 1 0 110 2H9.578a18.87 18.87 0 01-1.724 4.78c.29.354.596.696.914 1.026a1 1 0 11-1.44 1.389c-.254-.269-.5-.546-.735-.832-.065.089-.132.177-.203.263a1 1 0 01-1.55-1.263 18.86 18.86 0 01-1.04-.71 1 1 0 01.64-1.77c.081.012.163.023.245.033.025-.113.051-.226.08-.338a1 1 0 011.54-.74c.12.12.232.248.336.382a18.85 18.85 0 01-1.304-3.745H3a1 1 0 110-2h3V3a1 1 0 011-1zm6 6a1 1 0 01.894.553l2.991 5.982a.902.902 0 01.02.037l.99 1.98a1 1 0 11-1.79.895L15.383 16h-4.764l-.724 1.447a1 1 0 11-1.788-.894l.99-1.98.019-.038 2.99-5.982A1 1 0 0113 8zm-1.382 6h2.764L13 11.236 11.618 14z" clipRule="evenodd" />
          </svg>
        </>
      )}
    </button>
  );
};

export default LanguageSwitcher;