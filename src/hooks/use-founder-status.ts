import { useEffect, useState } from 'react';
import { fetchFounderStatus, type FounderStatus } from '../data/payments';
import { useAppStore } from '../store/app-store';

/**
 * Founder seats, read once per signed-in user (the pricing and checkout pages
 * share it). `founder` is true while the user gets the founder price: they
 * hold a seat, or seats are still left. Unknown (null status) means no offer.
 */
export function useFounderStatus(): { status: FounderStatus | null; founder: boolean; seatsLeft: number } {
  const userId = useAppStore((state) => state.user?.id ?? null);
  const [status, setStatus] = useState<FounderStatus | null>(null);

  useEffect(() => {
    let active = true;
    void fetchFounderStatus().then((result) => active && setStatus(result));
    return () => {
      active = false;
    };
  }, [userId]);

  const seatsLeft = status ? Math.max(0, status.seats - status.taken) : 0;
  return { status, founder: Boolean(status && (status.isFounder || seatsLeft > 0)), seatsLeft };
}
