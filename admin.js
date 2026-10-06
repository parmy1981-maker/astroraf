const SUPABASE_URL = 'https://fqjlfonsdazjwgwchvko.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wBNO6y-u6E3ZV3_UOb1LMg_KnPPTdax';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const stateLoading = document.getElementById('stateLoading');
const stateLoggedOut = document.getElementById('stateLoggedOut');
const stateNoAccess = document.getElementById('stateNoAccess');
const stateEditor = document.getElementById('stateEditor');

function showState(el) {
  [stateLoading, stateLoggedOut, stateNoAccess, stateEditor].forEach((s) => {
    s.hidden = s !== el;
  });
}

function slugify(name) {
  const base = (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mark}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || 'album'}-${suffix}`;
}

async function init() {
  showState(stateLoading);

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
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

  document.getElementById('editorEmail').textContent = `Ingelogd als ${session.user.email}`;
  showState(stateEditor);
}

document.getElementById('loginBtn').addEventListener('click', () => {
  supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
});

async function signOutAndRefresh() {
  await supabaseClient.auth.signOut();
  init();
}

document.getElementById('logoutBtnNoAccess').addEventListener('click', signOutAndRefresh);
document.getElementById('logoutBtn').addEventListener('click', signOutAndRefresh);

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 15 * 1024 * 1024;

document.getElementById('albumForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const submitBtn = document.getElementById('submitBtn');
  const statusEl = document.getElementById('uploadStatus');
  const nameInput = document.getElementById('albumName');
  const filesInput = document.getElementById('albumPhotos');
  const files = Array.from(filesInput.files || []);

  if (!files.length) {
    statusEl.textContent = 'Kies minstens 1 foto.';
    return;
  }

  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      statusEl.textContent = `${file.name}: enkel jpeg, png of webp toegestaan.`;
      return;
    }
    if (file.size > MAX_SIZE) {
      statusEl.textContent = `${file.name}: groter dan 15MB.`;
      return;
    }
  }

  submitBtn.disabled = true;
  statusEl.textContent = 'Album aanmaken...';

  const { data: { session } } = await supabaseClient.auth.getSession();
  const slug = slugify(nameInput.value);

  const { data: album, error: albumError } = await supabaseClient
    .from('albums')
    .insert({ slug, name: nameInput.value.trim(), created_by: session ? session.user.email : null })
    .select()
    .single();

  if (albumError) {
    statusEl.textContent = `Album aanmaken mislukt: ${albumError.message}`;
    submitBtn.disabled = false;
    return;
  }

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    statusEl.textContent = `Foto ${i + 1}/${files.length} uploaden...`;
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${album.id}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabaseClient.storage
      .from('album-photos')
      .upload(path, file, { contentType: file.type });

    if (uploadError) {
      statusEl.textContent = `Foto ${file.name} uploaden mislukt: ${uploadError.message}`;
      continue;
    }

    const { error: photoError } = await supabaseClient
      .from('album_photos')
      .insert({ album_id: album.id, storage_path: path, sort_order: i });

    if (photoError) {
      statusEl.textContent = `Foto ${file.name} opslaan mislukt: ${photoError.message}`;
    }
  }

  statusEl.textContent = `Album "${album.name}" aangemaakt met ${files.length} foto's.`;
  nameInput.value = '';
  filesInput.value = '';
  submitBtn.disabled = false;
});

supabaseClient.auth.onAuthStateChange(() => {
  init();
});

init();
