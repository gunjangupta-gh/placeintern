import React, { useCallback, useEffect, useState } from 'react';
import { Button, Input, Popconfirm, Select, Space, Table, Tag, Tooltip } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, PauseCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { opportunityService, getErrorMessage, formatDate } from '../../../services/opportunity.service';
import { useDebounce } from '../../../hooks/useDebounce';
import OpportunityEditModal from './OpportunityEditModal';
import { DEFAULT_PAGE_SIZE, tablePagination, serialColumn, statusLabel } from '../pagination';
import { formatStipend, textSorter, numberSorter, dateSorter, stipendSorter } from '../tableUtils';

const STATUS_COLOR = { OPEN: 'green', CLOSED: 'default', DRAFT: 'orange', FILLED: 'blue' };

const OpportunityTable = ({ refreshKey, onChanged }) => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [status, setStatus] = useState();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const debounced = useDebounce(search, 300);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await opportunityService.list({ page, limit: pageSize, status, search: debounced });
      // the last row of the last page was removed: step back instead of showing an empty page
      if (page > 1 && (res.data || []).length === 0 && res.meta?.total > 0) { setPage(page - 1); return; }
      setRows(res.data || []);
      setMeta(res.meta || { total: 0 });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load opportunities'));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, status, debounced]);

  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => { setPage(1); }, [status, debounced]);

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
      sorter: textSorter((r) => r.company?.name),
      render: (t, r) => <a onClick={() => navigate(`/app/internship-opportunities/${r.id}`)}>{t}</a>,
    },
    { title: 'District', dataIndex: 'district', sorter: textSorter((r) => r.district) },
    { title: 'Stipend', dataIndex: 'stipend', sortDirections: ['descend', 'ascend'], sorter: stipendSorter((r) => r.stipend), render: formatStipend },
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
      sorter: numberSorter((r) => r.positions),
      render: (_, r) => `${r.approvedCount} / ${r.appliedCount} / ${r.positions}`,
    },
    { title: 'Deadline', dataIndex: 'applicationDeadline', sorter: dateSorter((r) => r.applicationDeadline), render: formatDate },
    { title: 'Status', dataIndex: 'status', sorter: textSorter((r) => r.status), render: (s) => <Tag color={STATUS_COLOR[s]}>{statusLabel(s)}</Tag> },
    {
      title: 'Actions',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="View applicants and selected students">
            <Button size="small" type="text" aria-label="View" icon={<EyeOutlined />} onClick={() => navigate(`/app/internship-opportunities/${r.id}`)} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button size="small" type="text" aria-label="Edit" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          {r.status !== 'FILLED' && (
            <Tooltip title={r.status === 'OPEN' ? 'Close applications' : 'Reopen applications'}>
              <Button
                size="small"
                type="text"
                aria-label={r.status === 'OPEN' ? 'Close applications' : 'Reopen applications'}
                icon={r.status === 'OPEN' ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={() => toggle(r)}
              />
            </Tooltip>
          )}
          <Popconfirm title="Delete this opportunity?" description="Not possible once students have applied." onConfirm={() => remove(r)}>
            <Tooltip title="Delete">
              <Button size="small" type="text" danger aria-label="Delete" icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
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
      <Table
        rowKey="id"
        size="middle"
        loading={loading}
        dataSource={rows}
        columns={columns}
        scroll={{ x: 'max-content' }}
        expandable={{
          expandedRowRender: (r) => (
            <div>
              <div><b>Industry contact (State only):</b> {[r.contactName, r.contactPhone, r.contactEmail].filter(Boolean).join(' · ') || 'Not provided'}</div>
              <div><b>Duration:</b> {r.durationMonths} months · <b>Starts:</b> {formatDate(r.startDate)} · <b>Stipend:</b> {formatStipend(r.stipend)}</div>
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
