import React, { useState, useCallback, memo } from 'react';
import { Row, Col, Spin, Alert, Modal, FloatButton, theme } from 'antd';
import { toast } from 'react-hot-toast';
import { SyncOutlined, CameraOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';

import { useFacultyDashboard } from '../hooks/useFacultyDashboard';
import {
  DashboardHeader,
  StatisticsGrid,
  AssignedStudentsList,
  VisitLogsCard,
  MonthlyReportsCard,
  StudentDetailsModal,
  JoiningLettersCard,
} from './components';
import QuickVisitModal from '../visits/QuickVisitModal';
import UnifiedVisitLogModal from '../visits/UnifiedVisitLogModal';

dayjs.extend(isBetween);

const FacultyDashboard = () => {
  const navigate = useNavigate();
  const { token } = theme.useToken();

  // Use custom hook for dashboard data with SWR
  const {
    isLoading,
    isRevalidating, // NEW: SWR revalidation state
    lastFetched, // Timestamp of most recent data fetch
    dashboard,
    monthlyStats, // Backend-calculated stats using 10-day rule
    students,
    visitLogs,
    joiningLetters,
    monthlyReports,
    mentor,
    stats,
    upcomingVisits,
    error,
    refresh,
    handleDeleteVisitLog,
    handleSubmitFeedback,
  } = useFacultyDashboard();

  // Local UI state
  const [visitModalVisible, setVisitModalVisible] = useState(false);
  const [quickVisitModalVisible, setQuickVisitModalVisible] = useState(false);
  const [studentDetailsModalVisible, setStudentDetailsModalVisible] = useState(false);
  const [selectedStudentForDetails, setSelectedStudentForDetails] = useState(null);

  // Handle creating a new visit log - opens UnifiedVisitLogModal
  const handleNewVisit = useCallback(() => {
    setVisitModalVisible(true);
  }, []);

  // Handle visit modal success
  const handleVisitSuccess = useCallback(() => {
    setVisitModalVisible(false);
    refresh();
  }, [refresh]);

  // Handle deleting a visit log
  const handleDeleteVisit = useCallback(async (visitId) => {
    Modal.confirm({
      title: 'Delete Visit Log',
      content: 'Are you sure you want to delete this visit log?',
      okText: 'Yes, Delete',
      cancelText: 'Cancel',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await handleDeleteVisitLog(visitId);
          toast.success('Visit log deleted successfully');
        } catch (err) {
          toast.error('Failed to delete visit log');
        }
      },
    });
  }, [handleDeleteVisitLog]);

  // Open student details modal
  const handleViewStudent = useCallback((studentId) => {
    // Find the student from the list
    const student = students.find(s =>
      s.id === studentId ||
      s.studentId === studentId ||
      s.student?.id === studentId
    );
    if (student) {
      setSelectedStudentForDetails(student);
      setStudentDetailsModalVisible(true);
    }
  }, [students]);

  // Handle quick visit submission - just refresh data (modal handles actual submission)
  const handleQuickVisitSubmit = useCallback(async () => {
    // Modal handles submission via Redux thunk, we just need to refresh
    await refresh();
    return true;
  }, [refresh]);

  // Show error state
  if (error) {
    return (
      <div className="p-8 flex justify-center items-center min-h-[50vh]">
        <Alert
          type="error"
          message={<span className="font-bold text-lg">Dashboard Error</span>}
          description={error}
          showIcon
          className="rounded-2xl shadow-sm max-w-lg w-full"
          style={{ 
            backgroundColor: token.colorErrorBg, 
            borderColor: token.colorErrorBorder,
            color: token.colorErrorText
          }}
          action={
            <button 
              onClick={refresh} 
              className="font-semibold hover:underline px-4 py-2"
              style={{ color: token.colorError }}
            >
              Try Again
            </button>
          }
        />
      </div>
    );
  }

  return (
    <>
      <Spin spinning={isLoading} tip="Loading dashboard..." size="large">
        <div 
          className="p-4 min-h-screen"
          style={{ backgroundColor: token.colorBgLayout }}
        >
          {/* Subtle Revalidation Indicator */}
          {isRevalidating && !isLoading && (
            <div 
              className="fixed top-0 left-0 right-0 z-50 backdrop-blur-sm px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium animate-slide-down shadow-sm"
              style={{ 
                backgroundColor: token.colorInfoBg, // fallback or use colorInfoBg with opacity
                borderBottom: `1px solid ${token.colorInfoBorder}`,
                color: token.colorInfoText
              }}
            >
              <SyncOutlined spin />
              <span>Updating dashboard data...</span>
            </div>
          )}

          <div className="max-w-[1600px] mx-auto !space-y-8 !pb-20">
            {/* Header Section */}
            <DashboardHeader
              facultyName={mentor?.name}
              stats={stats}
              onRefresh={refresh}
              loading={isLoading}
              isRevalidating={isRevalidating}
              lastFetched={lastFetched}
            />

            {/* Statistics Grid */}
            <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <StatisticsGrid
                stats={stats}
                monthlyStats={monthlyStats}
                students={students}
                monthlyReports={monthlyReports}
                visitLogs={visitLogs}
                joiningLetters={joiningLetters}
                onRefresh={refresh}
              />
            </div>

            {/* Main Content Grid */}
            <div className="!space-y-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              {/* Assigned Students List - Full Width */}
              <AssignedStudentsList
                students={students}
                loading={isLoading}
                onViewStudent={handleViewStudent}
                onScheduleVisit={refresh}
                onViewAll={() => navigate('/app/assigned-students')}
              />

              {/* Secondary Content Grid */}
              {/* <Row gutter={[24, 24]}> */}
                {/* Visit Logs */}
                {/* <Col xs={24} xl={12}>
                  <VisitLogsCard
                    visitLogs={visitLogs}
                    loading={isLoading}
                    onCreateNew={() => handleNewVisit()}
                    onViewAll={() => navigate('/app/visit-logs')}
                  />
                </Col> */}

                {/* Monthly Reports */}
                {/* <Col xs={24} xl={12}>
                  <MonthlyReportsCard
                    reports={monthlyReports}
                    loading={isLoading}
                    onRefresh={refresh}
                    onViewAll={() => navigate('/app/monthly-reports')}
                  />
                </Col> */}
              {/* </Row> */}

              {/* Joining Letters - Full Width */}
              {/* <Row gutter={[24, 24]}>
                <Col xs={24}>
                  <JoiningLettersCard
                    letters={dashboard?.joiningLetters || []}
                    loading={isLoading}
                    onRefresh={refresh}
                    onViewAll={() => navigate('/app/joining-letters')}
                  />
                </Col>
              </Row> */}
            </div>
          </div>
        </div>
      </Spin>

      {/* Unified Visit Log Modal */}
      <UnifiedVisitLogModal
        visible={visitModalVisible}
        onClose={() => setVisitModalVisible(false)}
        onSuccess={handleVisitSuccess}
        students={students}
      />

      {/* Quick Visit Modal */}
      <QuickVisitModal
        visible={quickVisitModalVisible}
        onClose={() => setQuickVisitModalVisible(false)}
        onSubmit={handleQuickVisitSubmit}
        students={students}
        loading={isLoading}
      />

      {/* Floating Quick Log Button */}
      <FloatButton
        icon={<CameraOutlined />}
        type="primary"
        tooltip="Quick Log Visit"
        onClick={() => setQuickVisitModalVisible(true)}
        style={{
          right: 32,
          bottom: 32,
          width: 64,
          height: 64,
        }}
        badge={{ count: 'Quick', color: token.colorSuccess, offset: [-5, 5] }}
      />

      {/* Student Details Modal */}
      <StudentDetailsModal
        visible={studentDetailsModalVisible}
        student={selectedStudentForDetails}
        onClose={() => {
          setStudentDetailsModalVisible(false);
          setSelectedStudentForDetails(null);
        }}
        onScheduleVisit={refresh}
        onRefresh={refresh}
        loading={isLoading}
      />
    </>
  );
};

export default memo(FacultyDashboard);