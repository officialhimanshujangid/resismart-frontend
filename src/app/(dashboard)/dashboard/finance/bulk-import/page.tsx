'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Bulk import lives inside Setup now, so this route only redirects.
 *
 * Kept rather than deleted: bookmarks, the old sidebar entry and anything that
 * links here should land somewhere sensible instead of a 404.
 */
export default function BulkImportRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/finance/setup?tab=import'); }, [router]);
  return null;
}
