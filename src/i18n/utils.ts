import { defaultLang, supportedLanguages, type SupportedLanguage } from './config';

// Función para obtener idioma de la URL
export function getLangFromUrl(url: URL): SupportedLanguage {
  // Obtener todos los segmentos de la URL
  const segments = url.pathname.split('/').filter(Boolean);
  
  // Obtener los segmentos de la BASE_URL
  let baseSegments: string[] = [];
  if (typeof import.meta.env.BASE_URL === 'string') {
    baseSegments = import.meta.env.BASE_URL.split('/').filter(Boolean);
  }
  
  // Filtrar los segmentos de la BASE_URL
  const pathSegments = segments.filter(segment => !baseSegments.includes(segment));
  
  // Si hay segmentos después de filtrar la BASE_URL, el primero debería ser el idioma
  if (pathSegments.length > 0 && supportedLanguages.includes(pathSegments[0] as SupportedLanguage)) {
    return pathSegments[0] as SupportedLanguage;
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
  
  // Eliminar la BASE_URL si está presente
  let baseSegments: string[] = [];
  if (typeof import.meta.env.BASE_URL === 'string') {
    baseSegments = import.meta.env.BASE_URL.split('/').filter(Boolean);
  }
  
  // Filtrar los segmentos de la BASE_URL y el idioma actual
  const filteredSegments = segments.filter(segment => {
    // No incluir la BASE_URL en los segmentos
    if (baseSegments.includes(segment)) {
      return false;
    }
    
    // No incluir el segmento de idioma actual (independientemente de su posición)
    if (supportedLanguages.includes(segment as SupportedLanguage)) {
      return false;
    }
    
    return true;
  });
  
  // Reconstruir la ruta con la BASE_URL y el nuevo idioma
  return `${import.meta.env.BASE_URL}/${lang}${filteredSegments.length > 0 ? '/' + filteredSegments.join('/') : ''}`;
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