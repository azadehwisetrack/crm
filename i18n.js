export const t = {
  appName: 'CRM داروخانه‌ها',
  login: 'ورود', email: 'ایمیل', password: 'رمز عبور', logout: 'خروج',
  loginFailed: 'ایمیل یا رمز عبور درست نیست.',
  noProfile: 'این حساب فعال نیست یا هنوز دسترسی برایش تعریف نشده است. با مدیر تماس بگیرید.',
  notFound: 'صفحه پیدا نشد.',
  networkError: 'ارتباط با سرور برقرار نشد. اینترنت یا فیلترشکن را بررسی کنید.',
  forbidden: 'دسترسی به این بخش مجاز نیست.',
  duplicate: 'این مقدار قبلاً ثبت شده است.',
  invalidValue: 'مقدار واردشده مجاز نیست.',
  unexpected: 'خطای غیرمنتظره رخ داد.',
};

export const NAV = {
  sales: [['/search', 'جستجو'], ['/queues', 'صف‌ها'], ['/plan', 'برنامه روز'], ['/dashboard', 'داشبورد'], ['/support', 'پشتیبانی'], ['/settings', 'تنظیمات']],
  support: [['/support', 'پشتیبانی']],
};

export const ACTIVITY_TYPES = [['call', 'تماس'], ['meeting', 'جلسه'], ['note', 'یادداشت']];
export const STAGES = ['New', 'In progress', 'Pending', 'Won', 'Lost'];
