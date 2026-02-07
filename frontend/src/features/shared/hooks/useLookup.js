import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchDepartments,
  fetchBranches,
  fetchBatches,
  fetchInstitutions,
  fetchRoles,
  fetchIndustries,
  fetchAllLookupData,
  selectDepartments,
  selectDepartmentsLoading,
  selectActiveDepartments,
  selectBranches,
  selectBranchesLoading,
  selectActiveBranches,
  selectBatches,
  selectBatchesLoading,
  selectActiveBatches,
  selectInstitutions,
  selectInstitutionsLoading,
  selectActiveInstitutions,
  selectRoles,
  selectRolesLoading,
  selectIndustries,
  selectIndustriesLoading,
  selectBranchById,
  selectDepartmentById,
  selectBatchById,
  selectInstitutionById,
  selectIsLookupLoaded,
  clearLookupCache,
} from '../store/lookupSlice';

/**
 * Custom hook for accessing and managing lookup data
 * Provides easy access to global master data (departments, branches, batches, etc.)
 *
 * @param {Object} options - Configuration options
 * @param {boolean} options.autoFetch - Whether to automatically fetch data on mount (default: true)
 * @param {string[]} options.include - Specific data types to fetch (default: all)
 * @returns {Object} Lookup data and utilities
 */
export const useLookup = (options = {}) => {
  const { autoFetch = true, include = [] } = options;
  const dispatch = useDispatch();

  // Selectors
  const departments = useSelector(selectDepartments);
  const departmentsLoading = useSelector(selectDepartmentsLoading);
  const activeDepartments = useSelector(selectActiveDepartments);

  const branches = useSelector(selectBranches);
  const branchesLoading = useSelector(selectBranchesLoading);
  const activeBranches = useSelector(selectActiveBranches);

  const batches = useSelector(selectBatches);
  const batchesLoading = useSelector(selectBatchesLoading);
  const activeBatches = useSelector(selectActiveBatches);

  const institutions = useSelector(selectInstitutions);
  const institutionsLoading = useSelector(selectInstitutionsLoading);
  const activeInstitutions = useSelector(selectActiveInstitutions);

  const roles = useSelector(selectRoles);
  const rolesLoading = useSelector(selectRolesLoading);

  const industries = useSelector(selectIndustries);
  const industriesLoading = useSelector(selectIndustriesLoading);

  const isLoaded = useSelector(selectIsLookupLoaded);

  // Fetch functions
  const loadDepartments = useCallback(() => dispatch(fetchDepartments()), [dispatch]);
  const loadBranches = useCallback(() => dispatch(fetchBranches()), [dispatch]);
  const loadBatches = useCallback(() => dispatch(fetchBatches()), [dispatch]);
  const loadInstitutions = useCallback((includeInactive = false) =>
    dispatch(fetchInstitutions(includeInactive)), [dispatch]);
  const loadRoles = useCallback(() => dispatch(fetchRoles()), [dispatch]);
  const loadIndustries = useCallback(() => dispatch(fetchIndustries()), [dispatch]);
  const loadAll = useCallback(() => dispatch(fetchAllLookupData()), [dispatch]);
  const clearCache = useCallback(() => dispatch(clearLookupCache()), [dispatch]);

  // Auto-fetch on mount based on options
  useEffect(() => {
    if (!autoFetch) return;

    if (include.length === 0) {
      // Fetch all if no specific types are specified
      loadAll();
    } else {
      // Fetch only specified types
      const fetchPromises = [];
      if (include.includes('departments')) fetchPromises.push(loadDepartments());
      if (include.includes('branches')) fetchPromises.push(loadBranches());
      if (include.includes('batches')) fetchPromises.push(loadBatches());
      if (include.includes('institutions')) fetchPromises.push(loadInstitutions());
      if (include.includes('roles')) fetchPromises.push(loadRoles());
      if (include.includes('industries')) fetchPromises.push(loadIndustries());
    }
  }, [autoFetch, include.join(','), loadAll, loadDepartments, loadBranches, loadBatches, loadInstitutions, loadRoles, loadIndustries]);

  // Get by ID functions using selectors with state
  const getBranchById = useCallback((id) => {
    return branches.find(b => b.id === id);
  }, [branches]);

  const getDepartmentById = useCallback((id) => {
    return departments.find(d => d.id === id);
  }, [departments]);

  const getBatchById = useCallback((id) => {
    return batches.find(b => b.id === id);
  }, [batches]);

  const getInstitutionById = useCallback((id) => {
    return institutions.find(i => i.id === id);
  }, [institutions]);

  // Options for dropdowns/selects
  const branchOptions = activeBranches.map(b => ({
    value: b.id,
    label: b.name,
    shortName: b.shortName,
    code: b.code,
  }));

  const departmentOptions = activeDepartments.map(d => ({
    value: d.id,
    label: d.name,
    shortName: d.shortName,
    code: d.code,
  }));

  const batchOptions = activeBatches.map(b => ({
    value: b.id,
    label: b.name,
  }));

  const institutionOptions = activeInstitutions.map(i => ({
    value: i.id,
    label: i.name,
    shortName: i.shortName,
    code: i.code,
  }));

  const roleOptions = roles.map(r => ({
    value: r.value,
    label: r.label,
  }));

  const industryOptions = industries.map(i => ({
    value: i.id,
    label: i.companyName,
    city: i.city,
  }));

  // Loading state
  const isLoading = departmentsLoading || branchesLoading || batchesLoading ||
                    institutionsLoading || rolesLoading || industriesLoading;

  return {
    // Raw data
    departments,
    branches,
    batches,
    institutions,
    roles,
    industries,

    // Active only
    activeDepartments,
    activeBranches,
    activeBatches,
    activeInstitutions,

    // Dropdown options
    branchOptions,
    departmentOptions,
    batchOptions,
    institutionOptions,
    roleOptions,
    industryOptions,

    // Loading states
    departmentsLoading,
    branchesLoading,
    batchesLoading,
    institutionsLoading,
    rolesLoading,
    industriesLoading,
    isLoading,
    isLoaded,

    // Fetch functions
    loadDepartments,
    loadBranches,
    loadBatches,
    loadInstitutions,
    loadRoles,
    loadIndustries,
    loadAll,
    clearCache,

    // Get by ID
    getBranchById,
    getDepartmentById,
    getBatchById,
    getInstitutionById,
  };
};

/**
 * Hook specifically for branch data
 */
export const useBranches = (autoFetch = true) => {
  const dispatch = useDispatch();
  const branches = useSelector(selectBranches);
  const loading = useSelector(selectBranchesLoading);
  const activeBranches = useSelector(selectActiveBranches);

  useEffect(() => {
    if (autoFetch) {
      dispatch(fetchBranches());
    }
  }, [autoFetch, dispatch]);

  const options = activeBranches.map(b => ({
    value: b.id,
    label: b.name,
    shortName: b.shortName,
  }));

  return { branches, activeBranches, loading, options };
};

/**
 * Hook specifically for department data
 */
export const useDepartments = (autoFetch = true) => {
  const dispatch = useDispatch();
  const departments = useSelector(selectDepartments);
  const loading = useSelector(selectDepartmentsLoading);
  const activeDepartments = useSelector(selectActiveDepartments);

  useEffect(() => {
    if (autoFetch) {
      dispatch(fetchDepartments());
    }
  }, [autoFetch, dispatch]);

  const options = activeDepartments.map(d => ({
    value: d.id,
    label: d.name,
    shortName: d.shortName,
  }));

  return { departments, activeDepartments, loading, options };
};

/**
 * Hook specifically for batch data
 */
export const useBatches = (autoFetch = true) => {
  const dispatch = useDispatch();
  const batches = useSelector(selectBatches);
  const loading = useSelector(selectBatchesLoading);
  const activeBatches = useSelector(selectActiveBatches);

  useEffect(() => {
    if (autoFetch) {
      dispatch(fetchBatches());
    }
  }, [autoFetch, dispatch]);

  const options = activeBatches.map(b => ({
    value: b.id,
    label: b.name,
  }));

  return { batches, activeBatches, loading, options };
};

/**
 * Hook specifically for institution data
 */
export const useInstitutions = (autoFetch = true) => {
  const dispatch = useDispatch();
  const institutions = useSelector(selectInstitutions);
  const loading = useSelector(selectInstitutionsLoading);
  const activeInstitutions = useSelector(selectActiveInstitutions);

  useEffect(() => {
    if (autoFetch) {
      dispatch(fetchInstitutions());
    }
  }, [autoFetch, dispatch]);

  const options = activeInstitutions.map(i => ({
    value: i.id,
    label: i.name,
    shortName: i.shortName,
  }));

  return { institutions, activeInstitutions, loading, options };
};

export default useLookup;
