/*
 * App-wide settings that aren't data.
 */

/** Who made Rusookh: shown on the "مبرمج تطبيق رسوخ" page (/developer). */
export const DEVELOPER = {
  name: 'عبدالرحمن السيد',
  role: 'مصمم ومبرمج واجهات محترف',
  linkedin: 'https://www.linkedin.com/in/abdulrhman-me/',
  instagram: 'https://www.instagram.com/abdulrhman.me/',
} as const;

/*
 * Manual payments: the student makes a bank transfer, sends a request, and
 * an admin activates the plan (see /checkout and the admin dashboard).
 *
 * These details are shown publicly on the checkout page.
 */
export const PAYMENT = {
  bank: {
    name: 'مصرف الإنماء',
    nameEnglish: 'Alinma Bank',
    /** Leave null to close checkout ("payments open soon"). Checked by a test (payments.test.ts). */
    iban: 'SA4005000068203011267000' as string | null,
  },
  /**
   * The account holder's name, shown so students can check they're sending to
   * the right person before confirming. Leave null to hide it.
   */
  recipientName: null as string | null,
  /** WhatsApp number for questions (international format, e.g. 9665…). null hides the button. */
  whatsapp: null as string | null,
  /** How long approval usually takes, as promised to students. */
  approvalTime: 'خلال 24 ساعة',
} as const;

/**
 * The admin dashboard's address. Not "/admin", which everyone tries first.
 * Hiding it is only a courtesy: the data is protected by the database's admin
 * checks. Keep in sync with ADMIN_PATH in supabase/functions/payment-emails.
 */
export const ADMIN_PATH = '/admrusskh';
