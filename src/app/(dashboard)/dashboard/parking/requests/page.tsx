import { redirect } from 'next/navigation';

/** The sidebar's "Requests" link, which is the waiting-list tab. */
export default function ParkingRequestsPage() {
  redirect('/dashboard/parking?tab=requests');
}
