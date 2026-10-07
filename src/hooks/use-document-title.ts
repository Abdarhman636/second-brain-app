import { useEffect } from 'react';

const APP_NAME = 'رسوخ';

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`;
  }, [title]);
}
