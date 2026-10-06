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
let accountIsLoggedIn = false;

function renderAccountLabel() {
  if (!accountLink) return;
  accountLink.textContent = accountLabelFor(accountIsLoggedIn ? 'logout' : 'login');
}

async function accountLogoutClick(e) {
  e.preventDefault();
  await accountSupabase.auth.signOut();
  window.location.reload();
}

async function initAccountNav() {
  if (!accountLink) return;

  const { data: { session } } = await accountSupabase.auth.getSession();
  accountIsLoggedIn = Boolean(session && !session.user.is_anonymous && session.user.email);
  renderAccountLabel();

  if (accountIsLoggedIn) {
    accountLink.setAttribute('href', '#');
    accountLink.addEventListener('click', accountLogoutClick);
  }
}

document.addEventListener('astroraf-lang-changed', renderAccountLabel);

initAccountNav();
