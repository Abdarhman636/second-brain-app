import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { setSyncErrorHandler } from './data/repository';
import { initSession } from './data/session';
import { useUiStore } from './store/ui-store';
import { AppLayout, OpenToAll, PublicOnly, RequireAuth } from './components/AppLayout';
import { DialogHost } from './components/DialogHost';
import { Toasts } from './components/Toasts';
import { useApplyTheme } from './hooks/use-theme';
import { AboutPage } from './pages/AboutPage';
import { AuthPage } from './pages/AuthPage';
import { CardsPage } from './pages/CardsPage';
import { ProjectDetailsPage } from './pages/ProjectDetailsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ReviewPage } from './pages/ReviewPage';
import { TodayPage } from './pages/TodayPage';

export function App() {
  useApplyTheme();

  // Listen to Supabase Auth for the app's lifetime, and surface failed saves.
  useEffect(() => {
    setSyncErrorHandler((error) => {
      console.error('[sync]', error);
      useUiStore.getState().showToast('تعذّر حفظ آخر تغيير. تأكد من اتصالك، ثم أعد تحميل الصفحة.', 'error');
    });
    return initSession();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PublicOnly><AuthPage key="login" mode="login" /></PublicOnly>} />
        <Route path="/signup" element={<PublicOnly><AuthPage key="signup" mode="signup" /></PublicOnly>} />

        <Route path="/about" element={<OpenToAll><AboutPage /></OpenToAll>} />

        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<TodayPage />} />
          <Route path="review" element={<ReviewPage key="daily" />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:projectId" element={<ProjectDetailsPage />} />
          <Route path="cards" element={<CardsPage />} />
          <Route path="projects/:projectId/review" element={<ReviewPage key="project" />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>

      {/* Rendered once, outside the pages, so they work on every screen. */}
      <DialogHost />
      <Toasts />
    </BrowserRouter>
  );
}
