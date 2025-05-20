import { defaultLang, supportedLanguages, type SupportedLanguage } from './config';

// Función para obtener idioma de la URL
export function getLangFromUrl(url: URL): SupportedLanguage {
  const [, lang] = url.pathname.split('/');
  if (supportedLanguages.includes(lang as SupportedLanguage)) {
    return lang as SupportedLanguage;
  }
  return defaultLang;
}

// Función para traducir rutas
export function translatePath(path: string, targetLang: SupportedLanguage): string {
  const [, lang, ...rest] = path.split('/');
  if (supportedLanguages.includes(lang as SupportedLanguage)) {
    return `/${targetLang}/${rest.join('/')}`;
  }
  return `/${targetLang}${path}`;
}

// Función para obtener ruta de base según el idioma
export function getLocalizedPathname(pathname: string, lang: SupportedLanguage): string {
  // Eliminar el idioma actual de la ruta si existe
  const segments = pathname.split('/').filter(Boolean);
  if (supportedLanguages.includes(segments[0] as SupportedLanguage)) {
    segments.shift();
  }
  
  // Reconstruir la ruta con el nuevo idioma
  return `/${lang}/${segments.join('/')}`;
}

// Función para cargar traducciones
export function useTranslations(lang: SupportedLanguage) {
  const translations: Record<string, any> = {};
  
  try {
    if (lang === 'es') {
      translations.es = require('./translations/es.json');
    } else if (lang === 'en') {
      translations.en = require('./translations/en.json');
    }
  } catch (e) {
    console.error(`Error loading translations for ${lang}:`, e);
  }
  
  return function t(key: string): string {
    const langTranslations = translations[lang] || {};
    return langTranslations[key] || key;
  };
} 