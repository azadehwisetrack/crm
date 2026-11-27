import { el, clear, toast, toastError, friendlyError } from './ui.js';
import { api } from './api.js';
import { loadLists } from './lists.js';
import { STAGE_LABELS, STAGE_CHOICES } from './i18n.js';
import { buildTasksTable } from './tasks-ui.js';
import { openAccountDialog } from './dlg-account.js';
import { openPersonDialog } from './dlg-person.js';
import { openTaskDialog } from './dlg-task.js';

const td = (c, cls) => el('td', { class: cls }, c);
const th = (...h) => el('thead', {}, el('tr', {}, h.map((x) => el('th', {}, x))));
const btn = (text, fn, cls = '') => { const b = el('button', { type: 'button', class: cls }, text); b.addEventListener('click', fn); return b; };

export async function renderAccount(view, { params }) {
  const id = params.id;
  let d = null;

  async function load() {
    if (!d) view.append(el('div', { class: 'card muted' }, 'در حال بارگذاری…'));
    try {
      const [account, persons, products, opps, tasks, lists] = await Promise.all([
        api.account(id), api.accountPersons(id), api.activeProducts(), api.accountOpps(id), api.accountTasks(id), loadLists()]);
      d = { account, persons, products, opps, tasks, lists };
    } catch (e) {
      if (!d) { clear(view); view.append(el('div', { class: 'card error' }, 'بارگذاری اکانت ناموفق بود.')); }
      toastError(e); return;
    }
    build();
  }

  function build() {
    clear(view);
    const { account, persons, products, opps, tasks, lists } = d;
    if (!account) { view.append(el('div', { class: 'card' }, 'اکانت پیدا نشد. ', el('a', { href: '#/accounts' }, 'بازگشت به اکانت‌ها'))); return; }
    const info = [['تلفن', account.landline, 'ltr'], ['شهر', account.city], ['منطقه', account.district], ['آدرس', account.address], ['حوزه فعالیت', account.activity_fields?.name]];

    view.append(el('div', { class: 'card' },
      el('div', { class: 'row' }, el('h1', {}, account.name), btn('ویرایش اکانت', () => openAccountDialog({ account, onSaved: load }))),
      el('dl', { class: 'info' }, info.map(([k, v, cls]) => [el('dt', {}, k), el('dd', { class: cls || '' }, v || '—')]))));

    view.append(el('div', { class: 'card' },
      el('div', { class: 'row' }, el('h2', {}, 'اشخاص'), btn('+ شخص', () => openPersonDialog({ account, onSaved: load }), 'primary')),
      persons.length ? el('div', { class: 'table-wrap' }, el('table', {}, th('نام', 'نام خانوادگی', 'موبایل', 'عنوان شغلی', ''),
        el('tbody', {}, persons.map((p) => el('tr', {}, td(p.first_name || '—'), td(p.last_name), td(p.mobile ? el('a', { href: 'tel:' + p.mobile, class: 'ltr' }, p.mobile) : '—'),
          td(p.job_title || '—'), td(btn('ویرایش', () => openPersonDialog({ person: p, account, onSaved: load }), 'small-btn'))))))) : el('p', { class: 'muted' }, 'شخصی برای این اکانت ثبت نشده است.')));

    view.append(el('div', { class: 'card' }, el('h2', {}, 'محصولات و وضعیت فروش'),
      products.length ? el('div', { class: 'table-wrap' }, el('table', {}, th('محصول', 'وضعیت فروش'),
        el('tbody', {}, products.map((p) => {
          const opp = opps.find((o) => o.product_id === p.id);
          const sel = el('select', { class: 'status-select', 'aria-label': 'وضعیت فروش ' + p.name },
            el('option', { value: '', selected: !opp, disabled: !!opp }, '— انتخاب کنید —'),
            ...STAGE_CHOICES.map((s) => el('option', { value: s, selected: opp?.stage === s }, STAGE_LABELS[s])));
          sel.addEventListener('change', async () => {
            sel.disabled = true;
            try {
              await api.setProductStatus(account.id, p.id, sel.value);
              const cur = opps.find((o) => o.product_id === p.id);
              if (cur) cur.stage = sel.value; else opps.push({ product_id: p.id, stage: sel.value });
              sel.firstChild.disabled = true;
              toast('وضعیت فروش ذخیره شد.', 'ok');
            } catch (e) { toast(friendlyError(e), 'error'); sel.value = opp?.stage ?? ''; } finally { sel.disabled = false; }
          });
          return el('tr', {}, td(p.name), td(sel));
        })))) : el('p', { class: 'muted' }, 'هنوز محصولی تعریف نشده است. از تنظیمات ← محصولات اضافه کنید.')));

    view.append(el('div', { class: 'card' },
      el('div', { class: 'row' }, el('h2', {}, 'کارهای این اکانت'), btn('+ کار جدید', () => openTaskDialog({ account, onSaved: load }), 'primary')),
      tasks.length ? buildTasksTable(tasks, { statuses: lists.statuses, omit: ['account', 'district'], onChanged: load, onEdit: (r) => openTaskDialog({ task: r, onSaved: load }) })
        : el('p', { class: 'muted' }, 'کاری برای این اکانت ثبت نشده است.')));
  }
  await load();
}
