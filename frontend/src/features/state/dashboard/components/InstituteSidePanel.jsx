import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Input, Avatar, Typography, Skeleton, Empty, Tooltip, Tag } from 'antd';
import {
  SearchOutlined,
  BankOutlined,
  EnvironmentOutlined,
  TeamOutlined,
  CheckCircleFilled,
} from '@ant-design/icons';
import {
  fetchInstitutions,
  selectInstitutions,
  selectInstitutionsLoading,
  setSelectedInstitute,
  selectSelectedInstitute,
  selectInstitutionsTotalStudents,
} from '../../store/stateSlice';

const { Text } = Typography;

const InstituteSidePanel = ({ onSelectInstitute }) => {
  const dispatch = useDispatch();
  const institutions = useSelector(selectInstitutions);
  const loading = useSelector(selectInstitutionsLoading);
  const selectedInstitute = useSelector(selectSelectedInstitute);
  const apiTotalStudents = useSelector(selectInstitutionsTotalStudents);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Fetch if needed
  useEffect(() => {
    if (institutions.length === 0 && !loading) {
      dispatch(fetchInstitutions({ limit: 100 }));
    }
  }, [dispatch, institutions.length, loading]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Filter institutions
  const filteredInstitutions = useMemo(() => {
    if (!debouncedSearch) return institutions;
    const search = debouncedSearch.toLowerCase();
    return institutions.filter(
      (inst) =>
        inst.name?.toLowerCase().includes(search) ||
        inst.code?.toLowerCase().includes(search) ||
        inst.city?.toLowerCase().includes(search)
    );
  }, [institutions, debouncedSearch]);

  const handleSelect = useCallback(
    (institution) => {
      dispatch(setSelectedInstitute(institution.id));
      onSelectInstitute?.(institution);
    },
    [dispatch, onSelectInstitute]
  );

  // Use API total (matches dashboard) or fall back to summing institution counts
  const totalStudents = useMemo(
    () => apiTotalStudents ?? institutions.reduce((sum, inst) => sum + (inst._count?.Student || 0), 0),
    [apiTotalStudents, institutions]
  );

  // Skeleton loading items
  const renderSkeleton = () => (
    <div className="space-y-2 p-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-background-tertiary/30">
          <Skeleton.Avatar active size={40} />
          <div className="flex-1">
            <Skeleton.Input active size="small" className="!w-32 !h-4 mb-1" />
            <Skeleton.Input active size="small" className="!w-20 !h-3" />
          </div>
        </div>
      ))}
    </div>
  );

  // Render list item
  const renderItem = (institution) => {
    const isSelected = selectedInstitute?.id === institution.id;
    const studentCount = institution._count?.Student || 0;

    return (
      <div
        key={institution.id}
        onClick={() => handleSelect(institution)}
        className={`
          group cursor-pointer transition-all duration-200 rounded-xl mb-2 p-3
          ${isSelected
            ? 'bg-primary/10 border-primary/30 shadow-sm shadow-primary/10'
            : 'bg-background hover:bg-background-tertiary border-transparent hover:border-border'
          }
          border relative
        `}
      >
        {/* Selection indicator */}
        {isSelected && (
          <div className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-full" />
        )}

        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div
            className={`
              w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all
              ${isSelected
                ? 'bg-primary text-white shadow-md shadow-primary/30'
                : 'bg-background-tertiary text-text-tertiary group-hover:bg-primary/10 group-hover:text-primary'
              }
            `}
          >
            <BankOutlined className="text-lg" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Text
                strong
                className={`block truncate text-sm ${isSelected ? 'text-primary' : 'text-text-primary'}`}
              >
                {institution.name}
              </Text>
              {isSelected && <CheckCircleFilled className="text-primary text-xs shrink-0" />}
            </div>

            <div className="flex items-center gap-3 mt-1">
              <Tooltip title="Institution Code">
                <Tag
                  className={`
                    text-[10px] px-1.5 py-0 m-0 rounded border-0 font-mono uppercase
                    ${isSelected ? 'bg-primary/20 text-primary' : 'bg-background-tertiary text-text-tertiary'}
                  `}
                >
                  {institution.code}
                </Tag>
              </Tooltip>

              {institution.city && (
                <Tooltip title="Location">
                  <span
                    className={`text-xs flex items-center gap-1 ${isSelected ? 'text-primary/80' : 'text-text-tertiary'}`}
                  >
                    <EnvironmentOutlined className="text-[10px]" />
                    <span className="truncate max-w-[80px]">{institution.city}</span>
                  </span>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Student count badge */}
          {studentCount > 0 && (
            <Tooltip title={`${studentCount} students enrolled`}>
              <div
                className={`
                  flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium shrink-0
                  ${isSelected
                    ? 'bg-primary/20 text-primary'
                    : 'bg-background-tertiary text-text-tertiary group-hover:bg-primary/10 group-hover:text-primary'
                  }
                `}
              >
                <TeamOutlined className="text-[10px]" />
                <span>{studentCount}</span>
              </div>
            </Tooltip>
          )}
        </div>
      </div>
    );
  };

  // Empty state
  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 rounded-2xl bg-background-tertiary flex items-center justify-center mb-4">
        <BankOutlined className="text-2xl text-text-tertiary" />
      </div>
      <Text className="text-text-primary font-medium mb-1">
        {debouncedSearch ? 'No matches found' : 'No institutions'}
      </Text>
      <Text className="text-text-tertiary text-sm text-center">
        {debouncedSearch
          ? `Try adjusting your search for "${debouncedSearch}"`
          : 'Institutions will appear here once added'}
      </Text>
      {debouncedSearch && (
        <button
          onClick={() => setSearchTerm('')}
          className="mt-3 text-primary text-sm hover:underline"
        >
          Clear search
        </button>
      )}
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-surface">
      {/* Header with search */}
      <div className="p-4 border-b border-border space-y-3">
        {/* Search input */}
        <Input
          placeholder="Search by name, code, or city..."
          prefix={<SearchOutlined className="text-text-tertiary" />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          allowClear
          className="rounded-xl h-10 bg-background border-border hover:border-primary focus:border-primary"
        />

        {/* Quick stats */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <Text className="text-xs text-text-tertiary">
              <span className="font-bold text-text-primary">{institutions.length}</span> institutions
            </Text>
          </div>
          <div className="w-px h-3 bg-border" />
          <Text className="text-xs text-text-tertiary">
            <span className="font-bold text-text-primary">{totalStudents.toLocaleString()}</span> total students
          </Text>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          renderSkeleton()
        ) : filteredInstitutions.length === 0 ? (
          renderEmpty()
        ) : (
          <div>{filteredInstitutions.map(renderItem)}</div>
        )}
      </div>

      {/* Footer with filter info */}
      {!loading && filteredInstitutions.length > 0 && (
        <div className="px-4 py-3 border-t border-border bg-background-tertiary/50">
          <div className="flex items-center justify-between">
            <Text className="text-xs text-text-tertiary">
              {debouncedSearch ? (
                <>
                  Showing <span className="font-medium text-text-secondary">{filteredInstitutions.length}</span> of{' '}
                  {institutions.length}
                </>
              ) : (
                <>
                  <span className="font-medium text-text-secondary">{filteredInstitutions.length}</span> institutions
                </>
              )}
            </Text>
            {selectedInstitute?.id && (
              <Tag color="blue" className="m-0 rounded-md text-[10px] border-0">
                1 selected
              </Tag>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InstituteSidePanel;
