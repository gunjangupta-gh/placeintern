// FilterBuilder Component - Dynamic Filter Configuration
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Form,
  Select,
  Input,
  InputNumber,
  DatePicker,
  Switch,
  Spin,
  Space,
  Tooltip,
  Typography,
  Row,
  Col,
  Button,
  Alert,
} from "antd";
import {
  InfoCircleOutlined,
  FilterOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { getFilterValues } from "../../services/reportBuilderApi";
import { formatLabel } from "../../utils/reportBuilderUtils";
import lookupService from "../../services/lookup.service";

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Text } = Typography;

// Filter IDs that should use lookup service institution data (lowercase for comparison)
const INSTITUTION_FILTER_IDS = ["institutionid", "institution", "instituteid", "institute"];

const FilterBuilder = ({
  filters = [],
  reportType,
  values = {},
  onChange,
  loading = false,
  disabled = false,
  compact = false,
}) => {
  const [dynamicOptions, setDynamicOptions] = useState({});
  const [loadingOptions, setLoadingOptions] = useState({});
  const [errorOptions, setErrorOptions] = useState({}); // Track filter load errors
  const [pendingRequests, setPendingRequests] = useState({}); // Prevent duplicate requests

  // Institution data from lookup service (includes all institutions for reports)
  const [institutions, setInstitutions] = useState([]);
  const [institutionsLoading, setInstitutionsLoading] = useState(false);
  const [institutionsError, setInstitutionsError] = useState(null);

  // Transform institutions to filter options format
  const institutionOptions = useMemo(() => {
    return institutions.map((inst) => ({
      value: inst.id,
      label: inst.name || inst.code || inst.id,
    }));
  }, [institutions]);

  // Check if any filter needs institution data
  const needsInstitutions = useMemo(() => {
    return filters.some((filter) =>
      INSTITUTION_FILTER_IDS.includes(filter.id.toLowerCase())
    );
  }, [filters]);

  // Fetch institutions from lookup service (includes inactive for reports)
  useEffect(() => {
    if (needsInstitutions && institutions.length === 0 && !institutionsLoading) {
      setInstitutionsLoading(true);
      setInstitutionsError(null);

      lookupService.getInstitutions(true) // includeInactive=true for reports
        .then((response) => {
          setInstitutions(response?.institutions || []);
        })
        .catch((error) => {
          console.error('Failed to fetch institutions for filters:', error);
          setInstitutionsError(error.message || 'Failed to load institutions');
        })
        .finally(() => {
          setInstitutionsLoading(false);
        });
    }
  }, [needsInstitutions, institutions.length, institutionsLoading]);

  // Handle retry for institution loading
  const handleRetryInstitutions = useCallback(() => {
    setInstitutions([]);
    setInstitutionsLoading(true);
    setInstitutionsError(null);

    lookupService.getInstitutions(true)
      .then((response) => {
        setInstitutions(response?.institutions || []);
      })
      .catch((error) => {
        console.error('Failed to fetch institutions for filters:', error);
        setInstitutionsError(error.message || 'Failed to load institutions');
      })
      .finally(() => {
        setInstitutionsLoading(false);
      });
  }, []);

  // Define dependent filters - when parent changes, reload child filters
  const FILTER_DEPENDENCIES = useMemo(() => ({
    branchId: 'institutionId',
    departmentId: 'institutionId',
    batchId: 'institutionId',
    mentorId: 'institutionId',
  }), []);

  // Track previous institutionId to detect changes
  const prevInstitutionIdRef = useRef(values?.institutionId);

  // Load dynamic filter options when filters change
  useEffect(() => {
    filters.forEach((filter) => {
      // Skip institution filters - they use lookup service
      if (INSTITUTION_FILTER_IDS.includes(filter.id.toLowerCase())) {
        return;
      }
      if (filter.dynamic && reportType) {
        loadDynamicOptions(filter.id);
      }
    });
  }, [filters, reportType]);

  // Reload dependent filters when parent filter value changes
  // AND clear the dependent filter values to prevent stale selections
  useEffect(() => {
    const institutionId = values?.institutionId;
    const prevInstitutionId = prevInstitutionIdRef.current;

    // Only process if institutionId actually changed
    if (institutionId !== prevInstitutionId) {
      prevInstitutionIdRef.current = institutionId;

      // Clear dependent filter values when institutionId changes
      const dependentFilterIds = Object.entries(FILTER_DEPENDENCIES)
        .filter(([_, parentId]) => parentId === 'institutionId')
        .map(([filterId]) => filterId);

      // Check if any dependent filters have values that should be cleared
      const hasStaleValues = dependentFilterIds.some((filterId) => values?.[filterId]);

      if (hasStaleValues && prevInstitutionId !== undefined) {
        // Clear dependent filter values (only if there was a previous selection)
        const clearedValues = { ...values };
        dependentFilterIds.forEach((filterId) => {
          delete clearedValues[filterId];
        });
        // Clear dynamic options for dependent filters
        setDynamicOptions((prev) => {
          const updated = { ...prev };
          dependentFilterIds.forEach((filterId) => {
            delete updated[filterId];
          });
          return updated;
        });
        onChange?.(clearedValues);
      }

      if (institutionId) {
        // Reload filters that depend on institutionId
        filters.forEach((filter) => {
          const dependency = FILTER_DEPENDENCIES[filter.id];
          if (dependency === 'institutionId' && filter.dynamic) {
            loadDynamicOptions(filter.id, institutionId);
          }
        });
      }
    }
  }, [values?.institutionId, filters, FILTER_DEPENDENCIES]);

  const loadDynamicOptions = async (filterId, institutionId = null) => {
    // Prevent duplicate requests for the same filter
    const requestKey = `${filterId}-${institutionId || 'all'}`;
    if (pendingRequests[requestKey]) {
      return;
    }

    setPendingRequests((prev) => ({ ...prev, [requestKey]: true }));
    setLoadingOptions((prev) => ({ ...prev, [filterId]: true }));
    setErrorOptions((prev) => ({ ...prev, [filterId]: null })); // Clear previous error

    try {
      const response = await getFilterValues(reportType, filterId, institutionId);
      // Response.data contains the options array directly
      const options = response?.data || [];
      setDynamicOptions((prev) => ({
        ...prev,
        [filterId]: options,
      }));
    } catch (error) {
      console.error(`Error loading options for ${filterId}:`, error);
      const errorMessage = error.message || 'Failed to load options';
      setErrorOptions((prev) => ({
        ...prev,
        [filterId]: errorMessage,
      }));
      setDynamicOptions((prev) => ({
        ...prev,
        [filterId]: [],
      }));
    } finally {
      setLoadingOptions((prev) => ({ ...prev, [filterId]: false }));
      setPendingRequests((prev) => {
        const { [requestKey]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  // Retry loading a specific filter
  const handleRetryFilter = useCallback((filterId) => {
    const institutionId = values?.institutionId;
    loadDynamicOptions(filterId, institutionId);
  }, [values?.institutionId, reportType]);

  const handleFilterChange = (filterId, value) => {
    // Serialize dateRange Dayjs arrays to ISO strings for proper API transmission
    let serializedValue = value;

    if (Array.isArray(value) && value.length === 2) {
      // Check if it's a date range (Dayjs objects or Date objects)
      const [start, end] = value;
      if (start && end && (start.$d instanceof Date || start instanceof Date || typeof start?.toISOString === 'function')) {
        serializedValue = [
          start.toISOString ? start.toISOString() : start,
          end.toISOString ? end.toISOString() : end,
        ];
      }
    }

    onChange?.({
      ...values,
      [filterId]: serializedValue,
    });
  };

  const getFilterOptions = (filter) => {
    // Use lookup service institutions for institution filters
    if (INSTITUTION_FILTER_IDS.includes(filter.id.toLowerCase())) {
      return institutionOptions;
    }
    if (filter.dynamic) {
      return dynamicOptions[filter.id] || [];
    }
    return filter.options || [];
  };

  const isFilterLoading = (filter) => {
    if (INSTITUTION_FILTER_IDS.includes(filter.id.toLowerCase())) {
      return institutionsLoading;
    }
    return loadingOptions[filter.id];
  };

  const renderFilterInput = (filter) => {
    const commonProps = {
      disabled,
      placeholder: filter.placeholder || `Select ${filter.label}`,
      className: "w-full",
      size: compact ? "middle" : "large",
    };

    // Get appropriate not found content based on filter type and state
    const getNotFoundContent = (filter) => {
      const isInstitutionFilter = INSTITUTION_FILTER_IDS.includes(filter.id.toLowerCase());

      if (isFilterLoading(filter)) {
        return <Spin size="small" />;
      }

      if (isInstitutionFilter && institutionsError) {
        return (
          <div className="py-2 text-center">
            <Text type="danger" className="text-xs">Failed to load</Text>
            <Button
              type="link"
              size="small"
              icon={<ReloadOutlined />}
              onClick={handleRetryInstitutions}
            >
              Retry
            </Button>
          </div>
        );
      }

      // Show error state for dynamic filters that failed to load
      if (filter.dynamic && errorOptions[filter.id]) {
        return (
          <div className="py-2 text-center">
            <Text type="danger" className="text-xs block mb-1">
              {errorOptions[filter.id]}
            </Text>
            <Button
              type="link"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => handleRetryFilter(filter.id)}
            >
              Retry
            </Button>
          </div>
        );
      }

      return "No options available";
    };

    switch (filter.type) {
      case "select":
        return (
          <Select
            {...commonProps}
            allowClear
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) =>
              (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
            }
            value={values[filter.id]}
            onChange={(val) => handleFilterChange(filter.id, val)}
            loading={isFilterLoading(filter)}
            notFoundContent={getNotFoundContent(filter)}
          >
            {getFilterOptions(filter).map((opt) => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Select>
        );

      case "multiSelect":
        return (
          <Select
            {...commonProps}
            mode="multiple"
            allowClear
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) =>
              (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
            }
            value={values[filter.id]}
            onChange={(val) => handleFilterChange(filter.id, val)}
            loading={isFilterLoading(filter)}
            maxTagCount="responsive"
            notFoundContent={getNotFoundContent(filter)}
          >
            {getFilterOptions(filter).map((opt) => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Select>
        );

      case "dateRange":
        // Convert ISO strings to dayjs objects if needed
        const dateRangeValue = values[filter.id];
        let parsedDateRange = null;
        if (Array.isArray(dateRangeValue) && dateRangeValue.length === 2) {
          const [start, end] = dateRangeValue;
          // Handle both dayjs objects and ISO strings
          const startDate = start && (dayjs.isDayjs(start) ? start : dayjs(start));
          const endDate = end && (dayjs.isDayjs(end) ? end : dayjs(end));
          // Only set if both dates are valid
          if (startDate?.isValid() && endDate?.isValid()) {
            parsedDateRange = [startDate, endDate];
          }
        }
        return (
          <RangePicker
            {...commonProps}
            value={parsedDateRange}
            onChange={(val) => handleFilterChange(filter.id, val)}
            format="YYYY-MM-DD"
          />
        );

      case "date":
        const dateValue = values[filter.id];
        const parsedDate = dateValue ? (dayjs.isDayjs(dateValue) ? dateValue : dayjs(dateValue)) : null;
        return (
          <DatePicker
            {...commonProps}
            value={parsedDate?.isValid() ? parsedDate : null}
            onChange={(val) => handleFilterChange(filter.id, val ? val.toISOString() : undefined)}
            format="YYYY-MM-DD"
          />
        );

      case "boolean":
        return (
          <Switch
            disabled={disabled}
            checked={values[filter.id]}
            onChange={(val) => handleFilterChange(filter.id, val)}
            checkedChildren="Yes"
            unCheckedChildren="No"
          />
        );

      case "number":
        return (
          <InputNumber
            {...commonProps}
            value={values[filter.id]}
            onChange={(val) => handleFilterChange(filter.id, val)}
            min={filter.min}
            max={filter.max}
            step={filter.step || 1}
          />
        );

      case "text":
      default:
        return (
          <Input
            {...commonProps}
            value={values[filter.id]}
            onChange={(e) => handleFilterChange(filter.id, e.target.value)}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center">
        <Spin tip="Loading filters..." />
      </div>
    );
  }

  if (!filters || filters.length === 0) {
    return (
      <div className="py-4 text-center text-gray-500">
        <FilterOutlined className="text-2xl mb-2" />
        <p>No filters available for this report type</p>
      </div>
    );
  }

  const colSpan = compact ? { xs: 24, sm: 12, md: 8 } : { xs: 24, sm: 12 };

  // Show institution loading error with retry option
  const showInstitutionError = needsInstitutions && institutionsError && !institutionsLoading;

  return (
    <div className="filter-builder">
      {/* Institution loading error alert */}
      {showInstitutionError && (
        <Alert
          title="Failed to load institutions"
          description={
            <Space>
              <span>{institutionsError}</span>
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={handleRetryInstitutions}
              >
                Retry
              </Button>
            </Space>
          }
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          className="mb-4"
        />
      )}

      <Row gutter={[16, compact ? 8 : 16]}>
        {filters.map((filter) => (
          <Col key={filter.id} {...colSpan}>
            <Form.Item
              label={
                <Space>
                  <span>{filter.label}</span>
                  {filter.description && (
                    <Tooltip title={filter.description}>
                      <InfoCircleOutlined className="text-gray-400 cursor-help" />
                    </Tooltip>
                  )}
                  {filter.required && (
                    <Text type="danger" className="text-xs">*</Text>
                  )}
                </Space>
              }
              className={compact ? "mb-2" : "mb-4"}
              validateStatus={
                filter.required && !values[filter.id] ? "warning" : ""
              }
            >
              {renderFilterInput(filter)}
            </Form.Item>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default FilterBuilder;