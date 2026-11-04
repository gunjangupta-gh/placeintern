import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Descriptions, Input, Modal, Table, Tag, Tooltip, Typography } from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { opportunityService, getErrorMessage, formatDate } from '../../../services/opportunity.service';
import { useDebounce } from '../../../hooks/useDebounce';
import { DEFAULT_PAGE_SIZE, tablePagination, serialColumn, statusLabel } from '../pagination';
import { formatStipend, textSorter, numberSorter, dateSorter, stipendSorter } from '../tableUtils';

const { Title, Text } = Typography;

const STATUS_COLOR = { APPLIED: 'blue', UNDER_REVIEW: 'blue', SHORTLISTED: 'cyan', SELECTED: 'green', APPROVED: 'green', REJECTED: 'red', JOINED: 'green', COMPLETED: 'default' };

/** Whole days left until the deadline (0 = closes today). Null if already past. */
const daysLeft = (deadline) => {
  const ms = new Date(deadline).getTime() - Date.now();
  return ms < 0 ? null : Math.ceil(ms / 86400000) - 1;
};

const deadlineText = (deadline) => {
  const left = daysLeft(deadline);
  if (left === null) return <Text type="danger">Closed</Text>;
  if (left === 0) return <Text type="danger">Closes today</Text>;
  if (left <= 3) return <Text type="danger">{formatDate(deadline)} ({left} day{left > 1 ? 's' : ''} left)</Text>;
  return formatDate(deadline);
};

const monthsText = (n) => `${n} ${n > 1 ? 'Months' : 'Month'}`;

/** Apply button; disabled (with the reasons as a tooltip) when the student cannot apply. */
const ApplyButton = ({ item, onClick }) => {
  if (item.applied) {
    return (
      <Tag color={STATUS_COLOR[item.applicationStatus] || 'blue'} icon={<CheckCircleFilled />} style={{ margin: 0 }}>
        {statusLabel(item.applicationStatus)}
      </Tag>
    );
  }
  const button = (
    <Button type="primary" size="small" disabled={!item.canApply} onClick={() => onClick(item)}>
      Apply
    </Button>
  );
  if (item.canApply) return button;
  const reasons = (item.reasons || []).map((r) => r.message);
  return <Tooltip title={<div>{reasons.map((m) => <div key={m}>• {m}</div>)}</div>}><span>{button}</span></Tooltip>;
};

/** Details of one internship, shown before the student confirms the application. */
const ApplyModal = ({ item, applying, limit, onCancel, onConfirm }) => (
  <Modal
    open={!!item}
    title={item ? `${item.title} at ${item.company?.name}` : ''}
    width={680}
    onCancel={onCancel}
    destroyOnHidden
    footer={[
      <Button key="cancel" onClick={onCancel}>Cancel</Button>,
      <Button key="apply" type="primary" loading={applying} disabled={!item?.canApply} onClick={() => onConfirm(item)}>
        Proceed to apply
      </Button>,
    ]}
  >
    {item && (
      <>
        <Descriptions size="small" bordered column={{ xs: 1, sm: 2 }} style={{ marginBottom: 12 }}>
          <Descriptions.Item label="Company">{item.company?.name}</Descriptions.Item>
          <Descriptions.Item label="Position">{item.title}</Descriptions.Item>
          <Descriptions.Item label="District">{item.district || '-'}</Descriptions.Item>
          <Descriptions.Item label="Stipend">{item.stipend ? formatStipend(item.stipend) : 'Not specified'}</Descriptions.Item>
          <Descriptions.Item label="Duration">{monthsText(item.durationMonths)}</Descriptions.Item>
          <Descriptions.Item label="Starts">{formatDate(item.startDate)}</Descriptions.Item>
          <Descriptions.Item label="Apply by">{formatDate(item.applicationDeadline)}</Descriptions.Item>
          <Descriptions.Item label="Positions left">{item.seatsLeft} of {item.positions} for your branch</Descriptions.Item>
        </Descriptions>

        <Text strong>Description</Text>
        <div style={{ maxHeight: 220, overflowY: 'auto', whiteSpace: 'pre-wrap', marginTop: 4, marginBottom: 12 }}>
          {item.description || <Text type="secondary">No description provided.</Text>}
        </div>

        {item.canApply ? (
          <Alert
            type="info"
            showIcon
            message={`You can apply to up to ${limit} internships. Applications are considered in the order received. If one is approved, your other pending application is withdrawn automatically.`}
          />
        ) : (
          !item.applied && (
            <Alert type="warning" showIcon message={(item.reasons || []).map((r) => r.message).join(' ')} />
          )
        )}
      </>
    )}
  </Modal>
);

const BrowseOpportunities = () => {
  const [state, setState] = useState({
    loading: true, data: [], meta: { total: 0 }, profile: null,
    applications: [], applicationLimit: 2, pendingApplications: 0, hasConfirmedInternship: false,
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null); // the internship shown in the apply modal
  const [applying, setApplying] = useState(false);
  const debounced = useDebounce(search, 300);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await opportunityService.listEligible({ page, limit: pageSize, search: debounced });
      setState({
        loading: false,
        data: res.data || [],
        meta: res.meta || { total: 0 },
        profile: res.profile,
        applications: res.applications || [],
        applicationLimit: res.applicationLimit ?? 2,
        pendingApplications: res.pendingApplications ?? 0,
        hasConfirmedInternship: !!res.hasConfirmedInternship,
      });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load internships'));
      setState((s) => ({ ...s, loading: false }));
    }
  }, [page, pageSize, debounced]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debounced]);

  const handleApply = async (item) => {
    setApplying(true);
    try {
      await opportunityService.apply(item.id);
      toast.success(`Applied to ${item.title} at ${item.company?.name}`);
      setSelected(null);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not submit application'));
      setSelected(null);
      await load(); // seats / eligibility may have changed
    } finally {
      setApplying(false);
    }
  };

  const { loading, data, meta, profile, applicationLimit, pendingApplications, hasConfirmedInternship } = state;

  const columns = [
    serialColumn(page, pageSize),
    {
      title: 'Company',
      dataIndex: ['company', 'name'],
      sorter: textSorter((r) => r.company?.name),
      render: (t, r) => <a onClick={() => setSelected(r)}>{t}</a>,
    },
    { title: 'District', dataIndex: 'district', sorter: textSorter((r) => r.district), render: (v) => v || '-' },
    { title: 'Stipend', dataIndex: 'stipend', sortDirections: ['descend', 'ascend'], sorter: stipendSorter((r) => r.stipend), render: (v) => (v ? formatStipend(v) : 'Not specified') },
    { title: 'Duration', dataIndex: 'durationMonths', sorter: numberSorter((r) => r.durationMonths), render: monthsText },
    { title: 'Starts', dataIndex: 'startDate', sorter: dateSorter((r) => r.startDate), render: formatDate },
    { title: 'Apply by', dataIndex: 'applicationDeadline', sorter: dateSorter((r) => r.applicationDeadline), render: deadlineText },
    {
      title: 'Positions left',
      sorter: numberSorter((r) => r.seatsLeft),
      render: (_, r) => (r.seatsLeft === 0 ? <Tag color="red" style={{ margin: 0 }}>Full</Tag> : `${r.seatsLeft} / ${r.positions}`),
    },
    { title: 'Action', render: (_, r) => <ApplyButton item={r} onClick={setSelected} /> },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Title level={3} style={{ marginBottom: 4 }}>Internship Opportunities</Title>

      {profile && !profile.complete && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="Complete your profile to apply"
          description={
            <span>
              Missing: {profile.missing.map((m) => m.label).join(', ')}. <Link to="/app/profile">Go to My Profile</Link>
            </span>
          }
        />
      )}
      {hasConfirmedInternship ? (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 12 }}
          message="You already have an internship, so you cannot apply for more."
          description={<Link to="/app/my-applications">View my internship</Link>}
        />
      ) : (
        pendingApplications > 0 && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message={`You have applied to ${pendingApplications} of ${applicationLimit} internships`}
            description={
              pendingApplications >= applicationLimit
                ? <>You have used all your applications. <Link to="/app/my-applications">View my applications</Link></>
                : <>You can apply to {applicationLimit - pendingApplications} more. <Link to="/app/my-applications">View my applications</Link></>
            }
          />
        )
      )}

      <Input.Search
        allowClear
        placeholder="Search by position, company or district"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ maxWidth: 420, marginBottom: 16 }}
      />

      <Table
        rowKey="id"
        size="middle"
        loading={loading}
        dataSource={data}
        columns={columns}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'No internships are open for your branch right now' }}
        pagination={tablePagination({ page, pageSize, total: meta.total, label: 'internships', onChange: (p, ps) => { setPage(p); setPageSize(ps); } })}
      />

      <ApplyModal
        item={selected}
        applying={applying}
        limit={applicationLimit}
        onCancel={() => setSelected(null)}
        onConfirm={handleApply}
      />
    </div>
  );
};

export default BrowseOpportunities;
