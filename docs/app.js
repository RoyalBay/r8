/**
 * app.js — r8 core application logic
 * Handles auth, entities, reviews, appeals, moderation, toasts.
 */
const R8 = (function () {
  let sb = null;
  let currentUser = undefined; // undefined = loading, null = guest, object = logged-in
  let authListeners = [];

  function init() {
    if (!window.R8_URL || !window.R8_KEY) { console.error('r8: Missing config'); return; }
    sb = supabase.createClient(window.R8_URL, window.R8_KEY);
    _ensureToastContainer();

    sb.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        try {
          const { data: profile } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
          currentUser = profile ? { ...session.user, profile } : session.user;
        } catch (e) {
          currentUser = session.user;
        }
      } else {
        currentUser = null;
      }
      _updateNavAuth();
      authListeners.forEach(cb => cb(currentUser));
    });
  }

  function onAuthChange(callback) {
    authListeners.push(callback);
    if (currentUser !== undefined) {
      callback(currentUser);
    }
    return () => {
      authListeners = authListeners.filter(cb => cb !== callback);
    };
  }

  function _updateNavAuth() {
    const el = document.getElementById('navAuth');
    if (!el) return;
    if (currentUser) {
      const name = currentUser.profile?.username || currentUser.email?.split('@')[0] || 'User';
      el.innerHTML = `<a href="profile.html" class="btn btn-secondary btn-sm">${_esc(name)}</a>
        <button class="btn btn-ghost btn-sm" onclick="R8.signOut()">Sign Out</button>`;
    } else {
      el.innerHTML = `<a href="profile.html" class="btn btn-primary btn-sm">Sign In</a>`;
    }
  }

  async function signUp(username, email, password) {
    const { data, error } = await sb.auth.signUp({
      email, password,
      options: { data: { username } }
    });
    if (error) throw error;
    if (data.user && data.session) {
      await _checkSession();
      toast('Account created!', 'success');
      return data;
    }
    toast('Check your email to confirm.', 'info');
    return data;
  }

  async function signIn(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await _checkSession();
    toast('Signed in!', 'success');
    return data;
  }

  async function signOut() {
    await sb.auth.signOut();
    currentUser = null;
    _updateNavAuth();
    toast('Signed out.', 'info');
    if (!location.pathname.includes('index.html') && !location.pathname.endsWith('/'))
      location.href = 'index.html';
  }

  // ── Entities ──
  async function getEntities({ search, category, limit = 20 } = {}) {
    let q = sb.from('entity_stats').select('*').order('review_count', { ascending: false }).limit(limit);
    if (search) q = q.ilike('title', `%${search}%`);
    if (category && category !== 'All') q = q.eq('category', category);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function getEntity(id) {
    const { data, error } = await sb.from('entity_stats').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  }

  async function createEntity(title, category, description) {
    if (!currentUser) throw new Error('Sign in required');
    const { data, error } = await sb.from('entities').insert({
      title, category, description, created_by: currentUser.id
    }).select().single();
    if (error) throw error;
    toast('Entity created!', 'success');
    return data;
  }

  async function getEntityTags(entityId) {
    const { data } = await sb.from('entity_tags').select('tag').eq('entity_id', entityId);
    return (data || []).map(r => r.tag);
  }

  // ── Reviews ──
  async function getReviews(entityId) {
    const { data, error } = await sb.from('reviews')
      .select('*, profiles:reviewer_id(username, trust_score, created_at), review_tags(tag)')
      .eq('entity_id', entityId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function getUserReviews(userId) {
    const { data, error } = await sb.from('reviews')
      .select('*, entities:entity_id(title, category), review_tags(tag)')
      .eq('reviewer_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function createReview(entityId, score, content, interactionType, tags) {
    if (!currentUser) throw new Error('Sign in required');
    const { data: review, error } = await sb.from('reviews').insert({
      entity_id: entityId,
      reviewer_id: currentUser.id,
      score, content,
      interaction_type: interactionType
    }).select().single();
    if (error) throw error;

    if (tags && tags.length > 0) {
      const tagRows = tags.map(t => ({ review_id: review.id, tag: t.trim() }));
      await sb.from('review_tags').insert(tagRows);
    }
    toast('Review submitted!', 'success');
    return review;
  }

  // ── Appeals ──
  async function submitAppeal(reviewId, reason, evidenceUrl) {
    if (!currentUser) throw new Error('Sign in required');
    const { data, error } = await sb.from('appeals').insert({
      review_id: reviewId,
      submitted_by: currentUser.id,
      reason,
      evidence_url: evidenceUrl || ''
    }).select().single();
    if (error) throw error;
    toast('Appeal submitted for review.', 'success');
    return data;
  }

  async function getAppeals(status) {
    let q = sb.from('appeals')
      .select('*, profiles:submitted_by(username), reviews:review_id(content, entity_id)')
      .order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  // ── Moderation ──
  async function getModActions(limit = 50) {
    const { data, error } = await sb.from('mod_actions')
      .select('*, profiles:moderator_id(username)')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  // ── Categories ──
  async function getCategories() {
    const { data, error } = await sb.from('entities').select('category');
    if (error) return ['General'];
    const unique = [...new Set((data || []).map(e => e.category).filter(Boolean))];
    return unique.length ? unique : ['General'];
  }

  // ── Realtime ──
  function subscribeReviews(entityId, callback) {
    return sb.channel(`reviews:${entityId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reviews', filter: `entity_id=eq.${entityId}` }, callback)
      .subscribe();
  }

  // ── Helpers ──
  function getUser() { return currentUser; }
  function getClient() { return sb; }

  function toast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  function _ensureToastContainer() {
    if (document.getElementById('toastContainer')) return;
    const c = document.createElement('div');
    c.id = 'toastContainer';
    c.className = 'toast-container';
    document.body.appendChild(c);
  }

  function _esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function timeAgo(ts) {
    const s = Math.floor((Date.now() - new Date(ts)) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 2592000) return Math.floor(s / 86400) + 'd ago';
    return new Date(ts).toLocaleDateString();
  }

  function scoreColor(score) {
    if (score >= 8) return 'var(--green)';
    if (score >= 5) return 'var(--amber)';
    return 'var(--red)';
  }

  function icon(name, size = 24) {
    const paths = {
      search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
      close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
      chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
      edit: '<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
      clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
      scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
      trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
      'eye-off': '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="m1 1 22 22"/>',
      ban: '<circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 14.14 14.14"/>',
      'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
      'x-circle': '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
      pin: '<line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>'
    };
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name] || ''}</svg>`;
  }

  return {
    init, signUp, signIn, signOut,
    getEntities, getEntity, createEntity, getEntityTags,
    getReviews, getUserReviews, createReview,
    submitAppeal, getAppeals,
    getModActions, getCategories,
    subscribeReviews,
    getUser, getClient, toast, timeAgo, scoreColor, icon, onAuthChange
  };
})();

document.addEventListener('DOMContentLoaded', () => R8.init());
