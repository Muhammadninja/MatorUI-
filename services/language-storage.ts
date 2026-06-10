import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Persistence for the user's language choice. Single key, JSON-wrapped
 * with a schema version so future shape changes can be detected.
 */

const STORAGE_KEY = 'language:v1';
const SCHEMA_VERSION = 1;

export type LanguageCode = 'en' | 'ru' | 'uz';

type Envelope = {
  v: number;
  code: LanguageCode;
};

function isEnvelope(value: unknown): value is Envelope {
  if (!value || typeof value !== 'object') return false;
  const e = value as Partial<Envelope>;
  return (
    typeof e.v === 'number' &&
    (e.code === 'en' || e.code === 'ru' || e.code === 'uz')
  );
}

export async function loadLanguage(): Promise<LanguageCode | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isEnvelope(parsed) || parsed.v !== SCHEMA_VERSION) return null;
    return parsed.code;
  } catch {
    return null;
  }
}

export async function saveLanguage(code: LanguageCode): Promise<void> {
  try {
    const envelope: Envelope = { v: SCHEMA_VERSION, code };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // Silent — persistence failure shouldn't block the UI.
  }
}
