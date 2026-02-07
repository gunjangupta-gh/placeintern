import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, Empty, Spin, Button, Typography, Tag, theme, Row, Col, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  RocketOutlined,
  PlusOutlined,
  ReloadOutlined,
  LaptopOutlined,
  SyncOutlined
} from '@ant-design/icons';

import {
  ApplicationsTable,
  ApplicationDetailsView,
} from './components';
import { useMonthlyReports, useFacultyVisits } from './hooks/useApplications';
import { fetchApplications } from '../store/studentSlice';
import {
  selectApplicationsLoading,
  selectSelfIdentifiedApplications,
  selectApplicationsLastFetched,
} from '../store/studentSelectors';

const { Text, Title, Paragraph } = Typography;

const MyApplications = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { token } = theme.useToken();

  // Redux state
  const loading = useSelector(selectApplicationsLoading);
  const selfIdentifiedApplications = useSelector(selectSelfIdentifiedApplications);
  const lastFetched = useSelector(selectApplicationsLastFetched);

  // Memoize derived data
  const derivedData = useMemo(() => {
    const selfIdentifiedCount = selfIdentifiedApplications?.length || 0;
    const hasSelfIdentifiedApplications = selfIdentifiedCount > 0;

    // Check if student has any active (non-withdrawn) application
    const hasActiveApplication = selfIdentifiedApplications?.some(
      (app) => (app.status || '').toUpperCase() !== 'WITHDRAWN'
    ) || false;

    return {
      selfIdentifiedCount,
      hasSelfIdentifiedApplications,
      hasActiveApplication,
    };
  }, [selfIdentifiedApplications]);

  // Fetch applications on mount
  useEffect(() => {
    if (!lastFetched) {
      dispatch(fetchApplications({}));
    }
  }, [dispatch, lastFetched]);

  const refetch = useCallback(() => {
    dispatch(fetchApplications({ forceRefresh: true }));
  }, [dispatch]);

  // State
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [showDetailsView, setShowDetailsView] = useState(false);

  const {
    reports: monthlyReports,
    progress: monthlyReportsProgress,
    loading: monthlyReportsLoading,
    uploading: monthlyReportsUploading,
    fetchReports,
    uploadReport,
    deleteReport,
  } = useMonthlyReports();

  const {
    visits: facultyVisits,
    progress: facultyVisitsProgress,
    loading: facultyVisitsLoading,
    fetchVisits,
  } = useFacultyVisits();

  // Handlers
  const handleViewDetails = useCallback(async (application) => {
    setSelectedApplication(application);
    setShowDetailsView(true);

    await Promise.all([
      fetchReports(application.id),
      fetchVisits(application.id),
    ]);
  }, [fetchReports, fetchVisits]);

  const handleCloseDetailsView = useCallback(() => {
    setShowDetailsView(false);
    setSelectedApplication(null);
  }, []);

  const handleRefreshReports = useCallback(async () => {
    if (selectedApplication) {
      await fetchReports(selectedApplication.id);
    }
  }, [selectedApplication, fetchReports]);

  const handleRefreshApplication = useCallback(async () => {
    await dispatch(fetchApplications({ forceRefresh: true }));

    if (selectedApplication) {
      await Promise.all([
        fetchReports(selectedApplication.id),
        fetchVisits(selectedApplication.id),
      ]);
    }
  }, [dispatch, selectedApplication, fetchReports, fetchVisits]);

  // Render loading state
  if (loading && !lastFetched) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: token.colorBgLayout }}
      >
        <Spin size="large" />
      </div>
    );
  }

  // Render details view
  if (showDetailsView && selectedApplication) {
    return (
      <div 
        className="min-h-screen p-4 md:p-5"
        style={{ backgroundColor: token.colorBgLayout }}
      >
        <ApplicationDetailsView
          application={selectedApplication}
          onBack={handleCloseDetailsView}
          monthlyReports={monthlyReports}
          monthlyReportsProgress={monthlyReportsProgress}
          monthlyReportsLoading={monthlyReportsLoading}
          monthlyReportsUploading={monthlyReportsUploading}
          onUploadReport={uploadReport}
          onDeleteReport={deleteReport}
          onRefreshReports={handleRefreshReports}
          facultyVisits={facultyVisits}
          facultyVisitsProgress={facultyVisitsProgress}
          facultyVisitsLoading={facultyVisitsLoading}
          onRefresh={handleRefreshApplication}
        />
      </div>
    );
  }

  return (
    <div 
      className="p-4 md:p-5 min-h-screen"
      style={{ backgroundColor: token.colorBgLayout }}
    >
      {/* Header Section */}
      <Card 
        className="!mb-4 rounded-xl shadow-sm border"
        style={{ borderColor: token.colorBorderSecondary }}
        styles={{ body: { padding: '24px' } }}
      >
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Title level={3} className="!mb-1">
              My Applications
            </Title>
            <Paragraph type="secondary" className="!mb-0 text-sm">
              Manage your internship applications and track their status.
            </Paragraph>
          </Col>
          <Col>
            <Space size="middle">
              <div className="flex gap-2">
                <Button
                  type="text"
                  icon={<ReloadOutlined spin={loading} />}
                  onClick={refetch}
                  className="rounded-lg"
                />
                {!derivedData.hasActiveApplication && (
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => navigate('/app/self-identified-internship')}
                    className="rounded-lg"
                  >
                    Add Internship
                  </Button>
                )}
              </div>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Applications List */}
      <Card
        className="rounded-xl border shadow-sm"
        style={{ borderColor: token.colorBorderSecondary, backgroundColor: token.colorBgContainer }}
        styles={{ body: { padding: 0 } }}
      >
        {/* Card Header */}
        <div 
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: token.colorBorderSecondary }}
        >
          <div className="flex items-center gap-2">
            <RocketOutlined style={{ color: token.colorPrimary }} />
            <Text className="font-medium" style={{ color: token.colorText }}>Self-Identified Internships</Text>
            <Tag 
              color="blue" 
              className="rounded-full text-xs ml-1 border-0"
            >
              {derivedData.selfIdentifiedCount}
            </Tag>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {derivedData.hasSelfIdentifiedApplications ? (
            <ApplicationsTable
              applications={selfIdentifiedApplications}
              loading={loading}
              onViewDetails={handleViewDetails}
              isSelfIdentified
            />
          ) : (
            <Empty
              image={<RocketOutlined style={{ fontSize: '48px', color: token.colorTextQuaternary }} />}
              imageStyle={{ height: 60 }}
              description={
                <div className="text-center py-2">
                  <Text className="text-sm block mb-1" style={{ color: token.colorTextSecondary }}>No internships yet</Text>
                  <Text className="text-xs" style={{ color: token.colorTextTertiary }}>Add your self-identified internship to get started</Text>
                </div>
              }
            >
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate('/app/self-identified-internship')}
                className="rounded-lg"
              >
                Add Self-Identified Internship
              </Button>
            </Empty>
          )}
        </div>
      </Card>
    </div>
  );
};

export default MyApplications;
