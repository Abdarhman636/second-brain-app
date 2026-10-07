import { useEffect, useState } from 'react';
import { getToday } from '../domain/date-utils';
import type { ISODate } from '../domain/types';

/** Today's date, kept current if the app stays open past midnight. */
export function useToday(): ISODate {
  const [today, setToday] = useState(getToday);

  useEffect(() => {
    const update = () => setToday(getToday());
    const timer = window.setInterval(update, 60_000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  return today;
}
