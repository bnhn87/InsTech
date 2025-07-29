import * as Localization from 'expo-localization';
import en from '../locales/en.json';
import es from '../locales/es.json';

const dictionaries: Record<string, any> = { en, es };

const locale = Localization.locale.split('-')[0];
const dict = dictionaries[locale] || dictionaries.en;

export function t(key: string): string {
  return dict[key] ?? key;
}