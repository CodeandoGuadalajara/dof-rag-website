export const defaultLang = 'es';
export const supportedLanguages = ['es', 'en'];

export type SupportedLanguage = 'es' | 'en';

export const ui: Record<SupportedLanguage, string> = {
  es: 'Español',
  en: 'English'
};

// Opciones para formatear fechas según el idioma
export type DateFormatOptions = {
  year: 'numeric';
  month: 'long';
  day: 'numeric';
};

export const dateFormatOptions: Record<SupportedLanguage, DateFormatOptions> = {
  es: {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  },
  en: {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }
}; 