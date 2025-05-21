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
  // Determinar la ruta de la página actual sin idioma
  let currentRoute = '';
  
  // Normalizar la ruta: convertir '/es/about.html' o '/es/about' o '/es/about/' a 'about'
  const normalizedPath = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  
  // Eliminar la extensión .html si existe
  const withoutHtml = normalizedPath.replace(/\.html$/, '');
  
  // Obtener segmentos de la ruta
  const segments = withoutHtml.split('/').filter(Boolean);
  
  // Extraer los segmentos de BASE_URL para filtrarlos
  let baseSegments: string[] = [];
  if (typeof import.meta.env.BASE_URL === 'string') {
    baseSegments = import.meta.env.BASE_URL.split('/').filter(Boolean);
  }
  
  // Filtrar: eliminar BASE_URL y el idioma
  const contentSegments = segments.filter(segment => {
    return !baseSegments.includes(segment) && !supportedLanguages.includes(segment as SupportedLanguage);
  });
  
  // Si tenemos segmentos después de filtrar, usamos el primero como la ruta actual
  if (contentSegments.length > 0) {
    currentRoute = contentSegments[0];
  }
  
  // Construir la URL con el idioma solicitado y la ruta actual
  if (currentRoute) {
    return `${import.meta.env.BASE_URL}/${lang}/${currentRoute}`;
  } else {
    return `${import.meta.env.BASE_URL}/${lang}`;
  }
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