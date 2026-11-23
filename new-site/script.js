const ADMIN_PASSWORD = 'MiRoN1301';
const CIAN_MAP_URL = 'https://www.cian.ru/map/';

const SETTINGS_KEY = 'subscription-site:settings';
const SESSION_KEY = 'subscription-site:admin';
const TRIAL_KEY = 'subscription-site:trial-start';
const TRIAL_NOTICE_KEY = 'subscription-site:trial-expired-shown';
const SUBSCRIPTION_KEY = 'subscription-site:subscription-start';
const SUBSCRIPTION_NOTICE_KEY = 'subscription-site:subscription-expired-shown';
const DAY_MS = 24 * 60 * 60 * 1000;
const TRIAL_DURATION_MS = 3 * DAY_MS;
const SUBSCRIPTION_DURATION_MS = 30 * DAY_MS;

const DEFAULT_SETTINGS = Object.freeze({
  title: 'Подписка',
  telegram: 'https://t.me/Dyrka6i7dyrdom',
  codes: ['PROMO2026'],
});

const siteTitle = document.querySelector('#site-title');
const promoDialog = document.querySelector('#promo-dialog');
const promoForm = document.querySelector('#promo-form');
const promoInput = document.querySelector('#promo-code');
const promoError = document.querySelector('#promo-error');
const payDialog = document.querySelector('#pay-dialog');
const telegramLink = document.querySelector('#telegram-link');
const toast = document.querySelector('#toast');

const adminButton = document.querySelector('#admin-button');
const adminDialog = document.querySelector('#admin-dialog');
const adminForm = document.querySelector('#admin-form');
const adminPassword = document.querySelector('#admin-password');
const adminError = document.querySelector('#admin-error');
const adminPanel = document.querySelector('#admin-panel');
const adminTitleInput = document.querySelector('#admin-title-input');
const adminTelegramInput = document.querySelector('#admin-telegram-input');
const adminCodesInput = document.querySelector('#admin-codes-input');
const adminSave = document.querySelector('#admin-save');
const adminReset = document.querySelector('#admin-reset');

const trialDialog = document.querySelector('#trial-dialog');
const accessExpiredDialog = document.querySelector('#access-expired-dialog');
const trialStartButton = document.querySelector('#trial-start');
const trialPayButton = document.querySelector('#trial-pay');
const accessExpiredTitle = document.querySelector('#access-expired-title');
const accessExpiredText = document.querySelector('#access-expired-text');

const TOAST_DURATION_MS = 2500;
let toastTimer;
let adminMode = false;
let settings = loadSettings();

function showToast(message) {
  window.clearTimeout(toastTimer);

  toast.textContent = message;
  toast.hidden = false;

  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
    toast.textContent = '';
  }, TOAST_DURATION_MS);
}

function loadSettings() {
  const fallback = { ...DEFAULT_SETTINGS, codes: [...DEFAULT_SETTINGS.codes] };

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return fallback;

    const saved = JSON.parse(raw);

    return {
      title:
        typeof saved.title === 'string' && saved.title.trim()
          ? saved.title.trim()
          : fallback.title,
      telegram:
        typeof saved.telegram === 'string' && saved.telegram.trim()
          ? saved.telegram.trim()
          : fallback.telegram,
      codes: Array.isArray(saved.codes)
        ? saved.codes.filter((code) => typeof code === 'string').map((code) => code.toUpperCase())
        : fallback.codes,
    };
  } catch {
    return fallback;
  }
}

function saveSettings() {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Приватный режим или переполненное хранилище: настройки просто не сохранятся.
  }
}

function normalizeTelegram(value) {
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_SETTINGS.telegram;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/+/, '')}`;
}

function parseCodes(value) {
  const codes = value
    .split(/[\s,;]+/)
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);

  return [...new Set(codes)];
}

function applySettings() {
  siteTitle.textContent = settings.title;
  document.title = settings.title;
  telegramLink.href = settings.telegram;

  if (adminMode) fillAdminForm();
}

function fillAdminForm() {
  adminTitleInput.value = settings.title;
  adminTelegramInput.value = settings.telegram;
  adminCodesInput.value = settings.codes.join(', ');
}

function setAdminMode(enabled) {
  adminMode = enabled;
  adminPanel.hidden = !enabled;
  adminButton.textContent = enabled ? 'Выйти' : 'Админ';
  adminButton.classList.toggle('is-active', enabled);
  adminButton.setAttribute('aria-pressed', String(enabled));

  if (enabled) fillAdminForm();

  try {
    if (enabled) {
      window.sessionStorage.setItem(SESSION_KEY, '1');
    } else {
      window.sessionStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // Режим администратора останется только в памяти страницы.
  }
}

let expiryTimer;

function readTimestamp(key) {
  try {
    const stored = Number(window.localStorage.getItem(key));
    return Number.isFinite(stored) && stored > 0 ? stored : null;
  } catch {
    return null;
  }
}

function getAccessState() {
  const now = Date.now();
  const subscriptionStart = readTimestamp(SUBSCRIPTION_KEY);
  const trialStart = readTimestamp(TRIAL_KEY);
  const subscriptionEndsAt = subscriptionStart
    ? subscriptionStart + SUBSCRIPTION_DURATION_MS
    : null;
  const trialEndsAt = trialStart ? trialStart + TRIAL_DURATION_MS : null;

  if (subscriptionEndsAt && now < subscriptionEndsAt) {
    return { kind: 'subscription', status: 'active', endsAt: subscriptionEndsAt };
  }
  if (trialEndsAt && now < trialEndsAt) {
    return { kind: 'trial', status: 'active', endsAt: trialEndsAt };
  }
  if (subscriptionEndsAt) {
    return { kind: 'subscription', status: 'expired', endsAt: subscriptionEndsAt };
  }
  if (trialEndsAt) {
    return { kind: 'trial', status: 'expired', endsAt: trialEndsAt };
  }
  return { status: 'none' };
}

function fillExpiredView(access) {
  const subscription = access.kind === 'subscription';

  accessExpiredTitle.textContent = subscription
    ? 'Подписка закончилась'
    : 'Пробный период закончился';
  accessExpiredText.textContent = subscription
    ? 'Месячная подписка завершена. Оформите новую, чтобы снова открыть карту.'
    : 'Бесплатный доступ на 3 дня завершён. Оформите подписку, чтобы снова открыть карту.';
}

function closeAccessDialogs() {
  [trialDialog, accessExpiredDialog].forEach((dialog) => {
    if (dialog.open) dialog.close();
  });
}

function openMapPage() {
  closeAccessDialogs();

  const opened = window.open(CIAN_MAP_URL, '_blank');
  if (!opened) window.location.href = CIAN_MAP_URL;
}

function openTrialDialog() {
  const access = getAccessState();

  if (access.status === 'active') {
    openMapPage();
  } else if (access.status === 'expired') {
    openExpiredAccess(access);
  } else {
    closeAccessDialogs();
    trialDialog.showModal();
  }
}

function startTrial() {
  const startedAt = Date.now();

  try {
    window.localStorage.setItem(TRIAL_KEY, String(startedAt));
    window.localStorage.removeItem(TRIAL_NOTICE_KEY);
  } catch {
    // Без хранилища пробный режим сбросится после перезагрузки.
  }

  showToast('Пробный период активирован на 3 дня');
  openMapPage();
  scheduleExpiry();
}

function activateSubscription() {
  const startedAt = Date.now();

  try {
    window.localStorage.setItem(SUBSCRIPTION_KEY, String(startedAt));
    window.localStorage.removeItem(SUBSCRIPTION_NOTICE_KEY);
  } catch {
    // Без хранилища подписка сбросится после перезагрузки.
  }

  showToast('Промокод принят: подписка на месяц активирована');
  openMapPage();
  scheduleExpiry();
}

function clearAccess() {
  window.clearTimeout(expiryTimer);

  try {
    window.localStorage.removeItem(TRIAL_KEY);
    window.localStorage.removeItem(SUBSCRIPTION_KEY);
    window.localStorage.removeItem(TRIAL_NOTICE_KEY);
    window.localStorage.removeItem(SUBSCRIPTION_NOTICE_KEY);
  } catch {
    // Если хранилище недоступно, сброс произойдёт только в памяти страницы.
  }
}

function noticeKey(kind) {
  return kind === 'subscription' ? SUBSCRIPTION_NOTICE_KEY : TRIAL_NOTICE_KEY;
}

function isExpiryShown(kind) {
  try {
    return window.localStorage.getItem(noticeKey(kind)) === '1';
  } catch {
    return false;
  }
}

function markExpiryShown(kind) {
  try {
    window.localStorage.setItem(noticeKey(kind), '1');
  } catch {
    // Не критично: окно просто покажется ещё раз при следующем визите.
  }
}

function openExpiredAccess(access) {
  closeAccessDialogs();
  fillExpiredView(access);
  accessExpiredDialog.showModal();
  markExpiryShown(access.kind);
}

function showExpiredAccessOnce() {
  const access = getAccessState();

  if (access.status !== 'expired' || isExpiryShown(access.kind)) return;

  openExpiredAccess(access);
}

function scheduleExpiry() {
  window.clearTimeout(expiryTimer);

  const access = getAccessState();
  if (access.status !== 'active') return;

  expiryTimer = window.setTimeout(() => {
    const current = getAccessState();
    if (current.status === 'expired') openExpiredAccess(current);
  }, access.endsAt - Date.now());
}

adminButton.addEventListener('click', () => {
  if (adminMode) {
    setAdminMode(false);
    showToast('Режим администратора выключен');
    return;
  }

  adminForm.reset();
  adminError.hidden = true;
  adminPassword.removeAttribute('aria-invalid');

  adminDialog.showModal();
  adminPassword.focus();
});

adminForm.addEventListener('submit', (event) => {
  event.preventDefault();

  if (adminPassword.value !== ADMIN_PASSWORD) {
    adminError.hidden = false;
    adminPassword.setAttribute('aria-invalid', 'true');
    adminPassword.focus();
    return;
  }

  adminError.hidden = true;
  adminPassword.removeAttribute('aria-invalid');
  adminDialog.close();
  setAdminMode(true);
  showToast('Режим администратора включён');
});

adminSave.addEventListener('click', () => {
  settings = {
    title: adminTitleInput.value.trim() || DEFAULT_SETTINGS.title,
    telegram: normalizeTelegram(adminTelegramInput.value),
    codes: parseCodes(adminCodesInput.value),
  };

  saveSettings();
  applySettings();
  showToast('Настройки сохранены');
});

adminReset.addEventListener('click', () => {
  settings = { ...DEFAULT_SETTINGS, codes: [...DEFAULT_SETTINGS.codes] };

  saveSettings();
  applySettings();
  clearAccess();
  showToast('Настройки, подписка и пробный период сброшены');
});

document.querySelector('#promo-button').addEventListener('click', () => {
  promoForm.reset();
  promoError.hidden = true;
  promoInput.removeAttribute('aria-invalid');

  promoDialog.showModal();
  promoInput.focus();
});

promoForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const code = promoInput.value.trim().toUpperCase();

  if (code === '') {
    promoError.textContent = 'Введите промокод';
    promoError.hidden = false;
    promoInput.setAttribute('aria-invalid', 'true');
    promoInput.focus();
    return;
  }

  if (!settings.codes.includes(code)) {
    promoError.textContent = 'Промокод не найден';
    promoError.hidden = false;
    promoInput.setAttribute('aria-invalid', 'true');
    promoInput.focus();
    return;
  }

  promoDialog.close();
  activateSubscription();
});

document.querySelector('#pay-button').addEventListener('click', () => {
  payDialog.showModal();
});

document.querySelector('#trial-button').addEventListener('click', openTrialDialog);

trialStartButton.addEventListener('click', startTrial);

trialPayButton.addEventListener('click', () => {
  accessExpiredDialog.close();
  payDialog.showModal();
});

document.querySelectorAll('.close-dialog').forEach((button) => {
  button.addEventListener('click', () => {
    button.closest('dialog').close();
  });
});

telegramLink.addEventListener('click', () => {
  payDialog.close();
});

// Закрытие модального окна кликом по затемнённому фону.
document.querySelectorAll('dialog').forEach((dialog) => {
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;

    const rect = dialog.getBoundingClientRect();
    const isOnBackdrop =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;

    if (isOnBackdrop) dialog.close();
  });
});

applySettings();

try {
  if (window.sessionStorage.getItem(SESSION_KEY) === '1') setAdminMode(true);
} catch {
  // sessionStorage недоступен — стартуем без режима администратора.
}

showExpiredAccessOnce();
scheduleExpiry();
