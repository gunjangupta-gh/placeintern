import React, { useMemo } from 'react';
import { Modal, Table, Tag, Alert, Typography } from 'antd';
import {
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  MinusOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { isMonthIncluded } from '../../../../utils/monthlyCycle';

const { Title, Text } = Typography;

const VisitLogsOverviewModal = ({ visible, onClose, students = [], visitLogs = [] }) => {
  // Generate months for the table
  const generateMonthColumns = () => {
    const months = [];
    const now = new Date();
    const startMonth = now.getMonth() - 1; // Start from previous month
    const startYear = now.getFullYear();

    for (let i = 0; i < 8; i++) {
      const date = new Date(startYear, startMonth + i, 1);
      const monthName = date.toLocaleString('default', { month: 'short' });
      const year = date.getFullYear();
      months.push({
        month: date.getMonth() + 1,
        year,
        label: `${monthName} ${year}`,
        key: `${date.getMonth() + 1}-${year}`,
      });
    }
    return months;
  };

  const monthColumns = generateMonthColumns();

  // Calculate pending visits summary (students without visits in current/past months)
  // Uses 10-day rule: only counts months where student has >10 days
  const pendingVisitsSummary = useMemo(() => {
    const summary = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    students.forEach(studentItem => {
      const student = studentItem.student || studentItem;
      // Get internship from the correct nested path
      const activeApplication = student.internshipApplications?.[0] || studentItem.application;
      const internship = activeApplication?.internship ||
                         student.activeInternship ||
                         studentItem.internship;

      const internshipStartDate = activeApplication?.startDate || internship?.startDate;
      const internshipEndDate = activeApplication?.endDate || internship?.endDate;
      if (!internshipStartDate || !internshipEndDate) return;

      // Check each past month for missing visits
      monthColumns.forEach(col => {
        const monthDate = new Date(col.year, col.month - 1, 1);

        // Use 10-day rule to check if this month should be included
        const monthIncluded = isMonthIncluded(internshipStartDate, internshipEndDate, col.year, col.month);

        // Only check past months that are included based on 10-day rule
        if (monthIncluded && monthDate <= currentMonth) {
          const hasVisit = visitLogs.some(v => {
            const visitDate = new Date(v.visitDate);
            const studentMatch = v.application?.studentId === student.id ||
                                 v.studentId === student.id ||
                                 v.application?.student?.id === student.id;
            return studentMatch &&
                   visitDate.getMonth() + 1 === col.month &&
                   visitDate.getFullYear() === col.year;
          });

          if (!hasVisit) {
            const key = `${col.month}-${col.year}`;
            if (!summary[key]) {
              summary[key] = {
                month: col.month,
                year: col.year,
                label: `${monthNames[col.month - 1]} ${col.year}`,
                count: 0,
              };
            }
            summary[key].count++;
          }
        }
      });
    });

    return Object.values(summary);
  }, [students, visitLogs, monthColumns]);

  // Build table data with students and their visit status per month
  const tableData = useMemo(() => {
    return students.map((studentItem, index) => {
      const student = studentItem.student || studentItem;
      // Get internship from the correct nested path
      const activeApplication = student.internshipApplications?.[0] || studentItem.application;
      const internship = activeApplication?.internship ||
                         student.activeInternship ||
                         studentItem.internship;

      const internshipName = internship?.title || internship?.role || activeApplication?.jobProfile || 'N/A';
      const companyName = internship?.industry?.companyName ||
                          internship?.company?.name ||
                          internship?.companyName ||
                          activeApplication?.companyName ||
                          '';

      const internshipDisplay = companyName
        ? `${internshipName} - ${companyName}`
        : internshipName;

      const internshipType = activeApplication?.applicationType ||
                             (activeApplication?.isSelfIdentified ? 'Self-Identified' : 'Placement') ||
                             internship?.type ||
                             'Self-Identified';

      // Get internship dates from application or internship
      const internshipStartDate = activeApplication?.startDate || internship?.startDate;
      const internshipEndDate = activeApplication?.endDate || internship?.endDate;

      // Get visit status for each month
      const monthStatuses = {};
      monthColumns.forEach(col => {
        const visit = visitLogs.find(v => {
          const visitDate = new Date(v.visitDate);
          const studentMatch = v.application?.studentId === student.id ||
                               v.studentId === student.id ||
                               v.application?.student?.id === student.id;
          return studentMatch &&
                 visitDate.getMonth() + 1 === col.month &&
                 visitDate.getFullYear() === col.year;
        });

        const monthDate = new Date(col.year, col.month - 1, 1);
        let status = 'future'; // Default: future month

        // Use 10-day rule to check if this month should be included
        const monthIncluded = internshipStartDate && internshipEndDate
          ? isMonthIncluded(internshipStartDate, internshipEndDate, col.year, col.month)
          : false;

        if (!internshipStartDate || !internshipEndDate) {
          // No dates - mark as N/A (internship not properly set up)
          status = 'na';
        } else if (!monthIncluded) {
          // Month doesn't meet 10-day rule - mark as N/A
          status = 'na';
        }

        if (visit) {
          status = visit.status || 'COMPLETED';
        } else if (status !== 'na' && status !== 'future') {
          // Check if this month is in the past (should have a visit)
          const now = new Date();
          const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          if (monthDate < currentMonth) {
            status = 'missing';
          }
        }

        monthStatuses[col.key] = {
          status,
          visitType: visit?.visitType,
          visitDate: visit?.visitDate,
        };
      });

      return {
        key: student.id || index,
        studentName: student?.user?.name || student.name || 'Unknown',
        rollNumber: student?.user?.rollNumber || student.rollNumber || student.collegeId || '',
        internship: internshipDisplay,
        internshipType,
        ...monthStatuses,
      };
    });
  }, [students, visitLogs, monthColumns]);

  // Render status cell
  const renderStatusCell = (data) => {
    if (!data) return <MinusOutlined style={{ color: '#d1d5db', fontSize: '14px' }} />;

    const { status, visitType } = data;

    switch (status) {
      case 'COMPLETED':
        return (
          <div className="flex flex-col items-center">
            <CheckCircleOutlined style={{ color: '#10b981', fontSize: '18px' }} />
            {visitType && (
              <span className="text-xs text-gray-400 mt-1">
                {visitType === 'PHYSICAL' ? 'P' : visitType === 'VIRTUAL' ? 'V' : 'T'}
              </span>
            )}
          </div>
        );
      case 'missing':
        return <CloseCircleOutlined style={{ color: '#ef4444', fontSize: '18px' }} />;
      case 'na':
        return <Text type="secondary">N/A</Text>;
      default:
        return <MinusOutlined style={{ color: '#d1d5db', fontSize: '14px' }} />;
    }
  };

  // Table columns
  const columns = [
    {
      title: 'Student',
      dataIndex: 'studentName',
      key: 'studentName',
      fixed: 'left',
      width: 180,
      sorter: (a, b) => a.studentName.localeCompare(b.studentName),
      render: (name, record) => (
        <div>
          <div className="font-semibold">{name}</div>
          <div className="text-xs text-gray-500">{record.rollNumber}</div>
        </div>
      ),
    },
    {
      title: 'Internship',
      dataIndex: 'internship',
      key: 'internship',
      width: 250,
      render: (text, record) => (
        <div>
          <div className="text-sm">{text}</div>
          <div className="text-xs text-gray-400">({record.internshipType})</div>
        </div>
      ),
    },
    ...monthColumns.map(col => ({
      title: col.label,
      dataIndex: col.key,
      key: col.key,
      width: 100,
      align: 'center',
      render: (data) => renderStatusCell(data),
    })),
  ];

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <VideoCameraOutlined style={{ color: '#3b82f6' }} />
          <Title level={4} style={{ margin: 0 }}>Visit Logs Overview</Title>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1200}
      centered
      styles={{
        body: { padding: '24px', maxHeight: '70vh', overflowY: 'auto' },
      }}
    >
      {/* Pending Visits Summary */}
      {pendingVisitsSummary.length > 0 && (
        <Alert
          type="warning"
          icon={<ExclamationCircleOutlined />}
          message={
            <div>
              <Text strong>Pending Visits Summary</Text>
              <div className="mt-2 flex flex-wrap !gap-2">
                {pendingVisitsSummary.map((item, idx) => (
                  <Tag
                    key={idx}
                    style={{
                      borderRadius: '12px',
                      padding: '2px 12px',
                      backgroundColor: '#fef3c7',
                      color: '#f59e0b',
                      border: '1px solid #f59e0b',
                    }}
                  >
                    {item.label}: {item.count} student{item.count > 1 ? 's' : ''}
                  </Tag>
                ))}
              </div>
            </div>
          }
          className="mb-4 rounded-lg"
          style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7' }}
        />
      )}

      {/* Table */}
      <Table
        columns={columns}
        dataSource={tableData}
        pagination={false}
        scroll={{ x: 1200 }}
        size="middle"
        bordered
        className="visit-logs-table"
      />

      {/* Legend */}
      <div className="mt-4 flex flex-wrap !gap-4 text-sm">
        <div className="flex items-center !gap-2">
          <CheckCircleOutlined style={{ color: '#10b981' }} />
          <span>Completed (P=Physical, V=Virtual, T=Telephonic)</span>
        </div>
        <div className="flex items-center !gap-2">
          <CloseCircleOutlined style={{ color: '#ef4444' }} />
          <span>Missing</span>
        </div>
        <div className="flex items-center !gap-2">
          <Text type="secondary">N/A</Text>
          <span>Not Applicable</span>
        </div>
      </div>
    </Modal>
  );
};

export default VisitLogsOverviewModal;
