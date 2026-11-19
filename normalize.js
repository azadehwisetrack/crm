// Mirrors SQL norm_fa / norm_mobile so client and database agree.
export function toLatinDigits(s) {
  return String(s ?? '')
    .replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)))
    .replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
}

export function normFa(s) {
  if (s == null) return '';
  return toLatinDigits(String(s).replace(/ي/g, 'ی').replace(/ك/g, 'ک'))
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

export function normMobile(s) {
  if (s == null) return '';
  const d = toLatinDigits(s).replace(/[^0-9]/g, '');
  if (/^0098/.test(d)) return '0' + d.slice(4);
  if (/^98[0-9]{10}$/.test(d)) return '0' + d.slice(2);
  if (/^9[0-9]{9}$/.test(d)) return '0' + d;
  return d;
}

export const isMobile = (s) => /^09[0-9]{9}$/.test(normMobile(s));
