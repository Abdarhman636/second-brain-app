/*
 * "ما هو رسوخ؟" — the same introduction shown next to sign-in, available to
 * everyone from the footer.
 */
import { Link } from 'react-router';
import { AppIntro } from '../components/AppIntro';
import { useDocumentTitle } from '../hooks/use-document-title';
import { useAppStore } from '../store/app-store';

export function AboutPage() {
  useDocumentTitle('ما هو رسوخ؟');
  const signedIn = useAppStore((state) => Boolean(state.user));

  return (
    <div className="page page--narrow about-page">
      <AppIntro headingLevel={1} />

      <div className="about-page__actions">
        {signedIn ? (
          <Link className="btn btn--primary btn--lg" to="/">
            ابدأ مراجعة اليوم
          </Link>
        ) : (
          <>
            <Link className="btn btn--primary btn--lg" to="/signup">
              أنشئ حسابك
            </Link>
            <Link className="btn btn--secondary btn--lg" to="/login">
              تسجيل الدخول
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
