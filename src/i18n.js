// -------------------------------------------------------------------
// i18n.js — language handling.
//
// To add a language: create src/locales/xx.json (copy en.json and
// translate the values, leave the keys alone), then add the two lines
// marked below. Nothing else in the app needs to change.
// -------------------------------------------------------------------

import en from './locales/en.json';
import de from './locales/de.json';
import tr from './locales/tr.json';
import uk from './locales/uk.json';
// import fr from './locales/fr.json';   <-- 1. import the new file

export const LOCALES = {
  en, de, tr, uk,
  // fr,                                 <-- 2. add it here
};

export const DEFAULT_LANG = 'en';

// The bureaucratic terms as they appear on the actual paperwork.
// These stay in German in every language — if you are looking for the
// right counter at the Rathaus, "Anmeldung" is the word on the sign,
// and translating it away makes the app less useful, not more.
export const GERMAN_TERMS = {
  rental: 'Mietvertrag',
  registration: 'Anmeldung',
  health: 'Krankenversicherung',
  tax: 'Finanzamt',
  jobcenter: 'Jobcenter',
  visa: 'Aufenthaltstitel',
  insurance: 'Versicherung',
  rundfunk: 'Rundfunkbeitrag',
  pension: 'Rentenversicherung',
  other: 'Sonstiges',
};

// Look up a dotted key path, e.g. t('add.heading').
// Falls back to English if a key is missing from a translation, and to
// the key itself if it is missing everywhere — so a typo shows up as
// visible text rather than a blank space or a crash.
export const makeT = (lang) => (path, vars) => {
  const dig = (obj) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

  let value = dig(LOCALES[lang]);
  if (value === undefined) value = dig(LOCALES[DEFAULT_LANG]);
  if (typeof value !== 'string') return path;

  // Replace {n}, {name}, etc.
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.replaceAll(`{${k}}`, v);
    }
  }
  return value;
};

// Category display: translated gloss plus the German term in brackets.
// In German the two are identical, so the bracket is dropped.
export const categoryLabel = (t, id) => {
  const gloss = t(`categories.${id}`);
  const german = GERMAN_TERMS[id] || id;
  return gloss === german ? german : `${gloss} (${german})`;
};

// Saved choice, else the browser's language if we support it, else English.
export const getInitialLang = () => {
  try {
    const saved = localStorage.getItem('buerokratik-lang');
    if (saved && LOCALES[saved]) return saved;
  } catch {}
  const browser = (navigator.language || '').slice(0, 2).toLowerCase();
  return LOCALES[browser] ? browser : DEFAULT_LANG;
};
