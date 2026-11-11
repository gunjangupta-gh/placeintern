/**
 * Column layout for the College-wise Compliance Summary workbook.
 * The generator returns one row per college containing every field below;
 * the Excel builder splits them into sheets by these column lists.
 */
export interface CollegeSummaryColumn {
  id: string;
  label: string;
  type: 'string' | 'number';
  width: number;
}

const col = (
  id: string,
  label: string,
  type: 'string' | 'number' = 'number',
  width = 16,
): CollegeSummaryColumn => ({ id, label, type, width });

export const COLLEGE_SUMMARY_SHEET1_NAME = 'Profile, Login & Mentor';
export const COLLEGE_SUMMARY_SHEET2_NAME = 'Internship Status';
export const COLLEGE_SUMMARY_SUMMARY_NAME = 'Summary';

/** Sheet 1: profile completion, login and mentor assignment (per college) */
export const COLLEGE_SUMMARY_SHEET1_COLUMNS: CollegeSummaryColumn[] = [
  col('sNo', 'S.No', 'number', 7),
  col('institutionName', 'College Name', 'string', 34),
  col('institutionCode', 'College Code', 'string', 14),
  col('district', 'District', 'string', 16),
  col('totalStudents', 'Total Active Students', 'number', 14),
  col('profileComplete', 'Profile Complete - Count'),
  col('profileCompletePct', 'Profile Complete - %'),
  col('profilePartial', 'Profile Partial - Count'),
  col('profileNotStarted', 'Profile Not Started - Count'),
  col('avgProfilePct', 'Avg Profile Completion %'),
  col('loggedIn', 'Logged In - Count'),
  col('loggedInPct', 'Logged In - %'),
  col('neverLoggedIn', 'Never Logged In - Count'),
  col('totalLogins', 'Total Login Count'),
  col('avgLogins', 'Avg Logins per Student'),
  col('mentorAssigned', 'Mentor Assigned - Count'),
  col('mentorAssignedPct', 'Mentor Assigned - %'),
  col('mentorNotAssigned', 'Mentor Not Assigned - Count'),
];

/** Sheet 2: internship applications - self-identified vs state opportunity */
export const COLLEGE_SUMMARY_SHEET2_COLUMNS: CollegeSummaryColumn[] = [
  col('sNo', 'S.No', 'number', 7),
  col('institutionName', 'College Name', 'string', 34),
  col('institutionCode', 'College Code', 'string', 14),
  col('totalStudents', 'Total Active Students', 'number', 14),
  col('appliedStudents', 'Students Applied (Any)'),
  col('notAppliedStudents', 'Students Not Applied'),
  col('applicationPct', 'Application %'),
  col('selfTotal', 'Self-Identified: Total Applications'),
  col('selfApplied', 'Self-Identified: Applied'),
  col('selfApproved', 'Self-Identified: Approved/Selected'),
  col('selfJoined', 'Self-Identified: Joined'),
  col('selfCompleted', 'Self-Identified: Completed'),
  col('selfRejected', 'Self-Identified: Rejected'),
  col('stateTotal', 'State Opportunity: Total Applications'),
  col('stateApplied', 'State Opportunity: Applied'),
  col('stateUnderReview', 'State Opportunity: Under Review/Shortlisted'),
  col('stateSelected', 'State Opportunity: Selected'),
  col('stateJoined', 'State Opportunity: Joined'),
  col('stateRejected', 'State Opportunity: Rejected'),
  col('selfStudents', 'Students with Self-Identified'),
  col('stateStudents', 'Students with State Opportunity'),
  col('bothStudents', 'Students with Both'),
  col('activeInternship', 'Currently Active Internship'),
];

/** Percentage fields are recomputed (weighted) on the Grand Total row. */
export const COLLEGE_SUMMARY_PCT_FIELDS: Record<
  string,
  { num: string; den: string }
> = {
  profileCompletePct: { num: 'profileComplete', den: 'totalStudents' },
  loggedInPct: { num: 'loggedIn', den: 'totalStudents' },
  mentorAssignedPct: { num: 'mentorAssigned', den: 'totalStudents' },
  applicationPct: { num: 'appliedStudents', den: 'totalStudents' },
};

/** Union of both sheets' columns (used for CSV/PDF/JSON exports). */
export const COLLEGE_SUMMARY_ALL_COLUMNS: CollegeSummaryColumn[] = (() => {
  const seen = new Set<string>();
  return [
    ...COLLEGE_SUMMARY_SHEET1_COLUMNS,
    ...COLLEGE_SUMMARY_SHEET2_COLUMNS,
  ].filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
})();
