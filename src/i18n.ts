import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhTW from './locales/tw/zh-TW.json';

void i18n.use(initReactI18next).init({
  resources: { 'zh-TW': { translation: zhTW } },
  lng: 'zh-TW',
  fallbackLng: 'zh-TW',
  interpolation: { escapeValue: false },
});

export default i18n;
