import chery from '@/assets/brands/logos/chery.webp';
import daewoo from '@/assets/brands/logos/daewoo.webp';
import genesis from '@/assets/brands/logos/genesis.webp';
import haval from '@/assets/brands/logos/haval.webp';
import hyundai from '@/assets/brands/logos/hyundai.webp';
import kia from '@/assets/brands/logos/kia.webp';
import lada from '@/assets/brands/logos/lada.webp';
import nissan from '@/assets/brands/logos/nissan.webp';
import ravon from '@/assets/brands/logos/ravon.webp';
import skoda from '@/assets/brands/logos/skoda.webp';
import ssangyong from '@/assets/brands/logos/ssangyong.webp';
import toyota from '@/assets/brands/logos/toyota.webp';

/**
 * Logos shipped with the app for makes whose catalog row has no `logo_url` yet,
 * keyed by the make's name (case, accents and spaces ignored). The backend logo
 * always wins; this only replaces the initial-letter fallback.
 */
const LOGOS: Record<string, number> = {
  chery, daewoo, genesis, haval, hyundai, kia, lada, nissan, ravon, skoda, ssangyong, toyota,
};

const key = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();

/** The bundled logo for a make name, or null. */
export function bundledBrandLogo(name: string): number | null {
  return LOGOS[key(name)] ?? null;
}
