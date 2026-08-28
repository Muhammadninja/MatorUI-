import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Persistence for the user's appearance choice. Mirrors `language-storage`:
 * a single key, JSON-wrapped with a schema version so future shape changes
 * can be detected.
 *
 * Device-level preference on purpose — it never touches the API or the auth
 * token, so a guest keeps their theme across restarts exactly like a
 * signed-in user does.
 */

const STORAGE_KEY = 'theme:v1';
const SCHEMA_VERSION = 1;

/** 'system' follows the phone's light/dark setting. */
export type ThemePreference = 'system' | 'light' | 'dark';

type Envelope = {
  v: number;
  preference: ThemePreference;
};

function isEnvelope(value: unknown): value is Envelope {
  if (!value || typeof value !== 'object') return false;
  const e = value as Partial<Envelope>;
  return (
    typeof e.v === 'number' &&
    (e.preference === 'system' || e.preference === 'light' || e.preference === 'dark')
  );
}

export async function loadThemePreference(): Promise<ThemePreference | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isEnvelope(parsed) || parsed.v !== SCHEMA_VERSION) return null;
    return parsed.preference;
  } catch {
    return null;
  }
}

export async function saveThemePreference(preference: ThemePreference): Promise<void> {
  try {
    const envelope: Envelope = { v: SCHEMA_VERSION, preference };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // Silent — persistence failure shouldn't block the UI.
  }
}
