/**
 * app.js — Core logic for r8.
 */

document.addEventListener('DOMContentLoaded', () => {
  const supabaseUrl = window.R8_URL;
  const supabaseKey = window.R8_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase configuration missing.');
    return;
  }

  const sb = supabase.createClient(supabaseUrl, supabaseKey);

  // Check auth state
  checkUser();

  // Load trending entities
  loadTrending();

  async function checkUser() {
    const { data: { user } } = await sb.auth.getUser();
    const profileLink = document.getElementById('profileLink');
    if (user) {
      profileLink.innerText = 'Profile';
      profileLink.href = 'profile.html';
    } else {
      profileLink.innerText = 'Sign In';
      profileLink.href = 'profile.html';
    }
  }

  async function loadTrending() {
    const grid = document.getElementById('entityGrid');
    
    try {
      const { data: entities, error } = await sb
        .from('entities')
        .select('*')
        .limit(6);

      if (error) throw error;

      if (entities && entities.length > 0) {
        // Clear mocked content and inject real data
        grid.innerHTML = '';
        entities.forEach(entity => {
          grid.appendChild(createEntityCard(entity));
        });
      }
    } catch (err) {
      console.warn('Failed to fetch real entities, showing mocks.', err);
    }
  }

  function createEntityCard(entity) {
    const card = document.createElement('div');
    card.className = 'card';
    card.onclick = () => location.href = `entity.html?id=${entity.id}`;
    
    card.innerHTML = `
      <div class="card-category">${entity.category || 'General'}</div>
      <h3 class="card-title">${entity.title}</h3>
      <p class="card-desc">${entity.description || 'No description available.'}</p>
      <div class="card-footer">
        <div class="score">${entity.reputation || '0.0'}<span>/10</span></div>
        <div style="font-size: 12px; color: var(--text-muted);">Recent activity</div>
      </div>
    `;
    return card;
  }
});
