export const normalizeRole = (roleRaw) => {
  if (!roleRaw) return null;
  const upper = roleRaw.toString().toUpperCase();

  switch (upper) {
    case 'STATE':
    case 'STATE_DIRECTORATE':
      return 'state';
    case 'PRINCIPAL':
      return 'principal';
    case 'FACULTY':
    case 'TEACHER':
    case 'FACULTY_SUPERVISOR':
      return 'faculty';
    case 'STUDENT':
      return 'student';
    case 'INDUSTRY':
    case 'INDUSTRY_PARTNER':
    case 'INDUSTRY_SUPERVISOR':
      return 'industry';
    default:
      return roleRaw.toString().toLowerCase();
  }
};

export const normalizeRoles = (roles) => {
  if (!Array.isArray(roles)) return [];
  return roles.map(normalizeRole).filter(Boolean);
};
