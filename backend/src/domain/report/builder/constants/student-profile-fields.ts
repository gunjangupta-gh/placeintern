/**
 * Fields counted towards student profile completion.
 * Mirrors the editable fields on the student profile page
 * (frontend/src/features/student/profile/StudentProfile.jsx).
 */
export const STUDENT_PROFILE_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'dob', label: 'Date of Birth' },
  { key: 'gender', label: 'Gender' },
  { key: 'category', label: 'Category' },
  { key: 'admissionType', label: 'Admission Type' },
  { key: 'parentName', label: 'Parent Name' },
  { key: 'parentContact', label: 'Parent Contact' },
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City/Village' },
  { key: 'tehsil', label: 'Tehsil' },
  { key: 'district', label: 'District' },
  { key: 'state', label: 'State' },
  { key: 'pinCode', label: 'Pin Code' },
  { key: 'profileImage', label: 'Profile Photo' },
] as const;

export const profileFieldColumnId = (key: string) => `has_${key}`;
