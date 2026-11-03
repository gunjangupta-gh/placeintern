import React, { useCallback, useEffect, useState } from 'react';
import { Button, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import { opportunityService, getErrorMessage, formatDate } from '../../../services/opportunity.service';
import { useDebounce } from '../../../hooks/useDebounce';

const { Text } = Typography;
const PENDING = ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED'];
const STATUS_COLOR = { APPLIED: 'blue', UNDER_REVIEW: 'blue', SHORTLISTED: 'cyan', APPROVED: 'green', JOINED: 'green', SELECTED: 'green', COMPLETED: 'default', REJECTED: 'red' };

const ApplicationsReview = ({ refreshKey, onChanged }) => {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('APPLIED');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState([]);
  const [decision, setDecision] = useState(null); // { action, ids }
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const debounced = useDebounce(search, 300);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await opportunityService.listApplications({ page, limit: 20, status, search: debounced });
      setRows(res.data || []);
      setMeta(res.meta || { total: 0 });
      setSelected([]);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load applications'));
    } finally {
      setLoading(false);
    }
  }, [page, status, debounced]);

  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => { setPage(1); }, [status, debounced]);

  const openDecision = (action, ids) => { setRemarks(''); setDecision({ action, ids }); };

  const submit = async () => {
    if (decision.action === 'REJECT' && !remarks.trim()) {
      toast.error('Please give a reason for rejecting');
      return;
    }
    setSubmitting(true);
    try {
      const res = await opportunityService.decideApplications(decision.action, decision.ids, remarks.trim() || undefined);
      const verb = decision.action === 'APPROVE' ? 'approved' : 'rejected';
      if (res.succeeded) toast.success(`${res.succeeded} application(s) ${verb}`);
      res.results.filter((r) => !r.ok).forEach((r) => toast.error(String(r.error)));
      setDecision(null);
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Action failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { title: 'Student', render: (_, r) => <div><div>{r.student?.user?.name}</div><Text type="secondary" style={{ fontSize: 12 }}>{r.student?.user?.rollNumber}</Text></div> },
    { title: 'Institution', dataIndex: ['student', 'Institution', 'name'] },
    { title: 'Branch', dataIndex: ['student', 'branch', 'name'] },
    { title: 'Position', render: (_, r) => <div><div>{r.opportunity?.title}</div><Text type="secondary" style={{ fontSize: 12 }}>{r.opportunity?.company?.name}</Text></div> },
    {
      title: 'Seats',
      render: (_, r) => (r.opportunity ? `${r.opportunity.approvedCount} / ${r.opportunity.positions} approved` : '-'),
    },
    { title: 'Applied', dataIndex: 'appliedDate', render: formatDate },
    { title: 'Status', dataIndex: 'status', render: (s) => <Tag color={STATUS_COLOR[s]}>{s}</Tag> },
    {
      title: 'Actions',
      render: (_, r) =>
        PENDING.includes(r.status) ? (
          <Space>
            <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => openDecision('APPROVE', [r.id])}>Approve</Button>
            <Button size="small" danger icon={<CloseOutlined />} onClick={() => openDecision('REJECT', [r.id])}>Reject</Button>
          </Space>
        ) : (
          r.reviewRemarks || r.rejectionReason || ''
        ),
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 12 }} wrap>
        <Input.Search allowClear placeholder="Search student name or roll no." style={{ width: 280 }} value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select
          allowClear
          placeholder="Status"
          style={{ width: 160 }}
          value={status}
          onChange={setStatus}
          options={['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'APPROVED', 'JOINED', 'COMPLETED', 'REJECTED'].map((s) => ({ value: s, label: s }))}
        />
        <Button type="primary" icon={<CheckOutlined />} disabled={!selected.length} onClick={() => openDecision('APPROVE', selected)}>
          Approve selected ({selected.length})
        </Button>
        <Button danger icon={<CloseOutlined />} disabled={!selected.length} onClick={() => openDecision('REJECT', selected)}>
          Reject selected
        </Button>
      </Space>

      <Table
        rowKey="id"
        size="middle"
        loading={loading}
        dataSource={rows}
        columns={columns}
        scroll={{ x: 'max-content' }}
        rowSelection={{
          selectedRowKeys: selected,
          onChange: setSelected,
          getCheckboxProps: (r) => ({ disabled: !PENDING.includes(r.status) }),
        }}
        pagination={{ current: page, pageSize: 20, total: meta.total, onChange: setPage, showSizeChanger: false }}
      />

      <Modal
        open={!!decision}
        title={decision?.action === 'APPROVE' ? `Approve ${decision?.ids.length} application(s)` : `Reject ${decision?.ids.length} application(s)`}
        okText={decision?.action === 'APPROVE' ? 'Approve' : 'Reject'}
        okButtonProps={{ danger: decision?.action === 'REJECT' }}
        confirmLoading={submitting}
        onOk={submit}
        onCancel={() => setDecision(null)}
        destroyOnHidden
      >
        {decision?.action === 'APPROVE' && (
          <p>Confirm the student(s) have got this internship. Their internship starts on the opportunity's start date and enters the normal mentor, report and visit workflow. Any other pending application they have is withdrawn automatically.</p>
        )}
        <Input.TextArea
          rows={3}
          maxLength={500}
          showCount
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder={decision?.action === 'REJECT' ? 'Reason (required, shown to the student)' : 'Remarks (optional)'}
        />
      </Modal>
    </>
  );
};

export default ApplicationsReview;
