import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Input, Select, Space, Tabs, Tag, Typography } from 'antd';
import { AppTable, AppModal } from '../../../components/ui';
import { RollbackOutlined } from '@ant-design/icons';
import { useSelector } from 'react-redux';
import { toast } from 'react-hot-toast';
import { opportunityService, getErrorMessage, formatDate, formatTime } from '../../../services/opportunity.service';
import { useDebounce } from '../../../hooks/useDebounce';
import { usePersistedPagination, useResetPageOnChange, useServerSort, tablePagination, serialColumn, statusLabel } from '../pagination';
import { formatMyBranchStipend } from '../tableUtils';

const { Title, Paragraph, Text } = Typography;
const PENDING = ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED'];
const STATUS_COLOR = { APPLIED: 'blue', UNDER_REVIEW: 'blue', SHORTLISTED: 'cyan', APPROVED: 'green', JOINED: 'green', SELECTED: 'green', COMPLETED: 'default', REJECTED: 'red', OPEN: 'green', FILLED: 'blue' };

const OPPORTUNITY_STATUS_OPTIONS = ['OPEN', 'FILLED'].map((s) => ({ value: s, label: statusLabel(s) }));
const APPLICATION_STATUS_OPTIONS = ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'APPROVED', 'SELECTED', 'JOINED', 'COMPLETED', 'REJECTED', 'WITHDRAWN'].map((s) => ({ value: s, label: statusLabel(s) }));

/** Generic paginated, searchable, read-only table. */
const DataTab = ({ fetcher, columns, searchPlaceholder, rowKey = 'id', reloadKey = 0, statusOptions }) => {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const { page, pageSize, setPage, setPageSize } = usePersistedPagination('institution');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState();
  const debounced = useDebounce(search, 300);
  const { sortBy, sortOrder, onSortChange, col } = useServerSort(setPage);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetcher({ page, limit: pageSize, search: debounced, status, sortBy, sortOrder });
      if (page > 1 && (res.data || []).length === 0 && res.meta?.total > 0) { setPage(page - 1); return; }
      setRows(res.data || []);
      setMeta(res.meta || { total: 0 });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  }, [fetcher, page, pageSize, debounced, status, sortBy, sortOrder]);

  useEffect(() => { load(); }, [load, reloadKey]);
  useResetPageOnChange(setPage, [debounced, status]);

  return (
    <>
      <Space style={{ marginBottom: 12 }} wrap>
        <Input.Search allowClear placeholder={searchPlaceholder} style={{ width: 300 }} value={search} onChange={(e) => setSearch(e.target.value)} />
        {statusOptions && (
          <Select allowClear placeholder="Status" style={{ width: 170 }} value={status} onChange={setStatus} options={statusOptions} />
        )}
      </Space>
      <AppTable
        rowKey={rowKey}
        size="middle"
        loading={loading}
        dataSource={rows}
        columns={[serialColumn(page, pageSize), ...columns(col)]}
        onChange={onSortChange}
        scroll={{ x: 'max-content' }}
        pagination={tablePagination({ page, pageSize, total: meta.total, onChange: (p, ps) => { setPage(p); setPageSize(ps); } })}
      />
    </>
  );
};

const InstitutionOpportunities = () => {
  const role = useSelector((s) => s.auth.user?.role);
  const isPrincipal = role === 'PRINCIPAL';
  const base = isPrincipal ? 'principal' : 'faculty';
  const scopeText = isPrincipal ? 'students of your institution' : 'your assigned mentees';

  const fetchOpportunities = useCallback((p) => opportunityService.institutionList(base, p), [base]);
  const fetchApplications = useCallback((p) => opportunityService.institutionApplications(base, p), [base]);
  // Faculty mentor only: withdraw a mentee's pending application
  const [withdrawing, setWithdrawing] = useState(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const confirmWithdraw = async () => {
    setSubmitting(true);
    try {
      await opportunityService.withdrawMenteeApplication(withdrawing.id, reason.trim());
      toast.success('Application withdrawn. The student can no longer be considered for it.');
      setWithdrawing(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not withdraw the application'));
    } finally {
      setSubmitting(false);
    }
  };

  const fetchIncomplete = useCallback((p) => opportunityService.institutionIncompleteProfiles(base, p), [base]);

  const opportunityColumns = (col) => [
    { title: 'Company', dataIndex: ['company', 'name'], ...col('company') },
    { title: 'District', dataIndex: 'district', ...col('district') },
    {
      title: 'Stipend (your branch)',
      sortDirections: ['descend', 'ascend'],
      ...col('stipend'),
      render: (_, r) => formatMyBranchStipend(r),
    },
    { title: 'Branches', dataIndex: 'branches', render: (b) => b.map((x) => <Tag key={x.id} color={x.approvedCount >= x.positions ? 'red' : undefined}>{x.code} {x.approvedCount}/{x.positions}</Tag>) },
    { title: 'Seats left', ...col('seatsLeft'), render: (_, r) => `${r.seatsLeft} of ${r.positions}` },
    { title: 'Deadline', dataIndex: 'applicationDeadline', ...col('deadline'), render: formatDate },
    { title: 'Status', dataIndex: 'status', ...col('status'), render: (s) => <Tag color={STATUS_COLOR[s]}>{statusLabel(s)}</Tag> },
  ];

  const applicationColumns = (col) => [
    { title: 'Student', ...col('student'), render: (_, r) => <div><div>{r.student?.user?.name}</div><Text type="secondary" style={{ fontSize: 12 }}>{r.student?.user?.rollNumber}</Text></div> },
    { title: 'Branch', dataIndex: ['student', 'branch', 'name'], ...col('branch') },
    { title: 'Position', ...col('position'), render: (_, r) => <div><div>{r.opportunity?.title}</div><Text type="secondary" style={{ fontSize: 12 }}>{r.opportunity?.company?.name}</Text></div> },
    { title: 'Applied at', dataIndex: 'appliedDate', ...col('appliedDate'), render: (v) => <div style={{ whiteSpace: 'nowrap' }}><div>{formatDate(v)}</div><Text type="secondary" style={{ fontSize: 12 }}>{formatTime(v)}</Text></div> },
    { title: 'Status', dataIndex: 'status', ...col('status'), render: (s) => <Tag color={STATUS_COLOR[s]}>{statusLabel(s)}</Tag> },
    ...(isPrincipal
      ? []
      : [{
          title: 'Action',
          render: (_, r) =>
            PENDING.includes(r.status) ? (
              <Button size="small" danger icon={<RollbackOutlined />} onClick={() => { setReason(''); setWithdrawing(r); }}>
                Withdraw
              </Button>
            ) : null,
        }]),
  ];

  const incompleteColumns = (col) => [
    { title: 'Student', ...col('student'), render: (_, r) => <div><div>{r.name}</div><Text type="secondary" style={{ fontSize: 12 }}>{r.rollNumber}</Text></div> },
    { title: 'Branch', dataIndex: ['branch', 'name'], ...col('branch') },
    { title: 'Year', dataIndex: 'currentYear', ...col('year') },
    { title: 'Missing profile fields', dataIndex: 'missing', render: (m) => m.map((f) => <Tag key={f.key} color="orange">{f.label}</Tag>) },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Title level={3} style={{ marginBottom: 4 }}>Internship Opportunities</Title>
      <Paragraph type="secondary">Read-only view of published internships and applications by {scopeText}.</Paragraph>
      <Tabs
        destroyOnHidden
        items={[
          { key: 'opportunities', label: 'Opportunities', children: <DataTab fetcher={fetchOpportunities} columns={opportunityColumns} searchPlaceholder="Search company or district" statusOptions={OPPORTUNITY_STATUS_OPTIONS} /> },
          { key: 'applications', label: 'Applications', children: <DataTab fetcher={fetchApplications} columns={applicationColumns} searchPlaceholder="Search student name or roll no." reloadKey={reloadKey} statusOptions={APPLICATION_STATUS_OPTIONS} /> },
          {
            key: 'incomplete',
            label: 'Incomplete profiles',
            children: (
              <>
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message="These students cannot apply for internships until their profile is complete. Please ask them to update My Profile."
                />
                <DataTab fetcher={fetchIncomplete} columns={incompleteColumns} rowKey="studentId" searchPlaceholder="Search student name or roll no." />
              </>
            ),
          },
        ]}
      />
      <AppModal
        open={!!withdrawing}
        title="Withdraw this application?"
        okText="Withdraw"
        okButtonProps={{ danger: true }}
        confirmLoading={submitting}
        onOk={confirmWithdraw}
        onCancel={() => setWithdrawing(null)}
        destroyOnHidden
      >
        <p>
          {withdrawing?.student?.user?.name} will be withdrawn from {withdrawing?.opportunity?.title}
          {withdrawing?.opportunity?.company?.name ? ` at ${withdrawing.opportunity.company.name}` : ''}.
          The seat is released and the student's application slot is freed, but they cannot apply to this same internship again.
          Only pending applications can be withdrawn.
        </p>
        <Input.TextArea rows={3} maxLength={500} showCount value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" />
      </AppModal>
    </div>
  );
};

export default InstitutionOpportunities;
