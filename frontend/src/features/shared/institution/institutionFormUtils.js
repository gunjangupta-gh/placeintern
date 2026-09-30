import dayjs from 'dayjs';

// Shared by the State institution modal and the Principal "My Institution" page.

export const INTEGER_FIELDS = new Set([
  'establishedYear',
  'totalStudentSeats',
  'totalStaffSeats',
  'computersCount',
]);

export const FLOAT_FIELDS = new Set([
  'latitude',
  'longitude',
  'totalLandAcres',
]);

// Yes/No <Select> fields hold the strings 'true' / 'false' in the form and are
// sent as booleans. Empty means "not filled in" (null on the server), which is
// different from an explicit No.
export const BOOLEAN_SELECT_FIELDS = [
  'hasLandDispute',
  'hasLibrary',
  'libraryAictBooksAvailable',
  'hasCollegeBus',
  'busHasDriver',
  'computersAllInternetConnected',
];

export const YES_NO_OPTIONS = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

export const COVERED_AREA_ENTITIES = [
  { value: 'LECTURE_ROOMS', label: 'Lecture Rooms' },
  { value: 'LABS', label: 'Labs' },
  { value: 'WORKSHOPS', label: 'Workshops' },
  { value: 'COMMON_AREA', label: 'Common Area' },
  { value: 'OTHERS', label: 'Others' },
];

export const LAND_OWNERSHIP_OPTIONS = [
  { value: 'OWNED', label: 'Owned' },
  { value: 'LEASED', label: 'Leased' },
  { value: 'GOVERNMENT_ALLOTTED', label: 'Government Allotted' },
  { value: 'PPP', label: 'PPP' },
  { value: 'OTHER', label: 'Other' },
];

// Institution Types (aligned with backend InstitutionType enum, schema.prisma).
export const INSTITUTION_TYPES = [
  { value: 'GOVT_POLYTECHNIC', label: 'Govt. Polytechnic' },
  { value: 'GOVT_AIDED_POLYTECHNIC', label: 'Govt. Aided Polytechnic' },
  { value: 'PRIVATE_POLYTECHNIC', label: 'Private Polytechnic' },
  { value: 'GOVT_ITI', label: 'Govt. ITI' },
  { value: 'GOVT_AIDED_ITI', label: 'Govt. Aided ITI' },
  { value: 'PRIVATE_ITI', label: 'Private ITI' },
  { value: 'GOVT_SPECIAL_TRADE_INSTITUTE', label: 'Govt. Special Trade Institute' },
  { value: 'GOVT_AIDED_SPECIAL_TRADE_INSTITUTE', label: 'Govt. Aided Special Trade Institute' },
  { value: 'PRIVATE_SPECIAL_TRADE_INSTITUTE', label: 'Private Special Trade Institute' },
  { value: 'ENGINEERING_COLLEGE', label: 'Engineering College' },
  { value: 'UNIVERSITY', label: 'University' },
  { value: 'DEGREE_COLLEGE', label: 'Degree College' },
  { value: 'SKILL_CENTER', label: 'Skill Center' },
];

// Fields a principal may edit (mirrors UpdatePrincipalInstitutionDto on the
// backend). Everything else - code, type, isActive, seat totals - is state-only.
export const PRINCIPAL_EDITABLE_FIELDS = [
  'name', 'shortName', 'address', 'city', 'district', 'state', 'pinCode', 'country',
  'contactEmail', 'contactPhone', 'website',
  'latitude', 'longitude', 'gpsMapLink',
  'affiliatedTo', 'recognizedBy', 'establishedYear',
  'totalLandAcres', 'landOwnership', 'hasLandDispute',
  'hasLibrary', 'libraryAictBooksAvailable', 'hasCollegeBus', 'busHasDriver',
  'computersCount', 'computersAllInternetConnected',
];

export const toNumberOrUndefined = (value) => {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const isBlank = (value) => value === '' || value === null || value === undefined;

const selectToBoolean = (value) => (isBlank(value) ? undefined : value === true || value === 'true');

const booleanToSelect = (value) => (value === undefined || value === null ? undefined : String(value));

export const getDefaultAcademicYear = () => {
  const year = new Date().getFullYear();
  const nextYear = String((year + 1) % 100).padStart(2, '0');
  return `${year}-${nextYear}`;
};

const isCoveredAreaRowFilled = (row = {}) => {
  const keysToCheck = [
    'numberOfRooms',
    'requiredAreaSqFt',
    'availableAreaSqFt',
    'additionalRequirementSqFt',
    'declaredUnsafeAreaSqFt',
    'lastMajorRepairDate',
    'futureExpansionScope',
    'furnitureAvailable',
    'smartBoardsCount',
  ];
  return keysToCheck.some((key) => !isBlank(row[key]));
};

export const buildDefaultCoveredAreaRows = () => COVERED_AREA_ENTITIES.map((entity) => ({
  entityType: entity.value,
  numberOfRooms: undefined,
  requiredAreaSqFt: undefined,
  availableAreaSqFt: undefined,
  additionalRequirementSqFt: undefined,
  declaredUnsafeAreaSqFt: undefined,
  lastMajorRepairDate: null,
  futureExpansionScope: '',
  furnitureAvailable: undefined,
  smartBoardsCount: undefined,
}));

export const buildDefaultBranchIntakeRows = () => ([{
  branchId: undefined,
  batchId: undefined,
  academicYear: getDefaultAcademicYear(),
  sanctionedSeats: 0,
  feeWaiverSeats: 0,
  isActive: true,
}]);

export const buildDefaultStaffCapacityRows = () => ([{
  branchId: undefined,
  academicYear: getDefaultAcademicYear(),
  sanctionedPosts: 0,
  filledPosts: 0,
  guestFaculty: 0,
  isActive: true,
}]);

export const normalizeLookupList = (response, key) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.[key])) return response[key];
  if (Array.isArray(response?.data?.[key])) return response.data[key];
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

const buildCoveredAreaRow = (row) => ({
  entityType: row.entityType,
  numberOfRooms: toNumberOrUndefined(row.numberOfRooms),
  requiredAreaSqFt: toNumberOrUndefined(row.requiredAreaSqFt),
  availableAreaSqFt: toNumberOrUndefined(row.availableAreaSqFt),
  additionalRequirementSqFt: toNumberOrUndefined(row.additionalRequirementSqFt),
  declaredUnsafeAreaSqFt: toNumberOrUndefined(row.declaredUnsafeAreaSqFt),
  lastMajorRepairDate: row.lastMajorRepairDate ? row.lastMajorRepairDate.toISOString() : undefined,
  futureExpansionScope: row.futureExpansionScope || undefined,
  furnitureAvailable: selectToBoolean(row.furnitureAvailable),
  smartBoardsCount: toNumberOrUndefined(row.smartBoardsCount),
});

// State payload: empty fields are omitted; covered areas use the Prisma nested
// write (replace-all), exactly as before.
export const sanitizeInstitutionPayload = (values) => {
  const basePayload = { ...values, isActive: values.isActive === 'true' };
  BOOLEAN_SELECT_FIELDS.forEach((field) => {
    basePayload[field] = selectToBoolean(values[field]);
  });

  const sanitized = Object.entries(basePayload).reduce((acc, [key, value]) => {
    if (key === 'branchIntakes' || key === 'staffCapacities' || key === 'coveredAreaDetails') {
      return acc;
    }

    if (isBlank(value)) {
      return acc;
    }

    if (INTEGER_FIELDS.has(key) || FLOAT_FIELDS.has(key)) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        acc[key] = parsed;
      }
      return acc;
    }

    acc[key] = value;
    return acc;
  }, {});

  const coveredAreaRows = (values.coveredAreaDetails || [])
    .map(buildCoveredAreaRow)
    .filter((row) => row.entityType && isCoveredAreaRowFilled(row));

  if (coveredAreaRows.length > 0) {
    sanitized.coveredAreaDetails = {
      deleteMany: {},
      create: coveredAreaRows,
    };
  }

  return sanitized;
};

/**
 * Principal payload: strict allow-list, and cleared fields are sent as null so
 * they can actually be emptied. Covered-area rows are sent as a plain array
 * (the server upserts per entity type and never deletes), and only for rows
 * that are filled or already existed - so untouched entities are not created.
 */
export const buildPrincipalInstitutionPayload = (values, existingEntityTypes = []) => {
  const payload = {};

  PRINCIPAL_EDITABLE_FIELDS.forEach((field) => {
    const value = values[field];
    if (BOOLEAN_SELECT_FIELDS.includes(field)) {
      payload[field] = selectToBoolean(value) ?? null;
    } else if (INTEGER_FIELDS.has(field) || FLOAT_FIELDS.has(field)) {
      payload[field] = toNumberOrUndefined(value) ?? null;
    } else {
      payload[field] = isBlank(value) ? null : value;
    }
  });

  payload.coveredAreaDetails = (values.coveredAreaDetails || [])
    .filter((row) => row.entityType && (isCoveredAreaRowFilled(row) || existingEntityTypes.includes(row.entityType)))
    .map((row) => {
      const built = buildCoveredAreaRow(row);
      return {
        ...Object.fromEntries(Object.entries(built).map(([k, v]) => [k, v === undefined ? null : v])),
        entityType: row.entityType,
      };
    });

  return payload;
};

export const sanitizeBranchIntakeRows = (rows = []) => rows
  .map((row) => ({
    branchId: row.branchId || undefined,
    batchId: row.batchId || undefined,
    academicYear: row.academicYear ? String(row.academicYear).trim() : undefined,
    sanctionedSeats: isBlank(row.sanctionedSeats) ? 0 : Number(row.sanctionedSeats),
    feeWaiverSeats: isBlank(row.feeWaiverSeats) ? 0 : Number(row.feeWaiverSeats),
    isActive: row.isActive !== false,
  }))
  .filter((row) => row.branchId && row.academicYear);

export const sanitizeStaffCapacityRows = (rows = []) => rows
  .map((row) => ({
    branchId: row.branchId || undefined,
    academicYear: row.academicYear ? String(row.academicYear).trim() : undefined,
    sanctionedPosts: isBlank(row.sanctionedPosts) ? 0 : Number(row.sanctionedPosts),
    isActive: row.isActive !== false,
  }))
  .filter((row) => row.branchId && row.academicYear);

export const buildInstitutionFormValues = (institution) => {
  const existingCoveredArea = (institution?.coveredAreaDetails || []).reduce((acc, row) => {
    acc[row.entityType] = {
      ...row,
      lastMajorRepairDate: row.lastMajorRepairDate ? dayjs(row.lastMajorRepairDate) : null,
      furnitureAvailable: booleanToSelect(row.furnitureAvailable),
    };
    return acc;
  }, {});

  const booleanSelects = BOOLEAN_SELECT_FIELDS.reduce((acc, field) => {
    acc[field] = booleanToSelect(institution?.[field]);
    return acc;
  }, {});

  return {
    ...institution,
    ...booleanSelects,
    isActive: institution?.isActive?.toString(),
    coveredAreaDetails: COVERED_AREA_ENTITIES.map((entity) => ({
      entityType: entity.value,
      ...(existingCoveredArea[entity.value] || {}),
    })),
    branchIntakes: (institution?.branchIntakes?.length ? institution.branchIntakes : buildDefaultBranchIntakeRows()).map((row) => ({
      branchId: row.branchId,
      batchId: row.batchId || undefined,
      academicYear: row.academicYear || getDefaultAcademicYear(),
      sanctionedSeats: row.sanctionedSeats ?? 0,
      feeWaiverSeats: row.feeWaiverSeats ?? 0,
      isActive: row.isActive !== false,
    })),
    staffCapacities: (institution?.staffCapacities?.length ? institution.staffCapacities : buildDefaultStaffCapacityRows()).map((row) => ({
      branchId: row.branchId,
      academicYear: row.academicYear || getDefaultAcademicYear(),
      sanctionedPosts: row.sanctionedPosts ?? 0,
      filledPosts: row.filledPosts ?? 0,
      guestFaculty: row.guestFaculty ?? 0,
      isActive: row.isActive !== false,
    })),
  };
};
