import { useState, useEffect, useCallback, useMemo } from 'react';
import API from '../../../../services/api';
import { toast } from 'react-hot-toast';
import { useDebounce } from '../../../../hooks/useDebounce';

const INITIAL_FILTERS = {
  fieldOfWork: '',
  workLocation: '',
  duration: '',
  isStipendProvided: '',
};

export const useBrowseInternships = (pageSize = 9) => {
  const [loading, setLoading] = useState(true);
  const [internships, setInternships] = useState([]);
  const [appliedInternships, setAppliedInternships] = useState(new Set());
  const [searchText, setSearchText] = useState('');
  const [showApplied, setShowApplied] = useState(false);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState(null);

  const debouncedSearchText = useDebounce(searchText, 300);

  // Fetch data once on mount - filtering happens client-side
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [internshipsResponse, applicationsResponse] = await Promise.all([
        API.get('/internships/eligible'),
        API.get('/student/applications')
      ]);

      if (internshipsResponse) {
        setInternships(internshipsResponse.data || []);
      }

      if (applicationsResponse.data && applicationsResponse.data.success) {
        const appliedIds = new Set(
          (applicationsResponse.data.data || []).map(app => app.internshipId)
        );
        setAppliedInternships(appliedIds);
      }
    } catch (err) {
      const message = err.message || 'Failed to load internships';
      setError(message);
      toast.error(message);
      setInternships([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredInternships = useMemo(() => {
    let filtered = internships;

    // Filter out applied internships unless showApplied is true
    if (!showApplied) {
      filtered = filtered.filter(item => !appliedInternships.has(item.id));
    }

    // Search filter
    if (debouncedSearchText) {
      const searchLower = debouncedSearchText.toLowerCase();
      filtered = filtered.filter(item =>
        item.title?.toLowerCase().includes(searchLower) ||
        item.industry?.companyName?.toLowerCase().includes(searchLower) ||
        item.fieldOfWork?.toLowerCase().includes(searchLower)
      );
    }

    // Field of work filter
    if (filters.fieldOfWork) {
      filtered = filtered.filter(item =>
        item.fieldOfWork?.toLowerCase().includes(filters.fieldOfWork.toLowerCase())
      );
    }

    // Work location filter
    if (filters.workLocation) {
      filtered = filtered.filter(item => item.workLocation === filters.workLocation);
    }

    // Duration filter
    if (filters.duration) {
      filtered = filtered.filter(item => item.duration === filters.duration);
    }

    // Stipend filter
    if (filters.isStipendProvided !== '') {
      filtered = filtered.filter(item =>
        item.isStipendProvided === (filters.isStipendProvided === 'true')
      );
    }

    return filtered;
  }, [internships, appliedInternships, debouncedSearchText, filters, showApplied]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchText, filters, showApplied]);

  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    setSearchText('');
  }, []);

  const isApplied = useCallback((internshipId) => {
    return appliedInternships.has(internshipId);
  }, [appliedInternships]);

  const appliedCount = useMemo(() => {
    return internships.filter(item => appliedInternships.has(item.id)).length;
  }, [internships, appliedInternships]);

  // Pagination
  const startIndex = (currentPage - 1) * pageSize;
  const currentInternships = filteredInternships.slice(startIndex, startIndex + pageSize);
  const totalPages = Math.ceil(filteredInternships.length / pageSize);

  return {
    loading,
    error,
    internships: currentInternships,
    totalInternships: filteredInternships.length,
    searchText,
    setSearchText,
    showApplied,
    setShowApplied,
    filters,
    handleFilterChange,
    clearFilters,
    currentPage,
    setCurrentPage,
    pageSize,
    totalPages,
    isApplied,
    appliedCount,
    refetch: fetchData,
  };
};

export default useBrowseInternships;
