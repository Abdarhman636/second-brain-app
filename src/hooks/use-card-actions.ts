import { useCallback } from 'react';
import { useAppStore } from '../store/app-store';
import { useUiStore } from '../store/ui-store';

/** Edit / move / delete for a single card, shared by every card list. */
export function useCardActions(cardId: string) {
  const openDialog = useUiStore((state) => state.openDialog);
  const confirm = useUiStore((state) => state.confirm);
  const showToast = useUiStore((state) => state.showToast);
  const deleteCard = useAppStore((state) => state.deleteCard);

  const edit = useCallback(() => openDialog({ kind: 'edit-card', cardId }), [openDialog, cardId]);
  const move = useCallback(() => openDialog({ kind: 'move-card', cardId }), [openDialog, cardId]);

  const remove = useCallback(async () => {
    const confirmed = await confirm({
      title: 'حذف البطاقة؟',
      message: 'سيتم حذف هذه البطاقة نهائيًا.',
      confirmLabel: 'حذف',
    });
    if (!confirmed) return;
    deleteCard(cardId);
    showToast('حُذفت البطاقة');
  }, [confirm, deleteCard, showToast, cardId]);

  return { edit, move, remove };
}
