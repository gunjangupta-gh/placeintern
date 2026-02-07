import React, { useState } from 'react';
import { Card, Row, Col, Modal, Table, Spin, Typography } from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  TeamOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import stateService from '../../../../services/state.service';

const { Text } = Typography;

// College-wise breakdown modal
const CollegeBreakdownModal = ({ visible, onClose, title, loading, data, columns }) => (
  <Modal
    title={<span className="font-semibold text-base">{title}</span>}
    open={visible}
    onCancel={onClose}
    footer={null}
    width={700}
    className="[&_.ant-modal-content]:rounded-2xl"
  >
    {loading ? (
      <div className="flex justify-center py-12"><Spin /></div>
    ) : (
      <Table
        dataSource={data}
        columns={columns}
        rowKey={(record) => record.id || record.institutionId || record.name}
        size="small"
        pagination={{ pageSize: 10, showSizeChanger: false, size: 'small' }}
        className="mt-4 [&_.ant-table-thead_th]:bg-gray-50 [&_.ant-table-thead_th]:text-[10px] [&_.ant-table-thead_th]:font-bold [&_.ant-table-thead_th]:uppercase [&_.ant-table-thead_th]:text-text-tertiary"
      />
    )}
  </Modal>
);

// Minimal stat card component
const StatCard = ({ icon, iconBg, title, value, subtitle, onView }) => (
  <Card
    className="rounded-xl border border-gray-100 shadow-sm bg-white h-full"
    styles={{ body: { padding: '16px 20px' } }}
  >
    <div className="flex items-start justify-between">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        <div>
          <Text className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block">
            {title}
          </Text>
          <Text className="text-2xl font-bold text-gray-900 block leading-tight">
            {value}
          </Text>
          {subtitle && (
            <Text className="text-xs text-gray-500 block mt-0.5">
              {subtitle}
            </Text>
          )}
        </div>
      </div>
      {onView && (
        <button
          onClick={onView}
          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
        >
          <EyeOutlined className="text-gray-400 text-sm" />
        </button>
      )}
    </div>
  </Card>
);

const StatisticsCards = ({ stats, selectedMonth }) => {
  const [modalType, setModalType] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [collegeData, setCollegeData] = useState([]);

  const filterMonth = selectedMonth ? selectedMonth.month() + 1 : null;
  const filterYear = selectedMonth ? selectedMonth.year() : null;

  // Extract stats
  const students = stats?.students || {};
  const faculty = stats?.faculty || {};
  const internships = stats?.internships || {};
  const facultyVisits = stats?.facultyVisits || {};
  const monthlyReports = stats?.monthlyReports || {};

  // Values
  const totalStudents = students?.active ?? 0;
  const activeInternships = internships?.active ?? students?.active ?? 0;
  const totalMentors = faculty?.total ?? stats?.totalFaculty ?? 0;

  // Reports
  const reportsSubmitted = monthlyReports?.thisMonth ?? 0;
  const reportsExpected = monthlyReports?.expectedThisMonth ?? totalStudents;
  const reportsPercent = reportsExpected > 0 ? Math.round((reportsSubmitted / reportsExpected) * 100) : 0;

  // Visits
  const visitsCompleted = facultyVisits?.thisMonth ?? 0;
  const visitsExpected = facultyVisits?.expectedThisMonth ?? totalStudents;
  const visitsPercent = visitsExpected > 0 ? Math.round((visitsCompleted / visitsExpected) * 100) : 0;

  const displayMonth = selectedMonth
    ? selectedMonth.format('MMM YYYY')
    : new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  // Fetch college-wise breakdown
  const fetchCollegeBreakdown = async (type) => {
    setModalType(type);
    setModalLoading(true);
    try {
      const response = await stateService.getCollegeWiseBreakdown(type, { month: filterMonth, year: filterYear });
      setCollegeData(response?.data || response || []);
    } catch (error) {
      console.error('Error fetching college breakdown:', error);
      setCollegeData([]);
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setModalType(null);
    setCollegeData([]);
  };

  const getColumns = (type) => {
    const baseColumns = [{
      title: 'Institution',
      dataIndex: 'institutionName',
      key: 'institutionName',
      render: (text, record) => <Text className="text-sm font-medium">{text || record.name || 'Unknown'}</Text>,
    }];
    switch (type) {
      case 'students':
        return [...baseColumns,
          { title: 'Total', dataIndex: 'totalStudents', align: 'center', render: (val) => <Text className="font-semibold">{val?.toLocaleString() || 0}</Text> },
          { title: 'Active', dataIndex: 'activeStudents', align: 'center', render: (val) => <Text className="font-semibold text-green-600">{val?.toLocaleString() || 0}</Text> },
        ];
      case 'mentors':
        return [...baseColumns,
          { title: 'Mentors', dataIndex: 'totalMentors', align: 'center', render: (val) => <Text className="font-semibold">{val?.toLocaleString() || 0}</Text> },
          { title: 'Students Assigned', dataIndex: 'assignedStudents', align: 'center', render: (val) => <Text className="font-semibold text-blue-600">{val?.toLocaleString() || 0}</Text> },
        ];
      case 'reports':
        return [...baseColumns,
          { title: 'Submitted', dataIndex: 'submitted', align: 'center', render: (val) => <Text className="font-semibold text-green-600">{val?.toLocaleString() || 0}</Text> },
          { title: 'Expected', dataIndex: 'expected', align: 'center', render: (val) => <Text className="font-semibold">{val?.toLocaleString() || 0}</Text> },
        ];
      case 'visits':
        return [...baseColumns,
          { title: 'Completed', dataIndex: 'completed', align: 'center', render: (val) => <Text className="font-semibold text-green-600">{val?.toLocaleString() || 0}</Text> },
          { title: 'Expected', dataIndex: 'expected', align: 'center', render: (val) => <Text className="font-semibold">{val?.toLocaleString() || 0}</Text> },
        ];
      default:
        return baseColumns;
    }
  };

  const getModalTitle = (type) => {
    switch (type) {
      case 'students': return 'College-wise Students';
      case 'mentors': return 'College-wise Mentors';
      case 'reports': return 'College-wise Monthly Reports';
      case 'visits': return 'College-wise Faculty Visits';
      default: return 'College Breakdown';
    }
  };

  return (
    <>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<UserOutlined className="text-lg text-blue-500" />}
            iconBg="bg-blue-50"
            title="TOTAL STUDENTS"
            value={totalStudents.toLocaleString()}
            subtitle={`Active Internships: ${activeInternships.toLocaleString()}`}
            onView={() => fetchCollegeBreakdown('students')}
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<FileTextOutlined className="text-lg text-green-500" />}
            iconBg="bg-green-50"
            title="MONTHLY REPORTS"
            value={
              <span>
                <span className={reportsPercent > 0 ? 'text-green-600' : 'text-gray-900'}>{reportsPercent}%</span>
                <span className="text-sm font-normal text-gray-400 ml-1">({reportsSubmitted}/{reportsExpected})</span>
              </span>
            }
            subtitle={displayMonth}
            onView={() => fetchCollegeBreakdown('reports')}
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<TeamOutlined className="text-lg text-amber-500" />}
            iconBg="bg-amber-50"
            title="TOTAL MENTORS"
            value={totalMentors.toLocaleString()}
            onView={() => fetchCollegeBreakdown('mentors')}
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<EyeOutlined className="text-lg text-pink-500" />}
            iconBg="bg-pink-50"
            title="FACULTY VISITS"
            value={
              <span>
                <span className={visitsPercent > 0 ? 'text-green-600' : 'text-gray-900'}>{visitsPercent}%</span>
                <span className="text-sm font-normal text-gray-400 ml-1">({visitsCompleted}/{visitsExpected})</span>
              </span>
            }
            subtitle={displayMonth}
            onView={() => fetchCollegeBreakdown('visits')}
          />
        </Col>
      </Row>

      <CollegeBreakdownModal
        visible={modalType !== null}
        onClose={closeModal}
        title={getModalTitle(modalType)}
        loading={modalLoading}
        data={collegeData}
        columns={getColumns(modalType)}
      />
    </>
  );
};

export default StatisticsCards;
