'use client';

import { useParams } from 'next/navigation';
import ListingForm from '@/components/marketplace/ListingForm';

export default function EditListingPage() {
  const params = useParams();
  return <ListingForm listingId={params.id as string} />;
}
