/*
 * The daily reminder email's "stop" link (/unsubscribe?token=…). Works
 * without signing in; the token is the reminder's own, not the account's.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { EmptyState } from '../components/ui';
import { ReminderError, unsubscribeReminders } from '../data/reminders';
import { useDocumentTitle } from '../hooks/use-document-title';

export function UnsubscribePage() {
  useDocumentTitle('إيقاف التذكير');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [result, setResult] = useState<'done' | 'invalid' | 'failed' | null>(null);

  useEffect(() => {
    let active = true;
    unsubscribeReminders(token)
      .then((stopped) => active && setResult(stopped ? 'done' : 'invalid'))
      .catch((error) => active && setResult(error instanceof ReminderError ? 'failed' : 'failed'));
    return () => {
      active = false;
    };
  }, [token]);

  if (!result) return <p className="page-loading">جارٍ إيقاف التذكير…</p>;

  return (
    <div className="page">
      <EmptyState
        icon={result === 'done' ? 'check' : 'info'}
        title={result === 'done' ? 'أوقفنا التذكير اليومي' : result === 'invalid' ? 'الرابط غير صالح' : 'تعذّر إيقاف التذكير'}
        message={
          result === 'done'
            ? 'لن تصلك رسائل التذكير بعد الآن. يمكنك تشغيله من جديد في أي وقت من «الإعدادات».'
            : result === 'invalid'
              ? 'ربما نُسخ الرابط ناقصًا. يمكنك إيقاف التذكير من «الإعدادات» بعد تسجيل الدخول.'
              : 'تأكد من اتصالك، ثم افتح الرابط مرة أخرى.'
        }
        actions={[{ label: 'الإعدادات', to: '/settings', variant: 'secondary' }]}
        headingLevel={1}
      />
    </div>
  );
}
