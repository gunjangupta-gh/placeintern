import React, { useCallback, useEffect, useState } from 'react';
import { Button, Input, Modal, Popconfirm, Segmented, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { CheckOutlined, CloseOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import { opportunityService, getErrorMessage, formatDate } from '../../../services/opportunity.service';
import { useDebounce } from '../../../hooks/useDebounce';

const { Text } = Typography;
const PENDING = ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED'];
const CONFIRMED = ['SELECTED', 'APPROVED', 'JOINED', 'COMPLETED'];
const STATUS_COLOR = { APPLIED: 'blue', UNDER_REVIEW: 'blue', SHORTLISTED: 'cyan', APPROVED: 'green', JOINED: 'green', SELECTED: 'green', COMPLETED: 'default', REJECTED: 'red', WITHDRAWN: 'default' };
const GROUP_OPTIONS = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Selected', value: 'SELECTED' },
  { label: 'Rejected / Withdrawn', value: 'CLOSED' },
];

/**
 * Applications made against State-published opportunities.
 *  - opportunityId: limit to one opportunity (used on the opportunity page)
 *  - fixedGroup:    lock the list to PENDING | SELECTED | CLOSED and hide the group switch
 * The group filter drives both the table and the Excel export, so they always match.
 */
const ApplicationsReview = ({ refreshKey, onChanged, opportunityId, fixedGroup }) => {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [page, setPage] = useState(1);
  const [group, setGroup] = useState(fixedGroup || 'ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState([]);
  const [decision, setDecision] = useState(null); // { action: APPROVE | REJECT, ids }
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const debounced = useDebounce(search, 300);
  const activeGroup = fixedGroup || group;
  const scoped = !!opportunityId;

  const filters = useCallback(
    () => ({ opportunityId, group: activeGroup === 'ALL' ? undefined : activeGroup, search: debounced }),
    [opportunityId, activeGroup, debounced]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await opportunityService.listApplications({ ...filters(), page, limit: 20 });
      setRows(res.data || []);
      setMeta(res.meta || { total: 0 });
      setSelected([]);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load applications'));
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => { setPage(1); }, [activeGroup, debounced, opportunityId]);

  const done = async () => { await load(); onChanged?.(); };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const blob = await opportunityService.exportApplications(filters());
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `internship-applications-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Export failed'));
    } finally {
      setExporting(false);
    }
  };

  const runBulk = async (action, ids, text) => {
    const res = await opportunityService.decideApplications(action, ids, text);
    const verb = { APPROVE: 'approved', REJECT: 'rejected', DELETE: 'deleted' }[action];
    if (res.succeeded) toast.success(`${res.succeeded} application(s) ${verb}`);
    res.results.filter((r) => !r.ok).forEach((r) => toast.error(String(r.error)));
    return res;
  };

  const submitDecision = async () => {
    if (decision.action === 'REJECT' && !remarks.trim()) {
      toast.error('Please give a reason for rejecting');
      return;
    }
    setSubmitting(true);
    try {
      await runBulk(decision.action, decision.ids, remarks.trim() || undefined);
      setDecision(null);
      await done();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Action failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const deleteApplications = async (ids) => {
    try {
      await runBulk('DELETE', ids);
      await done();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Delete failed'));
    }
  };

  const openDecision = (action, ids) => { setRemarks(''); setDecision({ action, ids }); };
  const selectedPending = rows.filter((r) => selected.includes(r.id) && PENDING.includes(r.status)).map((r) => r.id);

  const deleteText = (r) =>
    CONFIRMED.includes(r.status)
      ? 'The approval will be undone and the seat released. Not possible once reports or visits exist.'
      : "The seat and the student's application slot are released, and the student can apply to this internship again.";

  const columns = [
    { title: 'Student', render: (_, r) => <div><div>{r.student?.user?.name}</div><Text type="secondary" style={{ fontSize: 12 }}>{r.student?.user?.rollNumber}</Text></div> },
    ...(scoped
      ? [{ title: 'Contact', render: (_, r) => <div style={{ fontSize: 12 }}><div>{r.student?.user?.phoneNo}</div><Text type="secondary" style={{ fontSize: 12 }}>{r.student?.user?.email}</Text></div> }]
      : []),
    { title: 'Institution', dataIndex: ['student', 'Institution', 'name'] },
    { title: 'Branch', dataIndex: ['student', 'branch', 'name'] },
    ...(scoped
      ? []
      : [
          { title: 'Position', render: (_, r) => <div><div>{r.opportunity?.title}</div><Text type="secondary" style={{ fontSize: 12 }}>{r.opportunity?.company?.name}</Text></div> },
          { title: 'Seats', render: (_, r) => (r.opportunity ? `${r.opportunity.approvedCount} / ${r.opportunity.positions} selected` : '-') },
        ]),
    { title: 'Applied', dataIndex: 'appliedDate', render: formatDate },
    { title: 'Status', dataIndex: 'status', render: (s) => <Tag color={STATUS_COLOR[s]}>{s}</Tag> },
    {
      title: 'Actions',
      render: (_, r) => (
        <Space size={4}>
          {PENDING.includes(r.status) && (
            <>
              <Tooltip title="Approve">
                <Button size="small" type="text" aria-label="Approve" style={{ color: '#52c41a' }} icon={<CheckOutlined />} onClick={() => openDecision('APPROVE', [r.id])} />
              </Tooltip>
              <Tooltip title="Reject">
                <Button size="small" type="text" danger aria-label="Reject" icon={<CloseOutlined />} onClick={() => openDecision('REJECT', [r.id])} />
              </Tooltip>
            </>
          )}
          <Popconfirm title="Delete this application?" description={deleteText(r)} okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => deleteApplications([r.id])}>
            <Tooltip title="Delete">
              <Button size="small" type="text" danger aria-label="Delete" icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
          {!PENDING.includes(r.status) && (r.reviewRemarks || r.rejectionReason) && (
            <Text type="secondary" style={{ fontSize: 12 }} ellipsis={{ tooltip: r.rejectionReason || r.reviewRemarks }}>
              {r.rejectionReason || r.reviewRemarks}
            </Text>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 12 }} wrap>
        {!fixedGroup && <Segmented options={GROUP_OPTIONS} value={group} onChange={setGroup} />}
        <Input.Search allowClear placeholder="Search student name or roll no." style={{ width: 260 }} value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button icon={<DownloadOutlined />} loading={exporting} onClick={exportExcel}>Export Excel</Button>
        {selected.length > 0 && (
          <>
            <Button type="primary" icon={<CheckOutlined />} disabled={!selectedPending.length} onClick={() => openDecision('APPROVE', selectedPending)}>
              Approve ({selectedPending.length})
            </Button>
            <Button danger icon={<CloseOutlined />} disabled={!selectedPending.length} onClick={() => openDecision('REJECT', selectedPending)}>
              Reject ({selectedPending.length})
            </Button>
            <Popconfirm
              title={`Delete ${selected.length} application(s)?`}
              description="Seats and student slots are released. Approvals are undone. Refused where reports or visits exist."
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => deleteApplications(selected)}
            >
              <Button danger icon={<DeleteOutlined />}>Delete ({selected.length})</Button>
            </Popconfirm>
          </>
        )}
      </Space>

      <Table
        rowKey="id"
        size="middle"
        loading={loading}
        dataSource={rows}
        columns={columns}
        scroll={{ x: 'max-content' }}
        rowSelection={{ selectedRowKeys: selected, onChange: setSelected }}
        pagination={{ current: page, pageSize: 20, total: meta.total, onChange: setPage, showSizeChanger: false, showTotal: (t) => `${t} application(s)` }}
      />

      <Modal
        open={!!decision}
        title={decision?.action === 'APPROVE' ? `Approve ${decision?.ids.length} application(s)` : `Reject ${decision?.ids.length} application(s)`}
        okText={decision?.action === 'APPROVE' ? 'Approve' : 'Reject'}
        okButtonProps={{ danger: decision?.action === 'REJECT' }}
        confirmLoading={submitting}
        onOk={submitDecision}
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
