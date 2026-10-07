const SUPABASE_URL = 'https://fqjlfonsdazjwgwchvko.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wBNO6y-u6E3ZV3_UOb1LMg_KnPPTdax';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const stateLoading = document.getElementById('stateLoading');
const stateLoggedOut = document.getElementById('stateLoggedOut');
const stateNoAccess = document.getElementById('stateNoAccess');
const stateRequestSent = document.getElementById('stateRequestSent');
const stateRedirecting = document.getElementById('stateRedirecting');

const accessRequestForm = document.getElementById('accessRequestForm');
const accessRequestError = document.getElementById('accessRequestError');

let currentSession = null;

function showState(el) {
  [stateLoading, stateLoggedOut, stateNoAccess, stateRequestSent, stateRedirecting].forEach((s) => {
    s.hidden = s !== el;
  });
}

async function init() {
  showState(stateLoading);
  accessRequestError.hidden = true;

  const { data: { session } } = await supabaseClient.auth.getSession();
  currentSession = session;
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

accessRequestForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  accessRequestError.hidden = true;

  if (!currentSession || !currentSession.access_token) {
    return;
  }

  const submitBtn = document.getElementById('requestAccessBtn');
  submitBtn.disabled = true;

  const message = document.getElementById('accessRequestMessage').value.trim();

  try {
    const res = await fetch('/api/request-access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentSession.access_token}`,
      },
      body: JSON.stringify({ message }),
    });

    if (!res.ok) {
      throw new Error('request-access failed');
    }

    showState(stateRequestSent);
  } catch (err) {
    console.error('AstroRaf admin: toegangsverzoek versturen mislukt', err);
    accessRequestError.textContent = 'Versturen mislukt, probeer het later opnieuw.';
    accessRequestError.hidden = false;
    submitBtn.disabled = false;
  }
});

supabaseClient.auth.onAuthStateChange(() => {
  init();
});

init();
