import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router';
import { ADMIN_PATH } from './config';
import { setSyncErrorHandler } from './data/repository';
import { initSession } from './data/session';
import { useUiStore } from './store/ui-store';
import { AdminOnly, AppLayout, OpenToAll, PublicOnly, RequireAuth } from './components/AppLayout';
import { DialogHost } from './components/DialogHost';
import { Toasts } from './components/Toasts';
import { useApplyTheme } from './hooks/use-theme';
import { AuthPage } from './pages/AuthPage';
import { CardsPage } from './pages/CardsPage';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/PasswordPages';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { DeveloperPage } from './pages/DeveloperPage';
import { FeedbackPage } from './pages/FeedbackPage';
import { GuidePage } from './pages/GuidePage';
import { MobileAppPage } from './pages/MobileAppPage';
import { OrdersPage } from './pages/OrdersPage';
import { PricingPage } from './pages/PricingPage';
import { ProjectDetailsPage } from './pages/ProjectDetailsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { SettingsPage } from './pages/SettingsPage';
import { SharePage } from './pages/SharePage';
import { UnsubscribePage } from './pages/UnsubscribePage';
import { ReviewPage } from './pages/ReviewPage';
import { TodayPage } from './pages/TodayPage';

/** Opens the plans when the user hits a limit (see ui-store's upgradeReason). */
function UpgradeRedirect() {
  const reason = useUiStore((state) => state.upgradeReason);
  const navigate = useNavigate();
  useEffect(() => {
    if (!reason) return;
    navigate(`/pricing?reason=${reason}`);
    useUiStore.getState().requestUpgrade(null);
  }, [reason, navigate]);
  return null;
}

export function App() {
  useApplyTheme();

  // Listen to Supabase Auth for the app's lifetime, and surface failed saves.
  useEffect(() => {
    setSyncErrorHandler((error) => {
      console.error('[sync]', error);
      // The database refuses rows past the plan's limit ("plan_limit:<table>").
      const limited = /plan_limit:(shelves|projects|cards)/.exec(String(error))?.[1] as 'shelves' | 'projects' | 'cards' | undefined;
      if (limited) {
        useUiStore.getState().showToast('لم يُحفظ آخر ما أضفته: وصلت لحد خطتك.', 'error');
        useUiStore.getState().requestUpgrade(limited);
        return;
      }
      useUiStore.getState().showToast('تعذّر حفظ آخر تغيير. تأكد من اتصالك، ثم أعد تحميل الصفحة.', 'error');
    });
    return initSession();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PublicOnly><AuthPage key="login" mode="login" /></PublicOnly>} />
        <Route path="/signup" element={<PublicOnly><AuthPage key="signup" mode="signup" /></PublicOnly>} />
        <Route path="/forgot-password" element={<PublicOnly><ForgotPasswordPage /></PublicOnly>} />
        {/* Not behind a guard: the reset link signs the user in on arrival. */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route path="/guide" element={<OpenToAll><GuidePage /></OpenToAll>} />
        <Route path="/developer" element={<OpenToAll><DeveloperPage /></OpenToAll>} />
        {/* Old address of the guide ("ما هو رسوخ؟"). */}
        <Route path="/about" element={<Navigate to="/guide" replace />} />
        <Route path="/pricing" element={<OpenToAll><PricingPage /></OpenToAll>} />
        <Route path="/app" element={<OpenToAll><MobileAppPage /></OpenToAll>} />
        {/* A shared project or shelf, and the reminder email's "stop" link: no account needed. */}
        <Route path="/s/:shareId" element={<OpenToAll><SharePage /></OpenToAll>} />
        <Route path="/unsubscribe" element={<OpenToAll><UnsubscribePage /></OpenToAll>} />

        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<TodayPage />} />
          <Route path="review" element={<ReviewPage key="daily" />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:projectId" element={<ProjectDetailsPage />} />
          <Route path="cards" element={<CardsPage />} />
          <Route path="projects/:projectId/review" element={<ReviewPage key="project" />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="feedback" element={<FeedbackPage />} />
          {/* Admin only, at an address that's hard to guess, and linked from nowhere in the app. */}
          <Route path={ADMIN_PATH.slice(1)} element={<AdminOnly><AdminDashboardPage /></AdminOnly>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>

      {/* Rendered once, outside the pages, so they work on every screen. */}
      <DialogHost />
      <Toasts />
      <UpgradeRedirect />
    </BrowserRouter>
  );
}
