import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Modal,
  Tabs,
  Table,
  Input,
  Button,
  Tag,
  Progress,
  Empty,
  Badge,
  Tooltip,
} from 'antd';
import { toast } from 'react-hot-toast';
import {
  WarningOutlined,
  ExclamationCircleOutlined,
  TeamOutlined,
  FileTextOutlined,
  EyeOutlined,
  SearchOutlined,
  RightOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const CriticalAlertsModal = ({ open, onClose, alerts, defaultTab = 'lowCompliance' }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [searchText, setSearchText] = useState('');

  // Sync activeTab with defaultTab when modal opens or defaultTab changes
  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
      setSearchText('');
    }
  }, [open, defaultTab]);

  // Reset search when tab changes
  const handleTabChange = (key) => {
    setActiveTab(key);
    setSearchText('');
  };

  // Navigation handlers - wrapped in useCallback for stability
  const handleViewInstitution = useCallback((institutionId) => {
    if (!institutionId) {
      toast('Institution details not available', { icon: '⚠️' });
      return;
    }
    onClose();
    navigate(`/app/institutions-overview?id=${institutionId}`);
  }, [navigate, onClose]);

  const handleViewStudentInstitution = useCallback((record) => {
    const institutionId = record.institutionId;
    if (!institutionId) {
      toast('Institution details not available', { icon: '⚠️' });
      return;
    }
    onClose();
    navigate(`/app/institutions-overview?id=${institutionId}&tab=students`);
  }, [navigate, onClose]);

  // Filter data based on search
  const filterData = (data, fields) => {
    if (!searchText.trim()) return data;
    const search = searchText.toLowerCase();
    return data?.filter(item =>
      fields.some(field =>
        item[field]?.toString().toLowerCase().includes(search)
      )
    ) || [];
  };

  // Low Compliance Institutions columns
  const lowComplianceColumns = useMemo(() => [
    {
      title: 'Institution',
      dataIndex: 'institutionName',
      key: 'institutionName',
      ellipsis: true,
      render: (text, record) => (
        <div>
          <div className="font-medium text-text-primary">{text}</div>
          <div className="text-xs text-text-tertiary">{record.city}</div>
        </div>
      ),
    },
    {
      title: 'Code',
      dataIndex: 'institutionCode',
      key: 'institutionCode',
      width: 120,
      render: (text) => <Tag className="m-0">{text}</Tag>,
    },
    {
      title: 'Compliance Score',
      dataIndex: 'complianceScore',
      key: 'complianceScore',
      width: 180,
      sorter: (a, b) => a.complianceScore - b.complianceScore,
      render: (score) => (
        <div className="flex items-center gap-2">
          <Progress
            percent={score}
            size="small"
            strokeColor={score >= 50 ? '#faad14' : '#ff4d4f'}
            className="w-24 m-0"
            showInfo={false}
          />
          <span className={`font-bold ${score < 50 ? 'text-error' : 'text-warning'}`}>
            {score}%
          </span>
        </div>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          icon={<RightOutlined />}
          onClick={() => handleViewInstitution(record.institutionId)}
          className="text-primary"
        >
          View
        </Button>
      ),
    },
  ], [handleViewInstitution]);

  // Students Without Mentors columns
  const studentsWithoutMentorsColumns = useMemo(() => [
    {
      title: 'Student',
      dataIndex: 'studentName',
      key: 'studentName',
      ellipsis: true,
      render: (text, record) => (
        <div>
          <div className="font-medium text-text-primary">{text || record.user?.name || record.name}</div>
          <div className="text-xs text-text-tertiary">Roll: {record.user?.rollNumber || record.rollNumber}</div>
        </div>
      ),
    },
    {
      title: 'Institution',
      dataIndex: 'institutionName',
      key: 'institutionName',
      ellipsis: true,
      render: (text, record) => (
        <div>
          <div className="text-text-primary">{text}</div>
          <div className="text-xs text-text-tertiary">{record.institutionCode}</div>
        </div>
      ),
    },
    {
      title: 'Internship Status',
      dataIndex: 'hasInternship',
      key: 'hasInternship',
      width: 140,
      render: (hasInternship, record) => (
        hasInternship ? (
          <Tooltip title={record.daysSinceInternshipStarted ? `Started ${record.daysSinceInternshipStarted} days ago` : 'Internship approved'}>
            <Tag color="blue">Has Internship</Tag>
          </Tooltip>
        ) : (
          <Tag color="default">No Internship</Tag>
        )
      ),
    },
    {
      title: '',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          icon={<RightOutlined />}
          onClick={() => handleViewStudentInstitution(record)}
          className="text-primary"
        >
          View
        </Button>
      ),
    },
  ], [handleViewStudentInstitution]);

  // Missing Reports columns
  const missingReportsColumns = useMemo(() => [
    {
      title: 'Student',
      dataIndex: 'studentName',
      key: 'studentName',
      ellipsis: true,
      render: (text, record) => (
        <div>
          <div className="font-medium text-text-primary">{text || record.user?.name || record.name}</div>
          <div className="text-xs text-text-tertiary">Roll: {record.user?.rollNumber || record.rollNumber}</div>
        </div>
      ),
    },
    {
      title: 'Institution',
      dataIndex: 'institutionName',
      key: 'institutionName',
      ellipsis: true,
      render: (text, record) => (
        <div>
          <div className="text-text-primary">{text}</div>
          <div className="text-xs text-text-tertiary">{record.institutionCode}</div>
        </div>
      ),
    },
    {
      title: 'Days Overdue',
      dataIndex: 'daysOverdue',
      key: 'daysOverdue',
      width: 130,
      sorter: (a, b) => a.daysOverdue - b.daysOverdue,
      render: (days) => (
        <Tag color={days > 10 ? 'red' : days > 5 ? 'orange' : 'gold'}>
          {days} days overdue
        </Tag>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          icon={<RightOutlined />}
          onClick={() => handleViewStudentInstitution(record)}
          className="text-primary"
        >
          View
        </Button>
      ),
    },
  ], [handleViewStudentInstitution]);

  // Faculty Visit Gaps columns
  const visitGapsColumns = useMemo(() => [
    {
      title: 'Institution',
      dataIndex: 'institutionName',
      key: 'institutionName',
      ellipsis: true,
      render: (text, record) => (
        <div>
          <div className="font-medium text-text-primary">{text}</div>
          <div className="text-xs text-text-tertiary">{record.institutionCode}</div>
        </div>
      ),
    },
    {
      title: 'Last Visit',
      dataIndex: 'lastVisitDate',
      key: 'lastVisitDate',
      width: 140,
      render: (date) => (
        <span className="text-text-secondary">
          {date ? dayjs(date).format('MMM D, YYYY') : 'Never'}
        </span>
      ),
    },
    {
      title: 'Days Since Visit',
      dataIndex: 'daysSinceLastVisit',
      key: 'daysSinceLastVisit',
      width: 140,
      sorter: (a, b) => a.daysSinceLastVisit - b.daysSinceLastVisit,
      render: (days) => (
        <Tag color={days > 45 ? 'red' : days > 30 ? 'orange' : 'gold'}>
          {days} days ago
        </Tag>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          icon={<RightOutlined />}
          onClick={() => handleViewInstitution(record.institutionId)}
          className="text-primary"
        >
          View
        </Button>
      ),
    },
  ], [handleViewInstitution]);

  // Prepare filtered data for each tab
  const filteredLowCompliance = filterData(
    alerts?.alerts?.lowComplianceInstitutions,
    ['institutionName', 'institutionCode', 'city']
  );
  const filteredStudentsWithoutMentors = filterData(
    alerts?.alerts?.studentsWithoutMentors,
    ['studentName', 'rollNumber', 'institutionName', 'institutionCode']
  );
  const filteredMissingReports = filterData(
    alerts?.alerts?.missingReports,
    ['studentName', 'rollNumber', 'institutionName', 'institutionCode']
  );
  const filteredVisitGaps = filterData(
    alerts?.alerts?.facultyVisitGaps,
    ['institutionName', 'institutionCode']
  );

  // Tab items with counts
  const tabItems = [
    {
      key: 'lowCompliance',
      label: (
        <span className="flex items-center gap-2">
          <ExclamationCircleOutlined className="text-error" />
          Low Compliance
          <Badge
            count={alerts?.summary?.lowComplianceCount || 0}
            style={{ backgroundColor: '#ff4d4f' }}
            size="small"
          />
        </span>
      ),
      children: (
        <Table
          dataSource={filteredLowCompliance}
          columns={lowComplianceColumns}
          rowKey="institutionId"
          pagination={{ pageSize: 10, showSizeChanger: false }}
          size="middle"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No low compliance institutions"
              />
            ),
          }}
        />
      ),
    },
    {
      key: 'studentsWithoutMentors',
      label: (
        <span className="flex items-center gap-2">
          <TeamOutlined className="text-warning" />
          No Mentors
          <Badge
            count={alerts?.summary?.studentsWithoutMentorsCount || 0}
            style={{ backgroundColor: '#faad14' }}
            size="small"
          />
        </span>
      ),
      children: (
        <Table
          dataSource={filteredStudentsWithoutMentors}
          columns={studentsWithoutMentorsColumns}
          rowKey="studentId"
          pagination={{ pageSize: 10, showSizeChanger: false }}
          size="middle"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="All students have mentors assigned"
              />
            ),
          }}
        />
      ),
    },
    {
      key: 'missingReports',
      label: (
        <span className="flex items-center gap-2">
          <FileTextOutlined className="text-warning" />
          Missing Reports
          <Badge
            count={alerts?.summary?.missingReportsCount || 0}
            style={{ backgroundColor: '#faad14' }}
            size="small"
          />
        </span>
      ),
      children: (
        <Table
          dataSource={filteredMissingReports}
          columns={missingReportsColumns}
          rowKey="studentId"
          pagination={{ pageSize: 10, showSizeChanger: false }}
          size="middle"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No missing reports"
              />
            ),
          }}
        />
      ),
    },
    {
      key: 'visitGaps',
      label: (
        <span className="flex items-center gap-2">
          <EyeOutlined className="text-info" />
          Visit Gaps
          <Badge
            count={alerts?.summary?.visitGapsCount || 0}
            style={{ backgroundColor: '#1890ff' }}
            size="small"
          />
        </span>
      ),
      children: (
        <Table
          dataSource={filteredVisitGaps}
          columns={visitGapsColumns}
          rowKey="institutionId"
          pagination={{ pageSize: 10, showSizeChanger: false }}
          size="middle"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No faculty visit gaps"
              />
            ),
          }}
        />
      ),
    },
  ];

  return (
    <Modal
      title={
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center">
            <WarningOutlined className="text-error text-lg" />
          </div>
          <span className="font-bold text-lg">Critical Alerts Details</span>
          <Badge
            count={alerts?.summary?.totalAlerts || 0}
            style={{ backgroundColor: '#ff4d4f' }}
          />
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={
        <div className="flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      }
      width={1000}
      destroyOnHidden
      styles={{
        body: { padding: '16px 24px' },
      }}
    >
      {/* Search Input */}
      <div className="mb-4">
        <Input
          placeholder="Search by name, code, or roll number..."
          prefix={<SearchOutlined className="text-text-tertiary" />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          className="max-w-md"
        />
      </div>

      {/* Tabs with Tables */}
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabItems}
        className="critical-alerts-tabs"
      />
    </Modal>
  );
};

export default CriticalAlertsModal;
