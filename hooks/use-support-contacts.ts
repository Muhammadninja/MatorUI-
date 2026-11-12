import { useQuery } from '@tanstack/react-query';

import { fetchAppConfig, type SupportContacts } from '@/services/app-config-service';

export type UseSupportContactsValue = {
  /** Still asking the server. */
  loading: boolean;
  contacts: SupportContacts;
  /** At least one channel is configured. */
  hasAny: boolean;
};

const NONE: SupportContacts = { phone: null, email: null, telegramUsername: null };

/**
 * Support channels from GET /v1/app/config. Shares the update gate's query, so
 * the config is fetched once. A missing or unreachable config means no channel
 * is offered — the screen says support is unavailable instead of guessing one.
 */
export function useSupportContacts(): UseSupportContactsValue {
  const query = useQuery({
    queryKey: ['app-config'],
    queryFn: ({ signal }) => fetchAppConfig(signal),
    staleTime: 5 * 60_000,
  });
  const contacts = query.data?.support ?? NONE;
  return {
    loading: query.isPending,
    contacts,
    hasAny: !!(contacts.phone || contacts.email || contacts.telegramUsername),
  };
}
