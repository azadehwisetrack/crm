export const t = {
  appName: 'CRM داروخانه‌ها',
  login: 'ورود', email: 'ایمیل', password: 'رمز عبور', logout: 'خروج',
  loginFailed: 'ایمیل یا رمز عبور درست نیست.',
  noProfile: 'این حساب فعال نیست یا هنوز دسترسی برایش تعریف نشده است. با مدیر تماس بگیرید.',
  noAccess: 'دسترسی این حساب به بخش‌های برنامه هنوز تعریف نشده است. با مدیر تماس بگیرید.',
  notFound: 'صفحه پیدا نشد.',
  networkError: 'ارتباط با سرور برقرار نشد. اینترنت یا فیلترشکن را بررسی کنید.',
  forbidden: 'دسترسی به این بخش مجاز نیست.',
  duplicate: 'این مقدار قبلاً ثبت شده است.',
  invalidValue: 'مقدار واردشده مجاز نیست.',
  unexpected: 'خطای غیرمنتظره رخ داد.',
};

export const NAV = [['/dashboard', 'داشبورد'], ['/accounts', 'اکانت‌ها'], ['/persons', 'اشخاص'], ['/tasks', 'کارها'], ['/settings', 'تنظیمات']];

// Sales status of a product on an account (stored in opportunities.stage).
export const STAGE_LABELS = { New: 'بالقوه', 'In progress': 'در جریان', Won: 'پیروزی', Lost: 'شکست', Pending: 'در انتظار' };
export const STAGE_CHOICES = ['New', 'In progress', 'Won', 'Lost'];
