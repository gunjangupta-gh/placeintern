import React, { useState, useMemo, useCallback } from 'react';
import { Input, Typography, Skeleton, Empty, Tooltip, Progress, Tag, Badge } from 'antd';
import {
  SearchOutlined,
  BankOutlined,
  CheckCircleFilled,
  FileTextOutlined,
  EyeOutlined,
  WarningFilled,
  CloseCircleFilled,
} from '@ant-design/icons';

const { Text } = Typography;

const ComplianceInstitutionList = ({
  institutions = [],
  selectedInstitutionId,
  onSelectInstitution,
  loading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Get compliance status
  const getComplianceStatus = useCallback((rate) => {
    if (rate === null || rate === undefined) return 'unknown';
    if (rate >= 90) return 'excellent';
    if (rate >= 50) return 'attention';
    return 'critical';
  }, []);

  // Status counts
  const statusCounts = useMemo(() => {
    return institutions.reduce((acc, inst) => {
      const status = getComplianceStatus(inst.overallCompliance);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, { excellent: 0, attention: 0, critical: 0, unknown: 0 });
  }, [institutions, getComplianceStatus]);

  // Filter institutions
  const filteredInstitutions = useMemo(() => {
    let result = institutions;

    // Search filter
    if (debouncedSearch) {
      const search = debouncedSearch.toLowerCase();
      result = result.filter(
        (inst) =>
          inst.shortName?.toLowerCase().includes(search) ||
          inst.institutionName?.toLowerCase().includes(search) ||
          inst.institutionCode?.toLowerCase().includes(search)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((inst) => getComplianceStatus(inst.overallCompliance) === statusFilter);
    }

    return result;
  }, [institutions, debouncedSearch, statusFilter, getComplianceStatus]);

  // Get compliance color
  const getComplianceColor = useCallback((rate) => {
    if (rate === null || rate === undefined) return 'default';
    if (rate >= 90) return 'success';
    if (rate >= 50) return 'warning';
    return 'error';
  }, []);

  // Get status icon
  const getStatusIcon = useCallback((rate) => {
    if (rate === null || rate === undefined) return null;
    if (rate >= 90) return <CheckCircleFilled className="text-success text-xs" />;
    if (rate >= 50) return <WarningFilled className="text-warning text-xs" />;
    return <CloseCircleFilled className="text-error text-xs" />;
  }, []);

  // Render skeleton loading
  const renderSkeleton = () => (
    <div className="space-y-2 p-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-background-tertiary/50">
          <Skeleton.Avatar active size={40} shape="square" className="!rounded-lg" />
          <div className="flex-1">
            <Skeleton.Input active size="small" className="!w-32 !h-4 mb-1" />
            <Skeleton.Input active size="small" className="!w-20 !h-3" />
          </div>
          <Skeleton.Input active size="small" className="!w-12 !h-6" />
        </div>
      ))}
    </div>
  );

  // Render institution item
  const renderItem = (institution) => {
    const isSelected = selectedInstitutionId === institution.institutionId;
    const complianceRate = institution.overallCompliance;
    const status = getComplianceStatus(complianceRate);

    return (
      <div
        key={institution.institutionId}
        onClick={() => onSelectInstitution?.(institution.institutionId)}
        className={`
          group cursor-pointer transition-all duration-200 rounded-xl mb-2 p-3
          ${isSelected
            ? 'bg-primary/10 ring-2 ring-primary shadow-sm'
            : 'hover:bg-background-tertiary hover:shadow-sm'
          }
        `}
      >
        <div className="flex items-center gap-3">
          {/* Institution icon with status indicator */}
          <div className="relative">
            <div
              className={`
                w-10 h-10 rounded-lg flex items-center justify-center transition-colors
                ${isSelected
                  ? 'bg-primary text-white'
                  : 'bg-background-tertiary text-text-tertiary group-hover:bg-primary/10 group-hover:text-primary'
                }
              `}
            >
              <BankOutlined className="text-base" />
            </div>
            {/* Status indicator dot */}
            <div
              className={`
                absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white
                ${status === 'excellent' ? 'bg-success' : status === 'attention' ? 'bg-warning' : status === 'critical' ? 'bg-error' : 'bg-gray-300'}
              `}
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <Text
              className={`block truncate text-sm font-medium ${isSelected ? 'text-primary' : 'text-text-primary'}`}
            >
              {institution.shortName || institution.institutionName || 'Unknown'}
            </Text>
            <div className="flex items-center gap-2 mt-1">
              <Text className="text-[10px] text-text-tertiary font-mono bg-background-tertiary px-1.5 py-0.5 rounded">
                {institution.institutionCode}
              </Text>
              <div className="flex items-center gap-1 text-[10px] text-text-tertiary">
                <FileTextOutlined className="text-[8px]" />
                <span>{institution.submittedReports}/{institution.expectedReports}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-text-tertiary">
                <EyeOutlined className="text-[8px]" />
                <span>{institution.completedVisits}/{institution.expectedVisits}</span>
              </div>
            </div>
          </div>

          {/* Compliance score */}
          <div className="text-right">
            <div
              className={`
                text-lg font-bold
                ${complianceRate >= 90 ? 'text-success' : complianceRate >= 50 ? 'text-warning' : 'text-error'}
              `}
            >
              {complianceRate !== null ? `${complianceRate}%` : '-'}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Empty state
  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 rounded-full bg-background-tertiary flex items-center justify-center mb-4">
        <BankOutlined className="text-2xl text-text-tertiary" />
      </div>
      <Text className="text-text-secondary font-medium mb-1">
        {debouncedSearch ? 'No Results Found' : 'No Institutions'}
      </Text>
      <Text className="text-text-tertiary text-sm text-center">
        {debouncedSearch
          ? `No institutions match "${debouncedSearch}"`
          : 'No institutions available for this period'}
      </Text>
      {debouncedSearch && (
        <button
          onClick={() => setSearchTerm('')}
          className="mt-3 text-primary text-sm hover:underline font-medium"
        >
          Clear search
        </button>
      )}
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header with search */}
      <div className="p-3 border-b border-border space-y-3">
        <Input
          placeholder="Search institutions..."
          prefix={<SearchOutlined className="text-text-tertiary" />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          allowClear
          className="rounded-lg"
        />

        {/* Quick filter chips */}
        <div className="flex flex-wrap gap-1.5">
          <Tag
            className={`cursor-pointer m-0 text-xs ${statusFilter === 'all' ? 'bg-primary text-white border-primary' : 'bg-transparent'}`}
            onClick={() => setStatusFilter('all')}
          >
            All ({institutions.length})
          </Tag>
          <Tag
            color={statusFilter === 'excellent' ? 'success' : undefined}
            className={`cursor-pointer m-0 text-xs ${statusFilter === 'excellent' ? '' : 'bg-transparent border-success text-success'}`}
            onClick={() => setStatusFilter(statusFilter === 'excellent' ? 'all' : 'excellent')}
          >
            <CheckCircleFilled className="text-[10px]" /> {statusCounts.excellent}
          </Tag>
          <Tag
            color={statusFilter === 'attention' ? 'warning' : undefined}
            className={`cursor-pointer m-0 text-xs ${statusFilter === 'attention' ? '' : 'bg-transparent border-warning text-warning'}`}
            onClick={() => setStatusFilter(statusFilter === 'attention' ? 'all' : 'attention')}
          >
            <WarningFilled className="text-[10px]" /> {statusCounts.attention}
          </Tag>
          <Tag
            color={statusFilter === 'critical' ? 'error' : undefined}
            className={`cursor-pointer m-0 text-xs ${statusFilter === 'critical' ? '' : 'bg-transparent border-error text-error'}`}
            onClick={() => setStatusFilter(statusFilter === 'critical' ? 'all' : 'critical')}
          >
            <CloseCircleFilled className="text-[10px]" /> {statusCounts.critical}
          </Tag>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between">
          <Text className="text-xs text-text-tertiary">
            {filteredInstitutions.length} of {institutions.length} institutions
          </Text>
          {selectedInstitutionId && (
            <Badge status="processing" text={<span className="text-xs text-primary">Selected</span>} />
          )}
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
    </div>
  );
};

export default ComplianceInstitutionList;
