'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * The URL is the state.
 *
 * `dashboard/team/employees` worked this out first and wrote it inline: read
 * the filters off `useSearchParams`, push changes back, and never keep a second
 * copy in `useState`. Everything a person can do to a list survives a reload,
 * a back button and a link pasted into WhatsApp — which is how a committee
 * member actually sends "look at THIS" to the secretary.
 *
 * Only five files in the whole dashboard did this, and no gate page did any of
 * it, so this is that same pattern with the boilerplate lifted out rather than
 * copied a seventh time.
 *
 * `defaults` matters: a value equal to its default is DELETED from the query
 * string rather than written, so the common case is a clean URL and not
 * `?page=1&pageSize=25&category=&q=`.
 */
export function useUrlState(defaults: Record<string, string>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Callers pass an object literal, which is a new identity every render. Keyed
  // on its contents instead, so `get` and `set` stay stable and are safe to put
  // in an effect's dependency list — which is the whole reason for the hook.
  const key = JSON.stringify(defaults);
  const fallbacks = useMemo<Record<string, string>>(() => JSON.parse(key), [key]);

  const get = useCallback(
    (name: string) => searchParams.get(name) ?? (fallbacks[name] ?? ''),
    [searchParams, fallbacks],
  );

  const set = useCallback((updates: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([name, value]) => {
      const v = value === undefined ? '' : String(value);
      if (!v || v === fallbacks[name]) params.delete(name);
      else params.set(name, v);
    });
    const qs = params.toString();
    // `scroll: false` because these are filter changes — yanking a guard back to
    // the top of the list every time they page through it is its own bug.
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams, fallbacks]);

  const reset = useCallback(() => router.replace(pathname, { scroll: false }), [router, pathname]);

  return { get, set, reset };
}

export default useUrlState;
