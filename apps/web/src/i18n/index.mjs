import en from './locales/en.mjs';
import ja from './locales/ja.mjs';
import ko from './locales/ko.mjs';

const DEFAULT_LOCALE = 'en';
const STORAGE_KEY = 'block-generator.locale';
const dictionaries = { en, ko, ja };

export const SUPPORTED_LOCALES = Object.freeze(Object.keys(dictionaries));

function normalizeLocale(locale) {
    if (typeof locale !== 'string') {
        return null;
    }

    const language = locale.trim().toLowerCase().split('-')[0];
    return SUPPORTED_LOCALES.includes(language) ? language : null;
}

function readStoredLocale() {
    try {
        return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
    } catch {
        return null;
    }
}

function readUrlLocale() {
    try {
        return new URLSearchParams(globalThis.location?.search ?? '').get('lang');
    } catch {
        return null;
    }
}

function detectLocale() {
    const candidates = [
        readUrlLocale(),
        readStoredLocale(),
        ...(globalThis.navigator?.languages ?? []),
        globalThis.navigator?.language,
        DEFAULT_LOCALE
    ];

    for (const candidate of candidates) {
        const locale = normalizeLocale(candidate);
        if (locale) {
            return locale;
        }
    }

    return DEFAULT_LOCALE;
}

function readTranslation(dictionary, key) {
    return key.split('.').reduce((value, part) => value?.[part], dictionary);
}

function interpolate(template, params) {
    return template.replace(/\{(\w+)\}/g, (match, name) =>
        Object.hasOwn(params, name) ? String(params[name]) : match
    );
}

let currentLocale = detectLocale();

export function getLocale() {
    return currentLocale;
}

export function setLocale(locale) {
    const normalizedLocale = normalizeLocale(locale);
    if (!normalizedLocale) {
        return false;
    }

    currentLocale = normalizedLocale;

    try {
        globalThis.localStorage?.setItem(STORAGE_KEY, currentLocale);
    } catch {
        // The UI can still switch languages when storage is unavailable.
    }

    try {
        const url = new URL(globalThis.location.href);
        url.searchParams.set('lang', currentLocale);
        globalThis.history?.replaceState(null, '', url);
    } catch {
        // Updating the URL is optional outside a browser environment.
    }

    return true;
}

export function t(key, params = {}) {
    const value = readTranslation(dictionaries[currentLocale], key) ??
        readTranslation(dictionaries[DEFAULT_LOCALE], key);

    if (typeof value !== 'string') {
        return key;
    }

    return interpolate(value, params);
}

export function translateDocument(root = document) {
    for (const element of root.querySelectorAll('[data-i18n]')) {
        element.textContent = t(element.dataset.i18n);
    }

    for (const element of root.querySelectorAll('[data-i18n-aria-label]')) {
        element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel));
    }

    for (const element of root.querySelectorAll('[data-i18n-title]')) {
        element.title = t(element.dataset.i18nTitle);
    }
}
