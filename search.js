import { el } from './ui.js';
import { createSearchBox } from './searchbox.js';
import { openAccountForm } from './dialogs/accountForm.js';

export async function renderSearch(view) {
  const box = createSearchBox();
  const newBtn = el('button', { type: 'button', class: 'primary' }, '+ اکانت جدید');
  newBtn.addEventListener('click', () => openAccountForm({ onSaved: (a) => { location.hash = '#/account/' + a.id; } }));
  box.root.classList.add('search-big');
  view.append(el('div', { class: 'card' },
    el('h1', {}, 'جستجو'),
    el('p', { class: 'muted' }, 'نام اکانت، نام کانتکت یا بخشی از شمارهٔ موبایل را بنویسید. کلید / از هر جای برنامه به جستجو می‌رود.'),
    box.root,
    el('div', { class: 'actions top-gap' }, newBtn)));
  box.focus();
}
