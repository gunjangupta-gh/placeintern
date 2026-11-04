import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Dropdown, Input, Modal, Popconfirm, Segmented, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { CheckOutlined, CloseOutlined, DeleteOutlined, DownloadOutlined, DownOutlined, WarningOutlined } from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import { opportunityService, getErrorMessage, formatDate, formatTime } from '../../../services/opportunity.service';
import { useDebounce } from '../../../hooks/useDebounce';
import { DEFAULT_PAGE_SIZE, tablePagination, serialColumn, statusLabel } from '../pagination';

const { Text } = Typography;
const PENDING = ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED'];
const CONFIRMED = ['SELECTED', 'APPROVED', 'JOINED', 'COMPLETED'];
const STATUS_COLOR = { APPLIED: 'blue', UNDER_REVIEW: 'blue', SHORTLISTED: 'cyan', APPROVED: 'green', JOINED: 'green', SELECTED: 'green', COMPLETED: 'default', REJECTED: 'red', WITHDRAWN: 'default' };
// Non-final statuses the director can move a pending application to
const MARK_OPTIONS = [
  { key: 'UNDER_REVIEW', label: 'Under review' },
  { key: 'SHORTLISTED', label: 'Shortlisted' },
];
const GROUP_OPTIONS = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Selected', value: 'SELECTED' },
  { label: 'Rejected / Withdrawn', value: 'CLOSED' },
];

/** Queue position: 1 = applied first among the students of the same branch for this internship. */
const QueueTag = ({ r }) => {
  if (!r.queue) return <Text type="secondary">-</Text>;
  const { rank, pendingAhead } = r.queue;
  const waiting = PENDING.includes(r.status);
  if (waiting && pendingAhead === 0) {
    return <Tooltip title="Applied before every other waiting student of this branch"><Tag color="green" style={{ margin: 0 }}>#{rank}</Tag></Tooltip>;
  }
  if (waiting) {
    return (
      <Tooltip title={`${pendingAhead} earlier applicant(s) of this branch are still waiting for a decision`}>
        <Tag color="orange" style={{ margin: 0 }}>#{rank}</Tag>
      </Tooltip>
    );
  }
  return <Tag style={{ margin: 0 }}>#{rank}</Tag>;
};

/**
 * Applications made against State-published opportunities.
 * Listed in the order students applied (first come, first served); the exact time is shown
 * and "Priority" is each student's place in the queue of their own branch.
 *  - opportunityId: limit to one opportunity (used on the opportunity page)
 *  - fixedGroup:    lock the list to PENDING | SELECTED | CLOSED and hide the group switch
 * The group filter drives both the table and the Excel export, so they always match.
 */
const ApplicationsReview = ({ refreshKey, onChanged, opportunityId, fixedGroup }) => {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
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
      const res = await opportunityService.listApplications({ ...filters(), page, limit: pageSize });
      // the last row of the last page was removed: step back instead of showing an empty page
      if (page > 1 && (res.data || []).length === 0 && res.meta?.total > 0) { setPage(page - 1); return; }
      setRows(res.data || []);
      setMeta(res.meta || { total: 0 });
      setSelected([]);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load applications'));
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

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
    const verb = { APPROVE: 'approved', REJECT: 'rejected', DELETE: 'deleted', UNDER_REVIEW: 'marked as under review', SHORTLISTED: 'marked as shortlisted' }[action];
    if (res.succeeded) toast.success(`${res.succeeded} application(s) ${verb}`);
    res.results.filter((r) => !r.ok).forEach((r) => toast.error(String(r.error)));
    const skipped = res.results.filter((r) => r.ok && r.skippedEarlier > 0).length;
    if (skipped) {
      toast(`${skipped} approved student(s) applied after other students of their branch who are still waiting.`, { icon: '⚠️', duration: 6000 });
    }
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

  const markApplications = async (status, ids) => {
    try {
      await runBulk(status, ids);
      await done();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Action failed'));
    }
  };

  const markMenu = (ids, current) => ({
    items: MARK_OPTIONS.filter((o) => o.key !== current),
    onClick: ({ key }) => markApplications(key, ids),
  });

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

  const earlierWaiting = (r) => r.queue?.pendingAhead || 0;
  const decisionRows = rows.filter((r) => decision?.ids.includes(r.id));
  const jumpsQueue = decision?.action === 'APPROVE' && decisionRows.some((r) => earlierWaiting(r) > 0);

  const columns = [
    serialColumn(page, pageSize),
    {
      title: (
        <Tooltip title="Place in the queue of the student's own branch for this internship. #1 applied first and has priority.">
          Priority
        </Tooltip>
      ),
      width: 100,
      render: (_, r) => <QueueTag r={r} />,
    },
    {
      title: 'Applied at',
      dataIndex: 'appliedDate',
      render: (v) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          <div>{formatDate(v)}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{formatTime(v)}</Text>
        </div>
      ),
    },
    { title: 'Institution', dataIndex: ['student', 'Institution', 'name'] },
    { title: 'Student', render: (_, r) => <div><div>{r.student?.user?.name}</div><Text type="secondary" style={{ fontSize: 12 }}>{r.student?.user?.rollNumber}</Text></div> },
    ...(scoped
      ? [{ title: 'Contact', render: (_, r) => <div style={{ fontSize: 12 }}><div>{r.student?.user?.phoneNo}</div><Text type="secondary" style={{ fontSize: 12 }}>{r.student?.user?.email}</Text></div> }]
      : []),
    {
      title: 'Branch',
      render: (_, r) => (
        <div>
          <div>{r.student?.branch?.name}</div>
          {r.branchSeat && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {r.branchSeat.approvedCount}/{r.branchSeat.positions} selected
            </Text>
          )}
        </div>
      ),
    },
    ...(scoped
      ? []
      : [
          { title: 'Position', render: (_, r) => <div><div>{r.opportunity?.title}</div><Text type="secondary" style={{ fontSize: 12 }}>{r.opportunity?.company?.name}</Text></div> },
        ]),
    { title: 'Status', dataIndex: 'status', render: (s) => <Tag color={STATUS_COLOR[s]}>{statusLabel(s)}</Tag> },
    {
      title: 'Actions',
      render: (_, r) => (
        <Space size={4}>
          {PENDING.includes(r.status) && (
            <>
              <Tooltip title={earlierWaiting(r) > 0 ? `Approve (${earlierWaiting(r)} earlier applicant(s) of this branch are still waiting)` : 'Approve'}>
                <Button
                  size="small"
                  type="text"
                  aria-label="Approve"
                  style={{ color: earlierWaiting(r) > 0 ? '#fa8c16' : '#52c41a' }}
                  icon={earlierWaiting(r) > 0 ? <WarningOutlined /> : <CheckOutlined />}
                  onClick={() => openDecision('APPROVE', [r.id])}
                />
              </Tooltip>
              <Tooltip title="Reject">
                <Button size="small" type="text" danger aria-label="Reject" icon={<CloseOutlined />} onClick={() => openDecision('REJECT', [r.id])} />
              </Tooltip>
              <Dropdown menu={markMenu([r.id], r.status)} trigger={['click']}>
                <Button size="small" type="text" aria-label="Mark as">Mark as <DownOutlined /></Button>
              </Dropdown>
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
            <Dropdown menu={markMenu(selectedPending)} trigger={['click']} disabled={!selectedPending.length}>
              <Button disabled={!selectedPending.length}>Mark as ({selectedPending.length}) <DownOutlined /></Button>
            </Dropdown>
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
        pagination={tablePagination({ page, pageSize, total: meta.total, label: 'applications', onChange: (p, ps) => { setPage(p); setPageSize(ps); } })}
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
          <p>Confirm the student(s) have got this internship. Their internship starts on the opportunity's start date and enters the normal mentor, report and visit workflow. Any other pending application they have is withdrawn automatically. Positions are per branch; when several students are approved together, the one who applied first gets the seat first.</p>
        )}
        {jumpsQueue && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message="Earlier applicants are still waiting"
            description="At least one selected student applied after other students of the same branch who have not been decided yet. Seats are first come, first served, so approve in application order unless you have a reason not to."
          />
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
