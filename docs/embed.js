/**
 * r8 Embeddable Widget
 *
 * Usage:
 *   <script src="https://YOUR-PAGES-URL/embed.js"></script>
 *   <div data-r8="ENTITY_UUID"></div>
 *
 * Renders a compact reputation card for the given entity.
 */
(function () {
  const R8_API = "https://jilnbtgphzvnnllqykkz.supabase.co";
  const R8_KEY = "sb_publishable_HFJLHB5qwizzvKATSNc5UA__uF1DJig";
  const R8_ORIGIN = (document.currentScript && document.currentScript.src)
    ? new URL(document.currentScript.src).origin : '';

  const STYLE = `
    @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400..700;1,400..700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
    .r8-widget{font-family:'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif;background:#FAF8F5;border:1px solid #E3DCD0;border-radius:4px;padding:18px 20px;color:#1E2220;max-width:320px;box-shadow:2px 2px 0px #E3DCD0}
    .r8-widget *{box-sizing:border-box;margin:0;padding:0}
    .r8-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}
    .r8-title{font-family:'Lora',Georgia,serif;font-size:16px;font-weight:600;line-height:1.3;color:#1E2220}
    .r8-cat{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#2C4D3F;margin-top:2px}
    .r8-score{font-size:28px;font-weight:700;line-height:1}
    .r8-score small{font-size:12px;color:#8E9893;font-weight:400}
    .r8-meta{font-size:12px;color:#5E6963;margin-top:10px;display:flex;justify-content:space-between;align-items:center}
    .r8-tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:8px}
    .r8-tag{font-size:10px;padding:3px 8px;border-radius:2px;background:#F3EDE4;color:#5E6963;border:1px solid #E3DCD0}
    .r8-brand{font-size:10px;color:#8E9893;margin-top:10px;text-align:right}
    .r8-brand a{color:#5E6963;text-decoration:none}
    .r8-brand a:hover{color:#2C4D3F}
    .r8-err{color:#A33A3A;font-size:13px}
  `;

  function injectStyle() {
    if (document.getElementById('r8-embed-style')) return;
    const s = document.createElement('style');
    s.id = 'r8-embed-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  function scoreColor(s) {
    if (s >= 8) return '#10b981';
    if (s >= 5) return '#f59e0b';
    return '#ef4444';
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  async function fetchEntity(id) {
    const res = await fetch(`${R8_API}/rest/v1/entity_stats?id=eq.${id}&select=*`, {
      headers: {
        'apikey': R8_KEY,
        'Authorization': `Bearer ${R8_KEY}`
      }
    });
    if (!res.ok) throw new Error('Failed to fetch');
    const data = await res.json();
    return data[0] || null;
  }

  async function fetchTags(entityId) {
    const res = await fetch(`${R8_API}/rest/v1/entity_tags?entity_id=eq.${entityId}&select=tag`, {
      headers: {
        'apikey': R8_KEY,
        'Authorization': `Bearer ${R8_KEY}`
      }
    });
    if (!res.ok) return [];
    return (await res.json()).map(r => r.tag);
  }

  async function renderWidget(container) {
    const id = container.getAttribute('data-r8');
    if (!id) return;

    container.innerHTML = '<div class="r8-widget" style="opacity:.5">Loading...</div>';

    try {
      const entity = await fetchEntity(id);
      if (!entity) {
        container.innerHTML = '<div class="r8-widget"><div class="r8-err">Entity not found.</div></div>';
        return;
      }

      const tags = await fetchTags(id);
      const link = R8_ORIGIN ? `${R8_ORIGIN}/entity.html?id=${id}` : '#';

      container.innerHTML = `
        <div class="r8-widget">
          <div class="r8-header">
            <div>
              <div class="r8-title">${esc(entity.title)}</div>
              <div class="r8-cat">${esc(entity.category)}</div>
            </div>
            <div class="r8-score" style="color:${scoreColor(entity.avg_score)}">${entity.avg_score}<small>/10</small></div>
          </div>
          ${tags.length ? '<div class="r8-tags">' + tags.slice(0, 5).map(t => `<span class="r8-tag">${esc(t)}</span>`).join('') + '</div>' : ''}
          <div class="r8-meta">
            <span>${entity.review_count} review${entity.review_count !== 1 ? 's' : ''}</span>
            <a href="${link}" target="_blank" style="color:#8b5cf6;text-decoration:none;font-weight:600">View on r8 →</a>
          </div>
          <div class="r8-brand"><a href="${R8_ORIGIN || '#'}" target="_blank">powered by r8</a></div>
        </div>
      `;
    } catch (e) {
      container.innerHTML = '<div class="r8-widget"><div class="r8-err">Could not load reputation data.</div></div>';
    }
  }

  function init() {
    injectStyle();
    document.querySelectorAll('[data-r8]').forEach(renderWidget);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
