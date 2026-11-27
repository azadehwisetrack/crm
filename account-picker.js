import { el } from './ui.js';
import { field } from './fields.js';
import { normFa } from './normalize.js';

let uid = 0;

// Type-ahead account chooser (works with thousands of accounts). getId() is the chosen account id, or null.
export function accountPicker(accounts, initialId = null, labelText = 'اکانت *') {
  const listId = 'acc-list-' + (++uid);
  const byName = new Map(accounts.map((a) => [normFa(a.name), a.id]));
  const input = el('input', { type: 'text', autocomplete: 'off', list: listId, placeholder: 'شروع به نوشتن کنید و از فهرست انتخاب کنید' });
  const f = field(labelText, input);
  f.root.append(el('datalist', { id: listId }, accounts.map((a) => el('option', { value: a.name }))));
  const initial = accounts.find((a) => a.id === initialId);
  if (initial) input.value = initial.name;

  const getId = () => byName.get(normFa(input.value)) ?? null;
  let last = getId();
  const listeners = [];
  const fire = () => { const id = getId(); f.hint.textContent = input.value.trim() && !id ? 'اکانتی با این عنوان پیدا نشد؛ از فهرست انتخاب کنید.' : ''; if (id !== last) { last = id; listeners.forEach((cb) => cb(id)); } };
  input.addEventListener('input', fire);
  input.addEventListener('change', fire);
  return { root: f.root, input, getId, onPick: (cb) => listeners.push(cb) };
}
