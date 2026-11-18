import React, { useEffect, useState } from 'react';
import { Alert, Button, Tag, Typography } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { AppModal, AppTable } from '../../../../components/ui';
import { facultyService } from '../../../../services/faculty.service';

const { Text } = Typography;

/**
 * Pop-up for mentors: lists the mentees whose internship type (and its stipend / fee) has not been
 * filled in yet. Opens every time the dashboard is opened while something is still missing.
 * Students never see this; it is shown on the faculty dashboard only.
 */
const IncompleteInternshipDetailsModal = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);

  useEffect(() => {
    let cancelled = false;
    facultyService
      .getIncompleteInternshipDetails()
      .then((res) => {
        if (cancelled) return;
        const list = res?.items || [];
        setItems(list);
        setOpen(list.length > 0);
      })
      .catch(() => {
        // The reminder is best-effort; the dashboard must work without it
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const goFill = (studentId) => {
    setOpen(false);
    navigate(studentId ? `/app/assigned-students?studentId=${studentId}` : '/app/assigned-students');
  };

  const columns = [
    {
      title: 'Student',
      key: 'student',
      render: (_, r) => (
        <div>
          <div>{r.studentName || '-'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.rollNumber}</Text>
        </div>
      ),
    },
    { title: 'Company', dataIndex: 'companyName', key: 'companyName', render: (v) => v || '-' },
    {
      title: 'Missing',
      key: 'missing',
      render: (_, r) => r.missing.map((f) => <Tag key={f.key} color="orange">{f.label}</Tag>),
    },
    {
      title: '',
      key: 'action',
      render: (_, r) => (
        <Button type="link" size="small" onClick={() => goFill(r.studentId)}>
          Fill details
        </Button>
      ),
    },
  ];

  return (
    <AppModal
      open={open}
      onCancel={() => setOpen(false)}
      title={
        <span>
          <WarningOutlined style={{ color: '#faad14', marginRight: 8 }} />
          Internship details missing for {items.length} {items.length === 1 ? 'internship' : 'internships'}
        </span>
      }
      width={760}
      centered
      destroyOnHidden
      footer={[
        <Button key="later" onClick={() => setOpen(false)}>
          Remind me later
        </Button>,
        <Button key="go" type="primary" onClick={() => goFill()}>
          Go to Assigned Students
        </Button>,
      ]}
    >
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        message="Please fill in the internship type (With Stipend, Without Stipend or Paid by Student) and its stipend / fee for these students. Open the student, go to the Internships tab and use Edit."
      />
      <AppTable
        rowKey="applicationId"
        size="small"
        dataSource={items}
        columns={columns}
        pagination={{ pageSize: 5, hideOnSinglePage: true }}
        scroll={{ x: 'max-content' }}
      />
    </AppModal>
  );
};

export default IncompleteInternshipDetailsModal;
