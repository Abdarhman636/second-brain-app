# رسوخ — Rusookh

A calm, Arabic-first (RTL) knowledge retention app. Save what you learn from books, podcasts, courses and conversations as small cards, and the app brings each one back on a spaced schedule until it becomes long-term knowledge.

> Open the app → see what's due today → review → done.

Built with **HTML, CSS and Vanilla JavaScript (ES modules)** only. There's no framework, no build step, no backend and no persistence: all data lives in memory and resets on reload.

## Running locally

> Accounts and data live in memory only. Reloading the page signs you out and resets everything, including any accounts you created.

ES modules don't load over `file://`, so serve the folder with any static server:

```bash
python3 -m http.server 5173
```

Then open <http://localhost:5173>.

The UI fonts (IBM Plex Sans Arabic, plus Noto Naskh Arabic for quotes) come from Google Fonts. If they can't load, the app falls back to system fonts.

## Features

- **Accounts**: sign in with email and password, or create an account (name, email, password of at least 8 characters).
  - The sign-in page has a short introduction to the app.
  - **جرّب التطبيق بحساب تجريبي** signs straight into the demo account (`demo@example.com`), which has sample projects and cards. New accounts start empty.
  - Pages other than sign-in redirect to sign-in, then return to the requested page.
  - The account menu (top end) shows the user's name and email, and has **تسجيل الخروج**.
- **Light and dark themes**: the light theme has a white page with `#f8f8f8` cards. The dark theme is built on the same pair inverted: `#333333` cards and `#F8F8F8` text.
  - The app follows the system setting. The moon/sun button in the header (and in the corner of the sign-in page) switches theme for the rest of the visit.
  - All colors are tokens in `css/variables.css`: page, surface (cards), elevated (modals and menus) and field (inputs).
- **Top navigation**: the brand at the start, the menu (اليوم، المشاريع، البطاقات) centered, and "add card" and the account menu at the end.
- **All cards** (`#cards`): every card across projects, sorted by next review. You can search (it ignores diacritics and أ/ا، ة/ه، ى/ي differences) and filter by project and card type.
- **One card design**: home, all cards and project pages all use the same card component. Pages that mix projects add the project's name in its color.

- **Home dashboard**: shows what to do today, how you're progressing, and your streak.
  - **Streak** (the main card): the current run of days with a flame, the last 7 days, your longest streak, and what today means for it ("أنهِ مراجعة اليوم لتصل إلى 7 أيام").
  - **Today's task**: cards waiting, an estimated time, today's progress, and **ابدأ المراجعة**.
  - **Stats**: cards reviewed today, cards left today, total cards, and projects.
  - **Knowledge journey**: how many cards are قيد التعلّم, تتقوّى or راسخة.
  - **Lists**: the cards due today, or the upcoming review days once you're done.
  - **+ إضافة كارت**: opens the card form directly. You pick the project inside the form.
- **Review**: one card at a time, in a focused full-viewport layout on mobile.
  - Q&A cards show the question first; **إظهار الإجابة** reveals the answer.
  - **تذكرتها** moves the card to the next stage. **لم أتذكرها** brings it back tomorrow. Each button says when the card will return.
  - You can reveal a Q&A answer by clicking anywhere on the card, pressing `Space`, or using **إظهار الإجابة**.
  - Keyboard: `→` = تذكرتها, `←` = لم أتذكرها. تذكرتها sits on the right to match the → key.
  - A completion screen shows how many cards you reviewed, what you remembered, and when the next review is.
- **Projects**: a grid of projects, each showing its color badge, type, card count and cards due today.
  - Creating a project means choosing a type and one of **10 colors**. That color is the project's accent everywhere: badge, card, header, review card and due list.
  - Choosing **أخرى** shows **اسم نوع المشروع**. The name you type replaces "أخرى" everywhere the type is shown.
- **Project details**: every card with its stage, next review date, and **تعديل / نقل / حذف** actions.
- **Cards**: four types: ملاحظة، سؤال وجواب، اقتباس، تعريف. Create and edit share one form, and the content fields change with the type.
- Empty states for no projects, an empty project, and no reviews today.

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

- **Remembered**: stage + 1 (capped at the monthly stage), and the next review is today + that stage's interval.
- **Forgot**: the stage stays the same, and the next review is tomorrow.
- A card is due when `nextReviewDate <= today`, so overdue cards are always included.

### Streak

- A day counts toward the streak once every card due that day has been reviewed. Forgotten cards count as reviewed, because they move to tomorrow.
- A day can only be counted once, so reviewing extra cards later the same day doesn't raise the streak again.
- **Rest days**: a day with nothing due keeps the streak going without adding to it. The 7-day strip shows these as small neutral dots.
- A day that had due cards left unreviewed breaks the streak. Each review log entry stores the card's `dueDate`, so a late review still shows that the original day was missed.
- Today never breaks the streak while it's still in progress.
- State: `completedDays` is a list of ISO dates. The logic is pure and lives in [`js/utils/streak.js`](js/utils/streak.js).

All of the review scheduling logic lives in [`js/utils/review-scheduler.js`](js/utils/review-scheduler.js). Its functions are pure: they take the current date as an argument and never touch the DOM or app state.

## Project structure

```
index.html
assets/favicon.svg
css/
  main.css            entry point; @imports the rest in cascade order
  variables.css       design tokens (color, type, spacing, radius, motion, layout)
  reset.css  base.css
  layout.css          app shell, sidebar / bottom nav, page scaffolding
  components.css      buttons, badges, progress, stage indicator, modal, toast, empty state
  forms.css           inputs, segmented card-type picker, project-type picker
  today.css           home dashboard (streak, today card, stats, panels)
  review.css  projects.css
  responsive.css      tablet + mobile overrides
js/
  main.js             bootstrap, routing, global event delegation (no business logic)
  router.js           hash routes: #today, #review, #projects, #project/<id>
  data/
    data-source.js    the only module that knows where user data lives (per-user store)
    auth-service.js   in-memory sign up / sign in (salted SHA-256 hashes)
    mock-data.js      realistic Arabic seed data (dates relative to today)
    project-types.js  types (+ custom label for "أخرى")
    project-colors.js the 10 project accent colors
    card-types.js     types + form field definitions
  state/app-state.js  in-memory store: selectors, named mutations, subscribe()
  utils/
    review-scheduler.js  spaced-review rules + stage groups (pure)
    streak.js            daily streak rules (pure)
    date-utils.js        ISO-date math + Arabic formatting
    helpers.js           escaping, ids, Arabic pluralization
  components/         functions that return markup (no state writes)
  pages/              today, review, projects, project details
  actions/            user intents → state mutations (+ modals, toasts)
```

### How it fits together

```
click [data-action="review-remembered"]
  → main.js delegated listener → actions/index.js
  → review-actions.rememberCard()
  → review-scheduler.handleRemembered(card, today)   // pure date math
  → app-state.recordReview(...)                       // one commit
  → subscribers re-render nav + current page
```

- Components render from data they're given. They never write state or hold project and card data themselves.
- Markup uses `data-action` attributes instead of inline handlers. A single delegated listener dispatches them.
- The nav is built once and updated in place, so focus survives re-renders.
- Modals use the native `<dialog>`, which gives focus trapping, Escape and inert background for free. On mobile they become bottom sheets.

## Moving to a backend (e.g. Supabase)

The layers are separated so data can move to a backend without touching the UI:

1. **Auth**: replace `signUp` and `signIn` in `js/data/auth-service.js` with Supabase Auth (`auth.signUp` and `auth.signInWithPassword`). They already return `{ user }` or `{ error }`.
2. **Load**: change `fetchUserData(userId)` in `js/data/data-source.js` so it queries `projects`, `cards` and `review_log`. It must return the same `{ projects, cards, reviewLog, completedDays }` shape.
3. **Write**: each mutation in `js/state/app-state.js` maps to one row operation:
   `addProject`, `updateProject`, `addCard`, `updateCard`, `moveCard`, `deleteCard`, `recordReview` (one update to `cards` plus one insert into `review_log`) and `markDayCompleted` (one insert into `completed_days`). Make them async, or update optimistically and then call the API.
4. **Ids**: these are already UUIDs (`crypto.randomUUID()`), and dates are ISO strings, so they line up with typical Postgres columns.
5. The scheduler is pure, so it can also run server-side, for example in an edge function.

Suggested tables:

```
projects   (id uuid, name text, type text, custom_type_label text, color text,
            created_at, updated_at)
cards      (id uuid, project_id uuid, type text, content jsonb,
            review_stage int, next_review_date date,
            last_reviewed_at date, last_review_result text,
            created_at, updated_at)
review_log (id uuid, card_id uuid, result text, date date, due_date date, reviewed_at timestamptz)
completed_days (date date primary key)   -- one row per completed day (per user)
```
