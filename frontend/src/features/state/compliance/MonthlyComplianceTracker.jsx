import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Typography, Spin, DatePicker, Button, Tag, Tooltip, Space, Progress } from 'antd';
import {
  ReloadOutlined,
  CalendarOutlined,
  FileTextOutlined,
  TeamOutlined,
  WarningOutlined,
  EyeOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  BarChartOutlined,
} from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import dayjs from 'dayjs';

import ComplianceInstitutionList from './ComplianceInstitutionList';
import ComplianceDetailView from './ComplianceDetailView';
import {
  fetchMonthlyCompliance,
  fetchAvailableComplianceMonths,
  fetchInstitutionComplianceDetails,
  setSelectedComplianceInstitution,
  selectMonthlyComplianceInstitutions,
  selectMonthlyComplianceStateWideSummary,
  selectMonthlyComplianceSelectedInstitutionId,
  selectMonthlyComplianceLoading,
  selectMonthlyComplianceMonth,
  selectMonthlyComplianceYear,
  selectMonthlyComplianceAvailableMonths,
  selectMonthlyComplianceError,
} from '../store/stateSlice';

const { Text, Title } = Typography;

const MonthlyComplianceTracker = () => {
  const dispatch = useDispatch();

  // Selectors
  const institutions = useSelector(selectMonthlyComplianceInstitutions);
  const stateWideSummary = useSelector(selectMonthlyComplianceStateWideSummary);
  const selectedInstitutionId = useSelector(selectMonthlyComplianceSelectedInstitutionId);
  const loading = useSelector(selectMonthlyComplianceLoading);
  const currentMonth = useSelector(selectMonthlyComplianceMonth);
  const currentYear = useSelector(selectMonthlyComplianceYear);
  const error = useSelector(selectMonthlyComplianceError);

  // Local state for month picker
  const [selectedDate, setSelectedDate] = useState(() => dayjs());

  // Load available months on mount
  useEffect(() => {
    dispatch(fetchAvailableComplianceMonths());
  }, [dispatch]);

  // Fetch compliance data when month changes
  useEffect(() => {
    if (selectedDate) {
      const month = selectedDate.month() + 1;
      const year = selectedDate.year();
      dispatch(fetchMonthlyCompliance({ month, year }));
    }
  }, [dispatch, selectedDate]);

  // Auto-select first institution if none selected
  useEffect(() => {
    if (institutions.length > 0 && !selectedInstitutionId && currentMonth && currentYear) {
      const firstInstitution = institutions[0];
      dispatch(setSelectedComplianceInstitution(firstInstitution.institutionId));
      dispatch(fetchInstitutionComplianceDetails({
        institutionId: firstInstitution.institutionId,
        month: currentMonth,
        year: currentYear,
      }));
    }
  }, [dispatch, institutions, selectedInstitutionId, currentMonth, currentYear]);

  // Handle month change
  const handleMonthChange = useCallback((date) => {
    setSelectedDate(date);
    dispatch(setSelectedComplianceInstitution(null));
    if (date) {
      toast(`Loading compliance data for ${date.format('MMMM YYYY')}`);
    }
  }, [dispatch]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    if (selectedDate) {
      const month = selectedDate.month() + 1;
      const year = selectedDate.year();
      dispatch(fetchMonthlyCompliance({ month, year, forceRefresh: true }));
      dispatch(fetchAvailableComplianceMonths({ forceRefresh: true }));
      toast.success('Data refreshed');
    }
  }, [dispatch, selectedDate]);

  // Handle institution selection
  const handleSelectInstitution = useCallback((institutionId) => {
    dispatch(setSelectedComplianceInstitution(institutionId));
    if (currentMonth && currentYear) {
      dispatch(fetchInstitutionComplianceDetails({
        institutionId,
        month: currentMonth,
        year: currentYear,
      }));
    }
  }, [dispatch, currentMonth, currentYear]);

  // Get compliance rate color
  const getComplianceColor = useCallback((rate) => {
    if (rate === null || rate === undefined) return '#d9d9d9';
    if (rate >= 90) return '#52c41a';
    if (rate >= 50) return '#faad14';
    return '#ff4d4f';
  }, []);

  const getTagColor = useCallback((rate) => {
    if (rate === null || rate === undefined) return 'default';
    if (rate >= 90) return 'success';
    if (rate >= 50) return 'warning';
    return 'error';
  }, []);

  if (loading && !institutions.length) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-background-secondary gap-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <BarChartOutlined className="text-3xl text-primary animate-pulse" />
        </div>
        <Spin size="large" />
        <Text className="text-text-secondary">Loading compliance data...</Text>
      </div>
    );
  }

  return (
    <div className="compliance-tracker h-screen flex flex-col bg-background-secondary overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-border shrink-0">
        {/* Title Row */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-sm">
                <BarChartOutlined className="text-white text-lg" />
              </div>
              <div>
                <Title level={5} className="!m-0 !text-text-primary">
                  Compliance Tracker
                </Title>
                <Text className="text-xs text-text-tertiary">
                  Monitor institution compliance status
                </Text>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <DatePicker
              picker="month"
              value={selectedDate}
              onChange={handleMonthChange}
              allowClear={false}
              suffixIcon={<CalendarOutlined />}
              className="w-40"
              format="MMMM YYYY"
              disabledDate={(current) => current && current > dayjs().endOf('month')}
            />
            {error && (
              <Tag icon={<WarningOutlined />} color="error" className="m-0">
                Error
              </Tag>
            )}
            <Tooltip title="Refresh data">
              <Button
                icon={<ReloadOutlined spin={loading} />}
                onClick={handleRefresh}
                disabled={loading}
                type="text"
              />
            </Tooltip>
          </div>
        </div>

        {/* Stats Row */}
        {stateWideSummary && (
          <div className="px-4 py-2 bg-gradient-to-r from-primary/5 via-transparent to-transparent border-t border-border/50">
            <div className="flex items-center justify-between">
              {/* Left stats */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <TeamOutlined className="text-primary" />
                  </div>
                  <div>
                    <Text className="text-[10px] text-text-tertiary block leading-tight">Students</Text>
                    <Text className="text-sm font-bold text-text-primary">
                      {stateWideSummary.totalStudentsInTraining || 0}
                    </Text>
                  </div>
                </div>

                <div className="h-8 w-px bg-border" />

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <FileTextOutlined className="text-blue-500" />
                  </div>
                  <div>
                    <Text className="text-[10px] text-text-tertiary block leading-tight">Monthly Reports</Text>
                    <div className="flex items-center gap-2">
                      <Text className="text-sm font-bold text-text-primary">
                        {stateWideSummary.totalSubmittedReports || 0}
                        <span className="font-normal text-text-tertiary">/{stateWideSummary.totalExpectedReports || 0}</span>
                      </Text>
                      <Progress
                        percent={stateWideSummary.reportComplianceRate || 0}
                        size="small"
                        strokeColor={getComplianceColor(stateWideSummary.reportComplianceRate)}
                        showInfo={false}
                        className="w-16 !m-0"
                      />
                      <Text className="text-xs font-semibold" style={{ color: getComplianceColor(stateWideSummary.reportComplianceRate) }}>
                        {stateWideSummary.reportComplianceRate ?? 0}%
                      </Text>
                    </div>
                  </div>
                </div>

                <div className="h-8 w-px bg-border" />

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                    <EyeOutlined className="text-green-500" />
                  </div>
                  <div>
                    <Text className="text-[10px] text-text-tertiary block leading-tight">Faculty Visits</Text>
                    <div className="flex items-center gap-2">
                      <Text className="text-sm font-bold text-text-primary">
                        {stateWideSummary.totalCompletedVisits || 0}
                        <span className="font-normal text-text-tertiary">/{stateWideSummary.totalExpectedVisits || 0}</span>
                      </Text>
                      <Progress
                        percent={stateWideSummary.visitComplianceRate || 0}
                        size="small"
                        strokeColor={getComplianceColor(stateWideSummary.visitComplianceRate)}
                        showInfo={false}
                        className="w-16 !m-0"
                      />
                      <Text className="text-xs font-semibold" style={{ color: getComplianceColor(stateWideSummary.visitComplianceRate) }}>
                        {stateWideSummary.visitComplianceRate ?? 0}%
                      </Text>
                    </div>
                  </div>
                </div>
              </div>

              {/* Overall compliance badge */}
              <div className="flex items-center gap-2 bg-white rounded-lg px-4 py-2 shadow-sm border border-border">
                <div>
                  <Text className="text-[10px] text-text-tertiary block">Overall</Text>
                  <Text className="text-xl font-bold" style={{ color: getComplianceColor(stateWideSummary.overallComplianceRate) }}>
                    {stateWideSummary.overallComplianceRate ?? 0}%
                  </Text>
                </div>
                <Progress
                  type="circle"
                  percent={stateWideSummary.overallComplianceRate || 0}
                  size={40}
                  strokeColor={getComplianceColor(stateWideSummary.overallComplianceRate)}
                  format={() => (
                    stateWideSummary.overallComplianceRate >= 90
                      ? <CheckCircleFilled className="text-success" />
                      : stateWideSummary.overallComplianceRate < 50
                        ? <CloseCircleFilled className="text-error" />
                        : <WarningOutlined className="text-warning" />
                  )}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content - Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Institution List */}
        <div className="w-80 shrink-0 border-r border-border overflow-hidden flex flex-col shadow-sm">
          <ComplianceInstitutionList
            institutions={institutions}
            selectedInstitutionId={selectedInstitutionId}
            onSelectInstitution={handleSelectInstitution}
            loading={loading}
          />
        </div>

        {/* Right Panel - Detail View */}
        <div className="flex-1 overflow-hidden bg-background-tertiary">
          <ComplianceDetailView
            institutionId={selectedInstitutionId}
            month={currentMonth}
            year={currentYear}
          />
        </div>
      </div>
    </div>
  );
};

export default MonthlyComplianceTracker;
