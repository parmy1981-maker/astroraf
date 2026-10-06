const SUPABASE_URL = 'https://fqjlfonsdazjwgwchvko.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wBNO6y-u6E3ZV3_UOb1LMg_KnPPTdax';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const stateLoading = document.getElementById('stateLoading');
const stateLoggedOut = document.getElementById('stateLoggedOut');
const stateNoAccess = document.getElementById('stateNoAccess');
const stateRedirecting = document.getElementById('stateRedirecting');

function showState(el) {
  [stateLoading, stateLoggedOut, stateNoAccess, stateRedirecting].forEach((s) => {
    s.hidden = s !== el;
  });
}

async function init() {
  showState(stateLoading);

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session || session.user.is_anonymous || !session.user.email) {
    showState(stateLoggedOut);
    return;
  }

  const { data: isEditor, error } = await supabaseClient.rpc('is_editor');
  if (error) {
    console.error('AstroRaf admin: is_editor check failed', error);
    showState(stateLoggedOut);
    return;
  }

  if (!isEditor) {
    document.getElementById('noAccessEmail').textContent = session.user.email || '';
    showState(stateNoAccess);
    return;
  }

  showState(stateRedirecting);
  window.location.href = 'fotos.html';
}

document.getElementById('loginBtn').addEventListener('click', () => {
  supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
});

document.getElementById('logoutBtnNoAccess').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  init();
});

supabaseClient.auth.onAuthStateChange(() => {
  init();
});

init();
