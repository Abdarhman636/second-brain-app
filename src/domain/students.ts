/*
 * Student discount. A student gets it by signing up (or switching their
 * account) to a university email address. Since an account's email must be
 * confirmed before signing in, having one proves they own the address.
 *
 * "Academic" means an academic domain (…edu, …edu.sa, …ac.uk), not merely
 * "not Gmail": anyone can buy a domain for a few riyals, but academic
 * domains are only given to institutions. Every Saudi university uses
 * .edu.sa (ksu.edu.sa, kau.edu.sa, kfupm.edu.sa, …).
 *
 * The database applies the same rule when pricing a payment request
 * (public.is_academic_email in supabase/schema.sql). Keep the two in sync.
 */

const ACADEMIC_DOMAIN = /(^|\.)(edu|edu\.[a-z]{2}|ac\.[a-z]{2})$/;

export function getEmailDomain(email: string): string {
  return email.trim().toLowerCase().split('@')[1] ?? '';
}

export function isAcademicEmail(email: string): boolean {
  return ACADEMIC_DOMAIN.test(getEmailDomain(email));
}

/** Students on a university email pay the student price. */
export function isStudentDiscountEligible(user: { email: string; isStudent: boolean | null } | null): boolean {
  return Boolean(user?.isStudent && isAcademicEmail(user.email));
}

/** Shown as an example of what counts. */
export const ACADEMIC_EMAIL_EXAMPLE = 'name@ksu.edu.sa';
