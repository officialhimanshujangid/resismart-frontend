import type { Metadata } from 'next';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://resismart-backend.onrender.com/api/v1';

/** Fetch listing data server-side for SEO metadata generation. */
async function getListingMeta(slug: string) {
  try {
    const res = await fetch(`${API_BASE}/public/marketplace/listings/${slug}`, {
      next: { revalidate: 300 }, // ISR: revalidate every 5 minutes
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.listing;
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListingMeta(slug);

  if (!listing) {
    return { title: 'Property not found — ResiSmart Homes' };
  }

  const inr = (p: number) => `₹${(p / 100).toLocaleString('en-IN')}`;
  const cover = listing.photos?.find((p: any) => p.isCover) || listing.photos?.[0];
  const priceStr = `${inr(listing.pricePaise)}${listing.priceType === 'PER_MONTH' ? '/mo' : ''}`;
  const loc = [listing.societyId?.name, listing.city].filter(Boolean).join(', ');

  return {
    title: `${listing.title} — ${priceStr} | ResiSmart Homes`,
    description: listing.description
      ? listing.description.slice(0, 160)
      : `${listing.kind === 'RENT' ? 'Rent' : 'Buy'} ${listing.bedrooms ? `${listing.bedrooms} BHK` : 'property'} in ${loc || 'a verified society'}. ${priceStr}.`,
    openGraph: {
      title: listing.title,
      description: `${listing.kind === 'RENT' ? 'For Rent' : 'For Sale'} · ${priceStr} · ${loc}`,
      images: cover ? [{ url: cover.url, alt: listing.title }] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: listing.title,
      description: `${priceStr} in ${loc}`,
      images: cover ? [cover.url] : [],
    },
  };
}

export default function ListingDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
