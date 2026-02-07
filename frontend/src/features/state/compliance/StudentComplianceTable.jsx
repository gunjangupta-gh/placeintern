import React, { useState, useMemo } from 'react';
import { Table, Tag, Input, Typography, Tooltip, Empty, Button, Badge } from 'antd';
import {
  SearchOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  EyeOutlined,
  DownloadOutlined,
  CheckCircleFilled,
  WarningFilled,
  CloseCircleFilled,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

const StudentComplianceTable = ({ students = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Get combined status
  const getStudentStatus = (student) => {
    const reportOk = student.reportStatus === 'submitted';
    const visitOk = student.visitStatus === 'completed';
    if (reportOk && visitOk) return 'complete';
    if (!reportOk && student.reportStatus === 'not_submitted') return 'critical';
    return 'partial';
  };

  // Filter students
  const filteredStudents = useMemo(() => {
    let result = students;

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(
        (s) =>
          s.studentName?.toLowerCase().includes(search) ||
          s.rollNumber?.toLowerCase().includes(search) ||
          s.companyName?.toLowerCase().includes(search)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((s) => {
        const status = getStudentStatus(s);
        return status === statusFilter;
      });
    }

    return result;
  }, [students, searchTerm, statusFilter]);

  // Status counts
  const statusCounts = useMemo(() => {
    return students.reduce((acc, s) => {
      const status = getStudentStatus(s);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, { complete: 0, partial: 0, critical: 0 });
  }, [students]);

  // Table columns
  const columns = [
    {
      title: 'Student',
      key: 'student',
      width: 220,
      render: (_, record) => {
        const status = getStudentStatus(record);
        return (
          <div className="flex items-center gap-3 py-1">
            <div className="relative">
              <div className="w-9 h-9 rounded-lg bg-background-tertiary flex items-center justify-center text-text-tertiary">
                {record.studentName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div
                className={`
                  absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white
                  ${status === 'complete' ? 'bg-success' : status === 'critical' ? 'bg-error' : 'bg-warning'}
                `}
              />
            </div>
            <div className="min-w-0">
              <Text className="font-medium text-text-primary text-sm block truncate max-w-[150px]">
                {record.studentName || 'Unknown'}
              </Text>
              <Text className="text-xs text-text-tertiary font-mono">
                {record.rollNumber}
              </Text>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Company',
      dataIndex: 'companyName',
      key: 'companyName',
      width: 160,
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text}>
          <Text className="text-text-secondary text-sm">{text || '-'}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Report',
      key: 'report',
      width: 140,
      render: (_, record) => {
        const isSubmitted = record.reportStatus === 'submitted';
        const isPending = record.reportStatus === 'pending';
        return (
          <div className="flex items-center gap-2">
            <Tag
              icon={isSubmitted ? <CheckCircleOutlined /> : isPending ? <ClockCircleOutlined /> : <CloseCircleOutlined />}
              color={isSubmitted ? 'success' : isPending ? 'warning' : 'error'}
              className="m-0"
            >
              {isSubmitted ? 'Submitted' : isPending ? 'Review' : 'Missing'}
            </Tag>
            {record.reportFileUrl && (
              <Tooltip title="Download Report">
                <Button
                  type="text"
                  size="small"
                  icon={<DownloadOutlined className="text-text-tertiary" />}
                  onClick={() => window.open(record.reportFileUrl, '_blank')}
                  className="!p-0 !h-auto"
                />
              </Tooltip>
            )}
          </div>
        );
      },
    },
    {
      title: 'Visit',
      key: 'visit',
      width: 120,
      render: (_, record) => {
        const isCompleted = record.visitStatus === 'completed';
        return (
          <Tag
            icon={isCompleted ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
            color={isCompleted ? 'success' : 'warning'}
            className="m-0"
          >
            {isCompleted ? 'Completed' : 'Pending'}
          </Tag>
        );
      },
    },
    {
      title: 'Mentor',
      dataIndex: 'mentorName',
      key: 'mentor',
      width: 140,
      ellipsis: true,
      render: (text) => (
        <Text className="text-text-secondary text-sm">{text || '-'}</Text>
      ),
    },
  ];

  // Empty state
  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 rounded-full bg-background-tertiary flex items-center justify-center mb-4">
          <FileTextOutlined className="text-2xl text-text-tertiary" />
        </div>
        <Text className="text-text-secondary font-medium mb-1">No Students</Text>
        <Text className="text-text-tertiary text-sm">
          No students in training for this month
        </Text>
      </div>
    );
  }

  return (
    <div className="student-compliance-table">
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <Input
          placeholder="Search student or company..."
          prefix={<SearchOutlined className="text-text-tertiary" />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          allowClear
          className="w-64"
        />

        {/* Quick filter chips */}
        <div className="flex items-center gap-1.5">
          <Tag
            className={`cursor-pointer m-0 ${statusFilter === 'all' ? 'bg-primary text-white border-primary' : 'bg-transparent'}`}
            onClick={() => setStatusFilter('all')}
          >
            All ({students.length})
          </Tag>
          <Tag
            color={statusFilter === 'complete' ? 'success' : undefined}
            className={`cursor-pointer m-0 ${statusFilter === 'complete' ? '' : 'bg-transparent border-success text-success'}`}
            onClick={() => setStatusFilter(statusFilter === 'complete' ? 'all' : 'complete')}
          >
            <CheckCircleFilled className="text-[10px]" /> {statusCounts.complete}
          </Tag>
          <Tag
            color={statusFilter === 'partial' ? 'warning' : undefined}
            className={`cursor-pointer m-0 ${statusFilter === 'partial' ? '' : 'bg-transparent border-warning text-warning'}`}
            onClick={() => setStatusFilter(statusFilter === 'partial' ? 'all' : 'partial')}
          >
            <WarningFilled className="text-[10px]" /> {statusCounts.partial}
          </Tag>
          <Tag
            color={statusFilter === 'critical' ? 'error' : undefined}
            className={`cursor-pointer m-0 ${statusFilter === 'critical' ? '' : 'bg-transparent border-error text-error'}`}
            onClick={() => setStatusFilter(statusFilter === 'critical' ? 'all' : 'critical')}
          >
            <CloseCircleFilled className="text-[10px]" /> {statusCounts.critical}
          </Tag>
        </div>

        <Text className="text-text-tertiary text-xs ml-auto">
          Showing {filteredStudents.length} of {students.length}
        </Text>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={filteredStudents}
        rowKey="studentId"
        size="small"
        scroll={{ y: 'calc(100vh - 420px)' }}
        pagination={false}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={searchTerm || statusFilter !== 'all' ? 'No students match the filters' : 'No students'}
            />
          ),
        }}
        rowClassName={(record) => {
          const status = getStudentStatus(record);
          let className = 'transition-colors ';
          if (status === 'complete') className += 'bg-success/5 hover:bg-success/10';
          else if (status === 'critical') className += 'bg-error/5 hover:bg-error/10';
          else className += 'hover:bg-background-tertiary';
          return className;
        }}
      />
    </div>
  );
};

export default StudentComplianceTable;
