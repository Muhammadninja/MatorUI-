import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'likes:v1';

export type StoredLikes = {
  ids: string[];
  hasEverLiked: boolean;
};

type Envelope = StoredLikes & { v: 1 };

export async function loadLikes(): Promise<StoredLikes | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Envelope>;
    if (parsed.v !== 1 || !Array.isArray(parsed.ids)) return null;
    return {
      ids: parsed.ids.filter((id): id is string => typeof id === 'string'),
      hasEverLiked: Boolean(parsed.hasEverLiked),
    };
  } catch {
    return null;
  }
}

export async function saveLikes(state: StoredLikes): Promise<void> {
  try {
    const envelope: Envelope = { v: 1, ...state };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // silent
  }
}
