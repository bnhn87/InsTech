import { useEffect, useState } from 'react';
import en from '../locales/en.json';
import es from '../locales/es.json';

const dictionaries: Record<string, any> = {
  en,
  es,
};

// Determine the best matching locale based on the browser or device language
function detectLocale(): string {
  if (typeof navigator !== 'undefined' && navigator.language) {
    const lang = navigator.language.split('-')[0];
    if (Object.keys(dictionaries).includes(lang)) return lang;
  }
  return 'en';
}

export function useTranslation() {
  const [locale, setLocale] = useState<string>('en');
  const [dict, setDict] = useState<any>(dictionaries.en);
  useEffect(() => {
    const detected = detectLocale();
    setLocale(detected);
    setDict(dictionaries[detected] || dictionaries.en);
  }, []);
  const t = (key: string): string => {
    return dict[key] ?? key;
  };
  return { t, locale, setLocale };
}