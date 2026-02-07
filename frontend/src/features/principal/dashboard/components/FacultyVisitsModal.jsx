import React, { useState, useMemo, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Modal,
  Table,
  Typography,
  Tag,
  Select,
  Empty,
  Button,
  theme
} from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import {
  selectFacultyWorkload,
  selectFacultyWorkloadLoading,
  selectMentorCoverage,
  fetchFacultyWorkload,
} from '../../store/principalSlice';

const { Text } = Typography;

// Generate month options for the last 12 months
const generateMonthOptions = () => {
  const options = [];
  const now = new Date();

  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const isCurrent = i === 0;

    options.push({
      label: isCurrent ? `${monthName} (Current)` : monthName,
      value,
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    });
  }

  return options;
};

const FacultyVisitsModal = ({
  visible,
  onClose,
  alertsData = [],
  complianceData = null,
}) => {
  const dispatch = useDispatch();
  const faculty = useSelector(selectFacultyWorkload);
  const facultyLoading = useSelector(selectFacultyWorkloadLoading);
  const mentorCoverage = useSelector(selectMentorCoverage);
  const { token } = theme.useToken();

  const monthOptions = useMemo(() => generateMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]?.value);

  // Reset to current month when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedMonth(monthOptions[0]?.value);
    }
  }, [visible, monthOptions]);

  // Fetch data when month filter changes
  const handleMonthChange = (value) => {
    setSelectedMonth(value);
    const option = monthOptions.find(opt => opt.value === value);
    if (option) {
      dispatch(fetchFacultyWorkload({ month: option.month, year: option.year, forceRefresh: true }));
    }
  };

  // Process faculty data with visit status - using new current month data
  const facultyVisitData = useMemo(() => {
    if (!faculty || faculty.length === 0) return [];

    // Map faculty data directly - now includes currentMonthVisits and currentMonthExpectedVisits
    const result = faculty.map(f => ({
      id: f.id,
      name: f.name || 'Unknown',
      assignedStudents: f.assignedCount || 0,
      // Current month data
      completedVisits: f.currentMonthVisits || 0,
      expectedVisits: f.currentMonthExpectedVisits || 0,
      pendingVisits: Math.max(0, (f.currentMonthExpectedVisits || 0) - (f.currentMonthVisits || 0)),
      // Cumulative data for reference
      totalVisits: f.totalVisits || 0,
    }));

    // Sort: by pending count descending, then by assigned count
    return result.sort((a, b) => {
      // Sort by pending visits descending
      if (b.pendingVisits !== a.pendingVisits) {
        return b.pendingVisits - a.pendingVisits;
      }
      // Then by assigned students descending
      return b.assignedStudents - a.assignedStudents;
    });
  }, [faculty]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalStudents = facultyVisitData.reduce((sum, f) => sum + f.assignedStudents, 0);
    const totalCompleted = facultyVisitData.reduce((sum, f) => sum + f.completedVisits, 0);
    const totalExpected = facultyVisitData.reduce((sum, f) => sum + f.expectedVisits, 0);
    const totalPending = facultyVisitData.reduce((sum, f) => sum + f.pendingVisits, 0);
    return { totalStudents, totalCompleted, totalExpected, totalPending };
  }, [facultyVisitData]);

  // Get current month display name
  const currentMonthDisplay = useMemo(() => {
    const option = monthOptions.find(opt => opt.value === selectedMonth);
    return option ? option.label.replace(' (Current)', '') : '';
  }, [selectedMonth, monthOptions]);

  const columns = [
    {
      title: 'Faculty Mentor',
      dataIndex: 'name',
      key: 'name',
      render: (text) => (
        <Text strong>{text}</Text>
      ),
    },
    {
      title: 'Assigned Students',
      dataIndex: 'assignedStudents',
      key: 'assignedStudents',
      align: 'center',
      render: (count) => (
        <Tag
          bordered={false}
          style={{
            minWidth: '40px',
            textAlign: 'center',
            color: token.colorPrimaryText,
            backgroundColor: token.colorPrimaryBg,
          }}
        >
          {count}
        </Tag>
      ),
      sorter: (a, b) => a.assignedStudents - b.assignedStudents,
    },
    {
      title: `Completed (${currentMonthDisplay})`,
      dataIndex: 'completedVisits',
      key: 'completedVisits',
      align: 'center',
      render: (count, record) => {
        // Show NA if no expected visits for this month (not applicable)
        if (record.expectedVisits === 0 && record.assignedStudents > 0) {
          return (
            <Tag
              bordered={false}
              style={{
                minWidth: '40px',
                textAlign: 'center',
                color: token.colorTextSecondary,
                backgroundColor: token.colorBgContainerDisabled,
              }}
            >
              NA
            </Tag>
          );
        }
        // Show dash if no assigned students
        if (record.assignedStudents === 0) {
          return (
            <Text style={{ color: token.colorTextSecondary }}>-</Text>
          );
        }
        return (
          <Text>
            <span style={{ fontWeight: 600, color: token.colorSuccess }}>{count}</span>
            <span style={{ color: token.colorTextSecondary }}> / {record.expectedVisits}</span>
          </Text>
        );
      },
      sorter: (a, b) => a.completedVisits - b.completedVisits,
    },
    {
      title: 'Pending',
      dataIndex: 'pendingVisits',
      key: 'pendingVisits',
      align: 'center',
      render: (count, record) => {
        // Show NA if no expected visits for this month (not applicable)
        if (record.expectedVisits === 0 && record.assignedStudents > 0) {
          return (
            <Tag
              bordered={false}
              style={{
                minWidth: '40px',
                textAlign: 'center',
                color: token.colorTextSecondary,
                backgroundColor: token.colorBgContainerDisabled,
              }}
            >
              NA
            </Tag>
          );
        }
        // Show dash if no assigned students
        if (record.assignedStudents === 0) {
          return (
            <Text style={{ color: token.colorTextSecondary }}>-</Text>
          );
        }
        return (
          <Tag
            bordered={false}
            style={{
              minWidth: '40px',
              textAlign: 'center',
              backgroundColor: count > 0 ? token.colorErrorBg : token.colorSuccessBg,
              color: count > 0 ? token.colorErrorText : token.colorSuccessText,
            }}
          >
            {count}
          </Tag>
        );
      },
      sorter: (a, b) => a.pendingVisits - b.pendingVisits,
    },
  ];

  return (
    <Modal
      title="Faculty Visits Overview"
      open={visible}
      onCancel={onClose}
      centered
      destroyOnClose
      transitionName=""
      maskTransitionName=""
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>
      ]}
      width={900}
      styles={{ body: { padding: '24px' } }}
    >
      {/* Month Filter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: token.colorTextSecondary }}>
          <CalendarOutlined />
          <Text strong>Filter by Month:</Text>
        </div>
        <Select
          value={selectedMonth}
          onChange={handleMonthChange}
          options={monthOptions}
          style={{ width: 200 }}
          placeholder="Select Month"
        />
      </div>

      {/* Summary Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
          marginBottom: 24,
          borderRadius: token.borderRadiusLG,
          backgroundColor: token.colorInfoBg,
          border: `1px solid ${token.colorInfoBorder}`,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text strong>Total Students:</Text>
          <Tag bordered={false} style={{ fontSize: '14px', padding: '2px 12px', color: token.colorPrimaryText, backgroundColor: token.colorPrimaryBg }}>
            {totals.totalStudents}
          </Tag>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text strong>Completed:</Text>
          <Tag bordered={false} style={{ fontSize: '14px', padding: '2px 12px', color: token.colorSuccessText, backgroundColor: token.colorSuccessBg }}>
            {totals.totalCompleted} / {totals.totalExpected}
          </Tag>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text strong>Pending:</Text>
          <Tag
            bordered={false}
            style={{
              fontSize: '14px',
              padding: '2px 12px',
              backgroundColor: totals.totalPending > 0 ? token.colorErrorBg : token.colorSuccessBg,
              color: totals.totalPending > 0 ? token.colorErrorText : token.colorSuccessText,
              border: `1px solid ${totals.totalPending > 0 ? token.colorErrorBorder : token.colorSuccessBorder}`,
            }}
          >
            {totals.totalPending}
          </Tag>
        </div>
      </div>

      {/* Faculty Table */}
      <Table
        dataSource={facultyVisitData}
        columns={columns}
        rowKey="id"
        loading={facultyLoading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          pageSizeOptions: ['5', '10', '20'],
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} mentors`,
        }}
        size="small"
        locale={{
          emptyText: <Empty description="No faculty data available" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        }}
      />
    </Modal>
  );
};

export default FacultyVisitsModal;

