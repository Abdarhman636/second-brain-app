import { useCallback, useEffect } from 'react';
import { formatCount } from '../domain/format';
import { MAX_VACATION_DAYS } from '../domain/vacation';
import type { ISODate } from '../domain/types';
import { useAppStore } from '../store/app-store';
import { useUiStore } from '../store/ui-store';

/** Start / end vacation mode with confirmation and feedback (home and settings share it). */
export function useVacationActions(today: ISODate) {
  const start = useCallback(async () => {
    const { confirm, showToast } = useUiStore.getState();
    const confirmed = await confirm({
      title: 'تفعيل وضع الإجازة؟',
      message:
        `خلال الإجازة لن تنكسر سلسلتك إن لم تراجع، ويمكنك المراجعة متى أردت. تمتد الإجازة حتى ${MAX_VACATION_DAYS} يومًا ثم تنتهي تلقائيًا، وعند انتهائها نؤجل البطاقات التي استحقت أثناء غيابك بمدة الإجازة.`,
      confirmLabel: 'ابدأ الإجازة',
      tone: 'primary',
    });
    if (!confirmed) return;
    useAppStore.getState().startVacation(today);
    showToast('استمتع بإجازتك، سلسلتك محفوظة');
  }, [today]);

  const end = useCallback(() => {
    const shifted = useAppStore.getState().endVacation(today);
    useUiStore
      .getState()
      .showToast(shifted ? `أهلًا بعودتك. وزّعنا مراجعات فترة غيابك على الأيام القادمة (${formatCount(shifted, 'cards')})` : 'أهلًا بعودتك');
  }, [today]);

  return { start, end };
}

/** End a vacation that reached its maximum length, and say so. Mounted once, in the app shell. */
export function useVacationExpiry(today: ISODate) {
  const vacations = useAppStore((state) => state.vacations);
  useEffect(() => {
    const shifted = useAppStore.getState().expireVacation(today);
    if (shifted === null) return;
    useUiStore
      .getState()
      .showToast(
        `انتهت إجازتك بعد ${MAX_VACATION_DAYS} يومًا، أهلًا بعودتك.${shifted ? ` وزّعنا مراجعات فترة غيابك على الأيام القادمة (${formatCount(shifted, 'cards')})` : ''}`,
      );
  }, [today, vacations]);
}
