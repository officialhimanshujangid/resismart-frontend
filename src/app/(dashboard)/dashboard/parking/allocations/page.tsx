import { redirect } from 'next/navigation';

/**
 * The sidebar has always pointed "Who Parks Where" at its own address, and a
 * link somebody may already have bookmarked should not start 404ing because the
 * screen became a tab. One place decides what the page looks like; this only
 * decides which tab it opens on.
 */
export default function ParkingAllocationsPage() {
  redirect('/dashboard/parking?tab=allocations');
}
