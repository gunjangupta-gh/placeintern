// How an internship is compensated. Mirrors the backend enum InternshipCompensationType.
export const INTERNSHIP_TYPE = {
  WITH_STIPEND: 'WITH_STIPEND',
  WITHOUT_STIPEND: 'WITHOUT_STIPEND',
  PAID_BY_STUDENT: 'PAID_BY_STUDENT',
};

export const INTERNSHIP_TYPE_LABELS = {
  WITH_STIPEND: 'With Stipend',
  WITHOUT_STIPEND: 'Without Stipend',
  PAID_BY_STUDENT: 'Paid by Student',
};

export const INTERNSHIP_TYPE_OPTIONS = Object.entries(INTERNSHIP_TYPE_LABELS).map(([value, label]) => ({ value, label }));

// antd Tag colours
export const INTERNSHIP_TYPE_COLORS = {
  WITH_STIPEND: 'green',
  WITHOUT_STIPEND: 'default',
  PAID_BY_STUDENT: 'orange',
};

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

const positive = (v) => {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * One-line description of an internship's compensation for tables and cards.
 *  With Stipend -> "₹8,000/mo", Paid by Student -> "₹2,500 fee", Without Stipend -> "No stipend".
 * Internships saved before the type existed (no type) fall back to what the stipend says.
 */
export const formatCompensation = (app) => {
  const type = app?.internshipType;
  if (type === INTERNSHIP_TYPE.WITH_STIPEND) {
    const n = positive(app.stipend);
    return n ? `${inr(n)}/mo` : 'Stipend not entered';
  }
  if (type === INTERNSHIP_TYPE.PAID_BY_STUDENT) {
    const n = positive(app.studentFeeAmount);
    return n ? `${inr(n)} fee` : 'Fee not entered';
  }
  if (type === INTERNSHIP_TYPE.WITHOUT_STIPEND) return 'No stipend';
  const legacy = positive(app?.stipend);
  return legacy ? `${inr(legacy)}/mo` : '-';
};

/** The amount behind the type (stipend or fee) as a number, for sorting. null when there is none. */
export const compensationAmount = (app) => {
  if (app?.internshipType === INTERNSHIP_TYPE.PAID_BY_STUDENT) return positive(app.studentFeeAmount);
  return positive(app?.stipend);
};

/** True when the internship still needs its type (or the matching amount) filled in. */
export const isCompensationIncomplete = (app) => {
  const type = app?.internshipType;
  if (!type) return true;
  if (type === INTERNSHIP_TYPE.WITH_STIPEND) return positive(app.stipend) === null;
  if (type === INTERNSHIP_TYPE.PAID_BY_STUDENT) return positive(app.studentFeeAmount) === null;
  return false;
};

/** antd form values -> the API fields. Only the amount that matches the chosen type is sent. */
export const compensationPayload = (values) => ({
  internshipType: values.internshipType,
  stipend: values.internshipType === INTERNSHIP_TYPE.WITH_STIPEND ? values.stipend : null,
  studentFeeAmount: values.internshipType === INTERNSHIP_TYPE.PAID_BY_STUDENT ? values.studentFeeAmount : null,
});

/** Internship record -> antd form values. */
export const compensationFormValues = (app) => ({
  internshipType: app?.internshipType || undefined,
  stipend: positive(app?.stipend) ?? undefined,
  studentFeeAmount: positive(app?.studentFeeAmount) ?? undefined,
});
