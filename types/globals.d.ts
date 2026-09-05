/**
 * The `intl-pluralrules` polyfill ships no type declarations — it is imported
 * purely for its side effect (installing a CLDR-complete `Intl.PluralRules`
 * on engines like Hermes that lack one). See `services/i18n.ts`.
 */
declare module 'intl-pluralrules';
