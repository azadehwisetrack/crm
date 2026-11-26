import { el, clear } from './ui.js';
import { api } from './api.js';
import { normFa } from './normalize.js';

// Global search box: debounce 250 ms, calls rpc_search, arrow keys + Enter open an account.
export function createSearchBox({ onPick } = {}) {
  const input = el('input', { type: 'search', class: 'search-input', placeholder: 'جستجو: اکانت، کانتکت یا موبایل (/)', autocomplete: 'off', 'aria-label': 'جستجو' });
  const list = el('ul', { class: 'search-results', role: 'listbox', hidden: true });
  const root = el('div', { class: 'search' }, input, list);

  let results = [], active = -1, seq = 0, timer = null, lastQ = null, searched = false, failed = false;

  const open = (r) => {
    input.value = ''; results = []; searched = false; list.hidden = true; lastQ = null;
    if (onPick) onPick(r); else location.hash = '#/account/' + r.account_id;
  };

  function draw() {
    clear(list);
    list.hidden = !(searched || failed);
    if (failed) { list.append(el('li', { class: 'search-empty error' }, 'جستجو ناموفق بود. دوباره تلاش کنید.')); return; }
    if (searched && !results.length) { list.append(el('li', { class: 'search-empty' }, 'نتیجه‌ای پیدا نشد.')); return; }
    results.forEach((r, i) => {
      const sub = [r.district, r.city].filter(Boolean).join('، ');
      const li = el('li', { role: 'option', class: 'search-item' + (i === active ? ' active' : ''), 'aria-selected': String(i === active) },
        el('span', { class: 'search-name' }, r.account_name, el('span', { class: 'muted' }, ` ${r.account_code}`)),
        sub ? el('span', { class: 'muted' }, sub) : null,
        r.stage ? el('span', { class: 'badge stage-' + r.stage.replace(' ', '-') }, r.stage) : null,
        r.contact_name || r.contact_mobile ? el('span', { class: 'muted search-contact' }, [r.contact_name, r.contact_mobile].filter(Boolean).join(' · ')) : null);
      li.addEventListener('mousedown', (e) => { e.preventDefault(); open(r); });
      list.append(li);
    });
  }

  async function doSearch() {
    const q = input.value;
    if (!normFa(q)) { results = []; searched = false; failed = false; lastQ = null; draw(); return results; }
    const my = ++seq;
    try {
      const rows = await api.search(q);
      if (my !== seq) return null;
      results = rows; active = rows.length ? 0 : -1; searched = true; failed = false; lastQ = q;
    } catch {
      if (my !== seq) return null;
      results = []; searched = false; failed = true;
    }
    draw();
    return results;
  }

  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(doSearch, 250); });
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'ArrowDown' && results.length) { e.preventDefault(); active = (active + 1) % results.length; draw(); }
    else if (e.key === 'ArrowUp' && results.length) { e.preventDefault(); active = (active - 1 + results.length) % results.length; draw(); }
    else if (e.key === 'Escape') { input.value = ''; results = []; searched = false; failed = false; draw(); input.blur(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(timer);
      const rows = lastQ === input.value ? results : await doSearch();
      const pick = rows && rows[Math.max(active, 0)];
      if (pick) open(pick);
    }
  });
  input.addEventListener('blur', () => { list.hidden = true; });
  input.addEventListener('focus', () => { if (searched || failed) list.hidden = false; });

  return { root, input, focus: () => input.focus() };
}
