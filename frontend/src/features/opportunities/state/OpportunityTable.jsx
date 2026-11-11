import React, { useCallback, useEffect, useState } from 'react';
import { Input, Select, Space, Tag, Tooltip } from 'antd';
import { AppTable, StatusTag } from '../../../components/ui';
import { DeleteOutlined, EditOutlined, EyeOutlined, PauseCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { opportunityService, getErrorMessage, formatDate } from '../../../services/opportunity.service';
import { useDebounce } from '../../../hooks/useDebounce';
import OpportunityEditModal from './OpportunityEditModal';
import { usePersistedPagination, useResetPageOnChange, useServerSort, tablePagination, serialColumn } from '../pagination';
import { formatOpportunityStipend } from '../tableUtils';

const STATUS_COLOR = { OPEN: 'green', CLOSED: 'default', DRAFT: 'orange', FILLED: 'blue' };

const OpportunityTable = ({ refreshKey, onChanged }) => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const { page, pageSize, setPage, setPageSize } = usePersistedPagination('state-opportunities');
  const [status, setStatus] = useState();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const debounced = useDebounce(search, 300);
  const { sortBy, sortOrder, onSortChange, col } = useServerSort(setPage);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await opportunityService.list({ page, limit: pageSize, status, search: debounced, sortBy, sortOrder });
      // the last row of the last page was removed: step back instead of showing an empty page
      if (page > 1 && (res.data || []).length === 0 && res.meta?.total > 0) { setPage(page - 1); return; }
      setRows(res.data || []);
      setMeta(res.meta || { total: 0 });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load opportunities'));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, status, debounced, sortBy, sortOrder]);

  useEffect(() => { load(); }, [load, refreshKey]);
  useResetPageOnChange(setPage, [status, debounced]);

  const openEdit = (row) => setEditing(row);

  const toggle = async (row) => {
    try {
      await opportunityService.update(row.id, { status: row.status === 'OPEN' ? 'CLOSED' : 'OPEN' });
      load();
      onChanged?.();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Update failed'));
    }
  };

  const remove = async (row) => {
    try {
      await opportunityService.remove(row.id);
      toast.success('Opportunity deleted');
      load();
      onChanged?.();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Delete failed'));
    }
  };

  const columns = [
    serialColumn(page, pageSize),
    {
      title: 'Company',
      dataIndex: ['company', 'name'],
      ...col('company'),
      render: (t, r) => <a onClick={() => navigate(`/app/internship-opportunities/${r.id}`)}>{t}</a>,
    },
    { title: 'District', dataIndex: 'district', ...col('district') },
    {
      title: <Tooltip title="Shown per branch when branches have different stipends">Stipend</Tooltip>,
      sortDirections: ['descend', 'ascend'],
      ...col('stipend'),
      render: (_, r) => formatOpportunityStipend(r),
    },
    {
      title: (
        <Tooltip title="Branch: selected / positions. Hover a branch for its applications.">Branch-wise positions</Tooltip>
      ),
      dataIndex: 'branches',
      render: (b) =>
        b.map((x) => (
          <Tooltip
            key={x.id}
            title={`${x.name}: ${x.approvedCount} selected of ${x.positions} positions · ${x.appliedCount}/${x.applicationLimit} applications`}
          >
            <Tag color={x.seatsLeft === 0 ? 'red' : undefined}>{x.code} {x.approvedCount}/{x.positions}</Tag>
          </Tooltip>
        )),
    },
    {
      title: (
        <Tooltip title="Approved / Applied (holding a seat) / Total positions">Seats</Tooltip>
      ),
      ...col('seats'),
      render: (_, r) => `${r.approvedCount} / ${r.appliedCount} / ${r.positions}`,
    },
    { title: 'Deadline', dataIndex: 'applicationDeadline', ...col('deadline'), render: formatDate },
    { title: 'Status', dataIndex: 'status', ...col('status'), render: (s) => <StatusTag status={s} /> },
  ];

  const actions = [
    { key: 'view', label: 'View applicants and selected students', icon: <EyeOutlined />, onClick: (r) => navigate(`/app/internship-opportunities/${r.id}`) },
    { key: 'edit', label: 'Edit', icon: <EditOutlined />, onClick: openEdit },
    {
      key: 'toggle',
      label: (r) => (r.status === 'OPEN' ? 'Close applications' : 'Reopen applications'),
      icon: (r) => (r.status === 'OPEN' ? <PauseCircleOutlined /> : <PlayCircleOutlined />),
      hidden: (r) => r.status === 'FILLED',
      onClick: toggle,
    },
    { key: 'delete', label: 'Delete', icon: <DeleteOutlined />, danger: true, onClick: remove, confirm: { title: 'Delete this opportunity?', description: 'Not possible once students have applied.' } },
  ];

  return (
    <>
      <Space style={{ marginBottom: 12 }} wrap>
        <Input.Search allowClear placeholder="Search company, district" style={{ width: 300 }} value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select
          allowClear
          placeholder="Status"
          style={{ width: 140 }}
          value={status}
          onChange={setStatus}
          options={['OPEN', 'CLOSED', 'FILLED', 'DRAFT'].map((s) => ({ value: s, label: s }))}
        />
      </Space>
      <AppTable
        rowKey="id"
        size="middle"
        loading={loading}
        dataSource={rows}
        columns={columns}
        actions={actions}
        onChange={onSortChange}
        expandable={{
          expandedRowRender: (r) => (
            <div>
              <div><b>Industry contact (State only):</b> {[r.contactName, r.contactPhone, r.contactEmail].filter(Boolean).join(' · ') || 'Not provided'}</div>
              <div><b>Source institution / POC (State only):</b> {[r.institutionName, r.pocName, r.pocPhone].filter(Boolean).join(' · ') || 'Not provided'}</div>
              <div><b>Duration:</b> {r.durationMonths} months · <b>Starts:</b> {formatDate(r.startDate)} · <b>Stipend:</b> {formatOpportunityStipend(r)}</div>
              {r.description && <div><b>Description:</b> {r.description}</div>}
            </div>
          ),
        }}
        pagination={tablePagination({ page, pageSize, total: meta.total, label: 'opportunities', onChange: (p, ps) => { setPage(p); setPageSize(ps); } })}
      />

      {editing && (
        <OpportunityEditModal
          opportunity={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); onChanged?.(); }}
        />
      )}
    </>
  );
};

export default OpportunityTable;
