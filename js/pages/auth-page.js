/*
 * Sign in / create account. One page with two modes, next to a short
 * introduction to the app for people who are new to it.
 */
import { icon } from '../components/icons.js';
import { renderThemeToggle } from '../components/theme-toggle.js';
import { PASSWORD_MIN_LENGTH } from '../data/auth-service.js';
import { DEMO_ACCOUNT } from '../data/mock-data.js';
import { signIn, signInWithDemo, signUp } from '../actions/auth-actions.js';
import { escapeHtml } from '../utils/helpers.js';
import { routes } from '../router.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MODES = {
  login: {
    title: 'أهلًا بعودتك',
    subtitle: 'سجّل دخولك لتكمل مراجعة اليوم.',
    submitLabel: 'تسجيل الدخول',
    switchText: 'ليس لديك حساب؟',
    switchLabel: 'أنشئ حسابًا جديدًا',
    switchHref: routes.signup,
  },
  signup: {
    title: 'أنشئ حسابك',
    subtitle: 'دقيقة واحدة، ثم ابدأ بحفظ أول ما تعلمته.',
    submitLabel: 'إنشاء الحساب',
    switchText: 'لديك حساب بالفعل؟',
    switchLabel: 'سجّل الدخول',
    switchHref: routes.login,
  },
};

const FEATURES = [
  { icon: 'projects', title: 'نظّم ما تتعلمه', text: 'من كتاب أو بودكاست أو كورس، في مشاريع وبطاقات قصيرة.' },
  { icon: 'today', title: 'راجع ما يستحق اليوم فقط', text: 'نختار لك البطاقات المستحقة، وأنت تراجع وتكمل يومك.' },
  { icon: 'flame', title: 'معرفة تبقى معك', text: 'كل مرة تتذكر فيها بطاقة تتباعد مراجعتها، حتى تصبح راسخة.' },
];

const SCHEDULE = ['اليوم', 'غدًا', 'بعد يومين', 'بعد أسبوع', 'بعد أسبوعين', 'كل شهر'];

function renderIntro() {
  return `
    <section class="auth-intro" aria-labelledby="auth-intro-title">
      <a class="brand auth-intro__brand" href="${routes.login}" aria-label="رسوخ">
        <svg class="brand__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
          <rect width="32" height="32" rx="7" fill="currentColor" />
          <path d="M23 10.5h-6M23 16h-9.5M23 21.5H9" stroke="#f8f8f8" stroke-width="2.4" stroke-linecap="round" />
        </svg>
        <span class="brand__name">رسوخ</span>
      </a>

      <h2 class="auth-intro__title" id="auth-intro-title">احفظ ما تتعلمه، ونعيده إليك في الوقت المناسب.</h2>
      <p class="auth-intro__lead">
        نقرأ ونسمع ونتعلم كل يوم، ثم ننسى معظمه خلال أيام. رسوخ يحفظ المعلومات المهمة في بطاقات صغيرة،
        ويعيدها إليك على فترات متباعدة حتى تنتقل إلى ذاكرتك طويلة المدى.
      </p>

      <ul class="auth-features" role="list">
        ${FEATURES.map(
          (feature) => `
            <li class="auth-feature">
              <span class="auth-feature__icon">${icon(feature.icon, { size: 18 })}</span>
              <div>
                <p class="auth-feature__title">${feature.title}</p>
                <p class="auth-feature__text">${feature.text}</p>
              </div>
            </li>`,
        ).join('')}
      </ul>

      <div class="auth-schedule">
        <p class="auth-schedule__label">متى تعود البطاقة إليك؟</p>
        <ol class="auth-schedule__steps" role="list">
          ${SCHEDULE.map((step) => `<li class="auth-schedule__step">${step}</li>`).join('')}
        </ol>
      </div>
    </section>`;
}

function renderField({ id, name, label, type = 'text', autocomplete, placeholder = '', hint = '' }) {
  const isPassword = type === 'password';
  return `
    <div class="field">
      <label class="field__label" for="${id}">${label}</label>
      <div class="${isPassword ? 'password-field' : ''}">
        <input class="input" id="${id}" name="${name}" type="${type}" autocomplete="${autocomplete}"
          placeholder="${escapeHtml(placeholder)}" dir="${type === 'email' || isPassword ? 'ltr' : 'auto'}"
          aria-describedby="${id}-error${hint ? ` ${id}-hint` : ''}" required />
        ${
          isPassword
            ? `<button type="button" class="password-field__toggle" data-toggle-password aria-label="إظهار كلمة المرور" aria-pressed="false">${icon('eye', { size: 18 })}</button>`
            : ''
        }
      </div>
      ${hint ? `<p class="field__hint" id="${id}-hint">${hint}</p>` : ''}
      <p class="field__error" id="${id}-error" hidden></p>
    </div>`;
}

function renderForm(mode) {
  const copy = MODES[mode];
  const isSignup = mode === 'signup';

  return `
    <section class="auth-panel" aria-labelledby="auth-title">
      <h1 class="auth-panel__title" id="auth-title">${copy.title}</h1>
      <p class="auth-panel__subtitle">${copy.subtitle}</p>

      <form class="form auth-form" novalidate data-auth-form data-mode="${mode}">
        <p class="auth-form__error" role="alert" data-form-error hidden></p>

        ${isSignup ? renderField({ id: 'auth-name', name: 'name', label: 'الاسم', autocomplete: 'name', placeholder: 'كيف نناديك؟' }) : ''}
        ${renderField({ id: 'auth-email', name: 'email', label: 'البريد الإلكتروني', type: 'email', autocomplete: 'email', placeholder: 'name@example.com' })}
        ${renderField({
          id: 'auth-password',
          name: 'password',
          label: 'كلمة المرور',
          type: 'password',
          autocomplete: isSignup ? 'new-password' : 'current-password',
          hint: isSignup ? `${PASSWORD_MIN_LENGTH} أحرف على الأقل.` : '',
        })}

        <button type="submit" class="btn btn--primary btn--lg btn--block" data-submit>${copy.submitLabel}</button>
      </form>

      <p class="auth-panel__switch">${copy.switchText} <a href="${copy.switchHref}">${copy.switchLabel}</a></p>

      <div class="auth-demo">
        <span class="auth-demo__divider">أو</span>
        <button type="button" class="btn btn--secondary btn--block" data-demo-sign-in>جرّب التطبيق بحساب تجريبي</button>
        <p class="auth-demo__note">يحتوي على مشاريع وبطاقات جاهزة · <span dir="ltr">${DEMO_ACCOUNT.email}</span></p>
      </div>
    </section>`;
}

/* ---------- Validation & submission ---------- */

function validate(mode, { name, email, password }) {
  const errors = {};
  if (mode === 'signup' && !name) errors.name = 'اكتب اسمك';
  if (!email) errors.email = 'اكتب بريدك الإلكتروني';
  else if (!EMAIL_PATTERN.test(email)) errors.email = 'تأكد من صيغة البريد الإلكتروني';
  if (!password) errors.password = 'اكتب كلمة المرور';
  else if (mode === 'signup' && password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `كلمة المرور يجب أن تكون ${PASSWORD_MIN_LENGTH} أحرف على الأقل`;
  }
  return errors;
}

function showFieldError(form, name, message) {
  const input = form.elements[name];
  if (!input) return;
  const error = document.getElementById(`${input.id}-error`);
  input.setAttribute('aria-invalid', String(Boolean(message)));
  error.textContent = message ?? '';
  error.hidden = !message;
}

function setBusy(button, busy) {
  button.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
}

function bindForm(container) {
  const form = container.querySelector('[data-auth-form]');
  const { mode } = form.dataset;
  const formError = form.querySelector('[data-form-error]');
  const submitButton = form.querySelector('[data-submit]');

  const showFormError = (message) => {
    formError.textContent = message ?? '';
    formError.hidden = !message;
  };

  form.addEventListener('input', (event) => {
    if (event.target.getAttribute('aria-invalid') === 'true') showFieldError(form, event.target.name, null);
    showFormError(null);
  });

  form.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-toggle-password]');
    if (!toggle) return;
    const input = toggle.parentElement.querySelector('input');
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(visible));
    toggle.setAttribute('aria-label', visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = {
      name: form.elements.name?.value.trim() ?? '',
      email: form.elements.email.value.trim(),
      password: form.elements.password.value,
    };

    const errors = validate(mode, values);
    ['name', 'email', 'password'].forEach((field) => showFieldError(form, field, errors[field]));
    const firstInvalid = Object.keys(errors)[0];
    if (firstInvalid) {
      form.elements[firstInvalid].focus();
      return;
    }

    setBusy(submitButton, true);
    const { error } = mode === 'signup' ? await signUp(values) : await signIn(values);
    if (!error) return;

    setBusy(submitButton, false);
    showFormError(error);
    form.elements[mode === 'signup' ? 'email' : 'password'].focus();
  });

  container.querySelector('[data-demo-sign-in]').addEventListener('click', (event) => {
    setBusy(event.currentTarget, true);
    signInWithDemo();
  });
}

export function renderAuthPage(container, { mode }) {
  container.innerHTML = `
    ${renderThemeToggle({ className: 'auth-theme-toggle' })}
    <div class="auth-layout">
      ${renderIntro()}
      ${renderForm(mode)}
    </div>`;

  bindForm(container);
  // On phones, opening the keyboard immediately would hide the introduction.
  if (window.matchMedia('(min-width: 721px)').matches) {
    container.querySelector('[data-auth-form] input')?.focus({ preventScroll: true });
  }
}
