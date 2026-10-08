import { describe, expect, it } from 'vitest';
import { isAcademicEmail, isStudentDiscountEligible } from './students';

describe('student discount', () => {
  it('accepts university addresses', () => {
    for (const email of ['a@ksu.edu.sa', 'b@stu.kau.edu.sa', 'C@KFUPM.EDU.SA', 'd@alfaisal.edu', 'e@cu.edu.eg', 'f@ox.ac.uk']) {
      expect(isAcademicEmail(email)).toBe(true);
    }
  });

  it('rejects everyday and look-alike addresses', () => {
    for (const email of ['a@gmail.com', 'b@outlook.sa', 'c@education.com', 'd@myedu.sa', 'e@company.com.sa', 'not-an-email']) {
      expect(isAcademicEmail(email)).toBe(false);
    }
  });

  it('needs both a university email and the student answer', () => {
    expect(isStudentDiscountEligible({ email: 'a@ksu.edu.sa', isStudent: true })).toBe(true);
    expect(isStudentDiscountEligible({ email: 'a@ksu.edu.sa', isStudent: false })).toBe(false);
    expect(isStudentDiscountEligible({ email: 'a@gmail.com', isStudent: true })).toBe(false);
    expect(isStudentDiscountEligible(null)).toBe(false);
  });
});
