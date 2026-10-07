# رسوخ — Rusookh

A calm, Arabic-first (RTL) knowledge retention app. Save what you learn from books, podcasts, courses and conversations as small cards, and the app brings each one back on a spaced schedule until it becomes long-term knowledge.

> Open the app → see what's due today → review → done.

Built with **React 19 + TypeScript**, using Vite, React Router and Zustand. Accounts and data live in **Supabase** (Postgres, Auth and Storage). A demo mode runs on sample data without an account.

## Running locally

You'll need Node.js 22 or newer.

```bash
npm install
```

```bash
npm run dev
```

Then open <http://localhost:5173>.

| Command | What it does |
| ------- | ------------ |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Type-check, then build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | TypeScript only |
| `npm test` | Unit tests (Vitest) for the scheduler, streak, search and store |

### Connecting Supabase

1. Copy `.env.example` to `.env.local`, then fill in the project URL and publishable key from Supabase → Project Settings → API. `.env.local` is never committed.
2. In Supabase, open **SQL Editor**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it. This creates the tables, the Row Level Security policies, and the private `card-images` bucket. Running it again is safe, and it's how an existing database picks up new tables (e.g. shelves): **run it again after pulling a version that changes it**.
3. In **Authentication → URL Configuration**, set the Site URL to where the app runs (e.g. `http://localhost:5173`), so email confirmation links lead back to the app.
4. Restart `npm run dev`. Vite only reads `.env.local` at startup.

Without `.env.local`, the app still runs, but only in demo mode.

> **Testing tip:** Supabase's built-in email service only sends a few emails per hour. For local testing, either turn off **Confirm email** (Authentication → Providers → Email), or connect your own SMTP provider.

The UI fonts (IBM Plex Sans Arabic, plus Noto Naskh Arabic for quotes) come from Google Fonts. If they can't load, the app falls back to system fonts.

## Features

- **Accounts** (Supabase Auth): email and password sign-in and sign-up.
  - After signing up, confirm your email (you can request a new confirmation email). The confirmation link signs you in.
  - The session survives page reloads.
  - Signed-out visitors are sent to sign-in, then returned to the page they asked for.
  - **جرّب التطبيق بدون حساب** opens demo mode: sample data, and nothing is saved.
  - The sign-in page has a short introduction to the app.
- **Sidebar** (at the start of the page), from top to bottom:
  - the brand and the theme toggle;
  - the signed-in user, which links to settings;
  - **إضافة بطاقة**;
  - the menu: اليوم (with today's due count), المشاريع، البطاقات، الإعدادات;
  - the footer links at the bottom.
  - On tablets and phones it becomes a drawer, opened from a slim top bar that also has a quick add button. Escape or a tap outside closes it.
- **Shortcut**: press `N` on any page to add a card.
- **Home**: the dashboard and the statistics on one screen. On a laptop (at least 1100×700) it fits without scrolling.
  - **Today's task**: the "بطاقات بانتظارك" box with **ابدأ المراجعة**, next to the streak.
  - **Stats**: recall rate (last 30 days), rooted cards, cards reviewed today, and longest streak.
  - **Hardest project**: the active project with the lowest recall rate over the last 30 days. It needs at least 3 reviews and one miss.
  - **Knowledge journey** (قيد التعلّم / تتقوّى / راسخة) and **upcoming reviews**.
- **Vacation mode**: start it with **خذ إجازة** on the streak card, or from settings.
  - While it's on, days don't break the streak. Reviewing is optional, and a completed day still counts.
  - Ending it pushes back every review that came due during the vacation by the vacation's length, so you don't return to a pile.
  - It lasts at most 14 days. Days left are shown on the streak card and in settings. After that it ends on its own (with the same push-back), and missed days break the streak again.
- **Daily review limit**: a day asks for at most 30 cards by default, about 10 minutes.
  - The oldest due cards come first.
  - Cards past the limit stay due, and come first the next day.
  - Reaching the limit counts the day toward the streak.
  - **راجع دفعة إضافية** starts one more batch for days you want to do more.
- **Review**: one card at a time.
  - Every type except a note has a hidden part to recall first:
    - **Q&A**: the question shows, the answer is hidden.
    - **Definition**: the term shows, the definition is hidden.
    - **Quote**: the opening shows followed by "…", and the rest of the quote is hidden.
    - **Image**: the title shows, the image is hidden.
  - Reveal by clicking the card, pressing `Space`, or using the **إظهار …** button. Cards can't be graded before they're revealed.
  - `→` = تذكرتها, `←` = لم أتذكرها, matching the buttons' positions.
  - On phones, the top bar hides while a card is on screen.
- **Cards**: five types: ملاحظة، سؤال وجواب، اقتباس، تعريف، صورة. Every list uses the same card component.
  - The form says under each field whether that part shows during review or only after revealing.
  - **Image cards**: pick a picture from the device, by clicking or dragging. Large photos are scaled down to 1600px. Accepted formats are PNG, JPG, WebP, GIF and SVG, up to 15 MB. Images are converted to PNG or JPEG and stored in the private `card-images` bucket in Supabase Storage (in demo mode they stay in memory).
  - While a card is due, its hidden part stays hidden in lists too, so seeing it there doesn't spoil the review.
  - Edit, move and delete live in a **⋯** menu, which you can use with the keyboard.
- **All cards** (`/cards`): search (it ignores diacritics and أ/ا، ة/ه، ى/ي differences) and filter by project and type. Results load 20 at a time as you scroll, with a "عرض المزيد" button.
- **Projects**:
  - Sort by last activity, most due, name, or newest.
  - Each project has one of 10 colors and a type. Choosing **أخرى** lets you name the type yourself.
  - **Archive** pauses a project's reviews and keeps its cards. Archived projects are listed separately and can be restored.
  - **Delete** removes the project and its cards, after a confirmation that suggests archiving instead.
  - **راجع بطاقات المشروع** (on the project page) reviews every card in that one project:
    - The due cards come first, and are graded as in the daily review.
    - The rest are practice:
      - Remembering one leaves its schedule as it was, so reviewing early doesn't stretch its spacing.
      - Forgetting one sends it back to today's daily review, dropping stages like any forgotten card.
      - Practice isn't counted in the stats.
- **Shelves (رفوف)**: a shelf groups projects. For example, a «كتب» shelf has one project per book, and each project keeps its own cards.
  - Pick a project's shelf in its form, or create a new shelf right there. A project can sit on one shelf or on none.
  - The projects page has a shelf bar (الكل · each shelf · بدون رف).
    - "الكل" groups the projects by shelf.
    - Choosing a shelf filters to it; the URL keeps the choice (`?shelf=…`).
  - Rename or delete a shelf from its **⋯** menu. Deleting a shelf keeps its projects, which end up on no shelf.
  - A project's page shows its shelf in the breadcrumb (المشاريع / كتب).
- **Settings** (`/settings`):
  - **Account**: change your name (saved to your account), see your email, and sign out.
  - **Appearance**: light or dark.
  - **Daily review limit**: 20, 30 (the default), 50, 100, or no limit. It's saved on the account.
  - **Vacation mode**: start or end it.
  - **Your data**: export everything as a JSON file.
  - **Keyboard shortcuts**: the full list.
- **Themes**: light by default, dark on request. The choice is saved on the device and applied before the first paint, so there's no flash.
- **Footer links** (at the bottom of the sidebar, or under the About page when signed out; the sign-in pages have none):
  - **ما هو رسوخ؟** leads to `/about`, which shows the same introduction as the sign-in page. Anyone can open it, signed in or not.
  - **ادعيلي دعوة حلوة** links to the author's site. Set `AUTHOR_SITE_URL` in `src/config.ts`; until then it shows "قريبًا".

## Review schedule

| Stage | Interval | Label |
| ----- | -------- | ----- |
| 0 | due immediately | جديدة |
| 1 | 1 day | يوم |
| 2 | 2 days | يومان |
| 3 | 1 week | أسبوع |
| 4 | 2 weeks | أسبوعان |
| 5 | 1 month | شهر |
| 6 | every month after that | مراجعة شهرية |

- **Remembered**: the card moves up one stage (capped at monthly), and the next review is today plus that stage's interval.
- **Forgot**: the card falls back **two stages** (the monthly cycle counts as the one-month stage, and it never goes below stage 0), and it comes back tomorrow.
  - Example: forgetting a monthly card puts it at the 1-week stage, so the next success brings it back in 2 weeks, not a month.
  - The button says how far the card falls ("تعود غدًا وترجع مرحلتين").
  - FSRS is a candidate for a smarter scheduler later. Everything lives in `domain/review-scheduler.ts`.
- A card is due when `nextReviewDate <= today`, so overdue cards are always included.
- Cards in archived projects are never due.

### Streak

- A day counts once every card due that day has been reviewed. It's counted at most once per day.
- A day with nothing due is a **rest day**: it keeps the streak without adding to it.
- A day with unfinished due cards breaks the streak. Each review log entry stores the card's `dueDate`, so a late review still marks the original day as missed.
- **Vacation days** don't break the streak either.
- Today never breaks the streak while it's still in progress.

## Design

- **Look**: a light gray canvas with content in cells separated by hairlines, like a spec sheet. Corners are square, and the primary actions are orange with cut corners.
- **One page width** (`.page`, up to 1180px) for every app page. Only the review screen and About stay narrow, to keep the focus. Projects and cards share the same tiles: the same surface, hairlines and hover.
- **Fonts**:
  - Alexandria for headings: formal and clear, suited to a study app;
  - IBM Plex Sans Arabic for text;
  - IBM Plex Mono for numbers and small labels (numbers are shown with two digits: 09).
- **Colors**: every color is a token in `src/styles/variables.css`.
  - Light: background `#e6e6e4`, surfaces `#f3f3f1`, text `#111`, orange `#f27b35`.
  - Dark: the same tokens, redefined under `:root[data-theme="dark"]`.
  - Orange text uses `--color-brand-strong`, which stays readable on light surfaces.

## Project structure

```
index.html                 Vite entry (fonts, theme-color, #root)
public/favicon.svg
src/
  main.tsx  App.tsx        bootstrap and routes
  domain/                  pure TypeScript: no React, no DOM (shareable with React Native)
    types.ts               data model (Project, Card, ReviewLogEntry, UserData…)
    review-scheduler.ts    spaced-review rules and stage groups
    streak.ts              daily streak rules
    vacation.ts            vacation mode (start/end, pushing back reviews)
    stats.ts               recall rate, rooted cards, hardest project
    projects.ts            archiving, activity and sorting
    shelves.ts             grouping projects by shelf
    card-search.ts         search and filters
    card-types.ts  project-types.ts  project-colors.ts
    date-utils.ts  format.ts          ISO dates, Arabic dates and plurals
    *.test.ts              unit tests
  data/
    session.ts             sign-in / sign-up / sign-out, session restore, demo mode
    repository.ts          persistence interface and the ordered write queue
    supabase/              Supabase client and repository (row ↔ domain mapping, image storage)
    memory-repository.ts   demo mode (saves nothing)
    mock-data.ts           Arabic demo data, dates relative to today
  store/
    app-store.ts           Zustand: user data and every action that changes it (no UI code)
    ui-store.ts            web-only UI state: open dialog, toasts, theme
    session-store.ts       auth phase (starting / loading / signed-in / error)
    selectors.ts           derived data (review summary, upcoming schedule…)
  hooks/                   useToday, memoized data views, shortcuts, theme…
  components/              AppLayout, KnowledgeCard, ActionMenu, Modal, forms, dialogs…
  lib/image-file.ts        scales and encodes picked images
  config.ts                app settings (e.g. AUTHOR_SITE_URL)
  pages/                   Auth, About, Today (dashboard + stats), Review, Projects, ProjectDetails, Cards, Settings
  styles/                  CSS by responsibility; tokens in variables.css
```

- **`domain/` and `store/app-store.ts` hold no UI code.** They're written to be shared with the React Native app later.
- **Zustand selectors return raw slices.** Anything derived is computed with `useMemo` in `hooks/use-app-data.ts`, so renders stay stable.
- **Modals use the native `<dialog>`,** which handles focus trapping, Escape and focus restoration. On phones they become bottom sheets.

## How data is saved

- **Store first, then save.** Every store action updates state first, so the UI reacts instantly, then queues the matching write on the session's repository.
- **Writes run one at a time, in order,** so a card is always created before its review is logged.
- **Failed saves** show an error message and are logged to the console.
- **Loading** reads every page of results (Supabase returns at most 1000 rows per request), plus the last 400 days of review history.
- **Images** are stored privately at `card-images/<user id>/<card id>/…`. The database keeps their path, and the app shows them through signed URLs that last 7 days. SVG and GIF files are converted to PNG before upload.
- **"Today"** comes from the device's clock, i.e. the user's local date.

### Database tables

See [`supabase/schema.sql`](supabase/schema.sql): `shelves`, `projects` (with `shelf_id`), `cards`, `review_log`, `completed_days` and `vacations`.
- Every table is limited by Row Level Security to `user_id = auth.uid()`.
- Triggers make sure a card can only belong to one of its owner's own projects, and a project can only sit on one of its owner's shelves.
