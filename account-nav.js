const accountSupabase = (typeof supabaseClient !== 'undefined')
  ? supabaseClient
  : supabase.createClient(
      'https://fqjlfonsdazjwgwchvko.supabase.co',
      'sb_publishable_wBNO6y-u6E3ZV3_UOb1LMg_KnPPTdax'
    );

const ACCOUNT_LABELS = {
  nl: { login: 'Inloggen', logout: 'Uitloggen' },
  en: { login: 'Login', logout: 'Logout' },
  fr: { login: 'Connexion', logout: 'Déconnexion' },
  de: { login: 'Anmelden', logout: 'Abmelden' },
};

function accountCurrentLang() {
  return localStorage.getItem('astroraf-lang') || 'nl';
}

function accountLabelFor(key) {
  const lang = accountCurrentLang();
  return (ACCOUNT_LABELS[lang] || ACCOUNT_LABELS.nl)[key];
}

const accountLink = document.getElementById('accountLink');
const accountEmailEl = document.getElementById('accountEmail');
let accountIsLoggedIn = false;

function renderAccountLabel() {
  if (!accountLink) return;
  accountLink.textContent = accountLabelFor(accountIsLoggedIn ? 'logout' : 'login');
}

function renderAccountEmail(email) {
  if (!accountEmailEl) return;
  if (accountIsLoggedIn && email) {
    accountEmailEl.textContent = email;
    accountEmailEl.hidden = false;
  } else {
    accountEmailEl.textContent = '';
    accountEmailEl.hidden = true;
  }
}

async function accountLogoutClick(e) {
  e.preventDefault();
  await accountSupabase.auth.signOut();
  window.location.reload();
}

function accountLoginClick(e) {
  e.preventDefault();
  accountSupabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: new URL('admin.html', window.location.href).toString() },
  });
}

async function initAccountNav() {
  if (!accountLink) return;

  const { data: { session } } = await accountSupabase.auth.getSession();
  const hasGoogleSession = Boolean(session && !session.user.is_anonymous && session.user.email);

  accountIsLoggedIn = false;
  if (hasGoogleSession) {
    const { data: isEditor } = await accountSupabase.rpc('is_editor');
    accountIsLoggedIn = Boolean(isEditor);
  }
  renderAccountLabel();
  renderAccountEmail(session?.user?.email || null);

  if (accountIsLoggedIn) {
    accountLink.setAttribute('href', '#');
    accountLink.addEventListener('click', accountLogoutClick);
  } else {
    accountLink.addEventListener('click', accountLoginClick);
  }
}

document.addEventListener('astroraf-lang-changed', renderAccountLabel);

initAccountNav();
