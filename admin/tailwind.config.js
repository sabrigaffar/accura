/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#00B074',
        'primary-dark': '#009a63',
        secondary: '#FFD84D',
        background: '#F5F7FA',
        text: '#333333',
        'text-light': '#666666',
        border: '#E0E0E0',
        'light-gray': '#F0F0F0',
        success: '#4CAF50',
        warning: '#FF9800',
        error: '#F44336',
      },
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
        tajawal: ['Tajawal', 'sans-serif'],
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        xxl: '24px',
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        xxl: '48px',
      },
    },
  },
  plugins: [],
  rtl: true,
}