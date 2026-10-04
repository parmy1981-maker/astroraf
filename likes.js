const SUPABASE_URL = 'https://fqjlfonsdazjwgwchvko.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wBNO6y-u6E3ZV3_UOb1LMg_KnPPTdax';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const LOCAL_LIKES_KEY = 'astroraf-likes';

function loadLocalLikes() {
  try {
    const raw = localStorage.getItem(LOCAL_LIKES_KEY);
    const likes = raw ? JSON.parse(raw) : [];
    return Array.isArray(likes) ? likes : [];
  } catch (e) {
    return [];
  }
}

function saveLocalLikes(likes) {
  localStorage.setItem(LOCAL_LIKES_KEY, JSON.stringify(likes));
}

function isLikedLocally(photoId) {
  return loadLocalLikes().includes(photoId);
}

let sessionPromise = null;

function ensureSession() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const { data } = await supabaseClient.auth.getSession();
      if (data.session) return data.session;
      const { data: signInData, error } = await supabaseClient.auth.signInAnonymously();
      if (error) {
        console.error('AstroRaf: anonymous sign-in failed', error);
        return null;
      }
      return signInData.session;
    })();
  }
  return sessionPromise;
}

async function fetchLikeCounts() {
  try {
    const { data, error } = await supabaseClient.from('photo_like_counts').select('photo_id,like_count');
    if (error) throw error;
    const counts = {};
    (data || []).forEach((row) => { counts[row.photo_id] = row.like_count; });
    return counts;
  } catch (e) {
    console.error('AstroRaf: failed to fetch like counts', e);
    return {};
  }
}

async function toggleRemoteLike(photoId) {
  const session = await ensureSession();
  if (!session) return null;

  const likes = loadLocalLikes();
  const alreadyLiked = likes.includes(photoId);

  if (alreadyLiked) {
    const { error } = await supabaseClient
      .from('photo_likes')
      .delete()
      .eq('photo_id', photoId)
      .eq('visitor_id', session.user.id);
    if (error) { console.error('AstroRaf: unlike failed', error); return null; }
    saveLocalLikes(likes.filter((id) => id !== photoId));
    return false;
  }

  const { error } = await supabaseClient
    .from('photo_likes')
    .insert({ photo_id: photoId, visitor_id: session.user.id });
  if (error) { console.error('AstroRaf: like failed', error); return null; }
  likes.push(photoId);
  saveLocalLikes(likes);
  return true;
}
