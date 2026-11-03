import React, { useCallback, useEffect, useState } from 'react';
import { Button, Input, Popconfirm, Select, Space, Table, Tag, Tooltip } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, PauseCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { opportunityService, getErrorMessage, formatDate } from '../../../services/opportunity.service';
import { useDebounce } from '../../../hooks/useDebounce';
import OpportunityEditModal from './OpportunityEditModal';

const STATUS_COLOR = { OPEN: 'green', CLOSED: 'default', DRAFT: 'orange', FILLED: 'blue' };

const OpportunityTable = ({ refreshKey }) => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const debounced = useDebounce(search, 300);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await opportunityService.list({ page, limit: 20, status, search: debounced });
      setRows(res.data || []);
      setMeta(res.meta || { total: 0 });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load opportunities'));
    } finally {
      setLoading(false);
    }
  }, [page, status, debounced]);

  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => { setPage(1); }, [status, debounced]);

  const openEdit = (row) => setEditing(row);

  const toggle = async (row) => {
    try {
      await opportunityService.update(row.id, { status: row.status === 'OPEN' ? 'CLOSED' : 'OPEN' });
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Update failed'));
    }
  };

  const remove = async (row) => {
    try {
      await opportunityService.remove(row.id);
      toast.success('Opportunity deleted');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Delete failed'));
    }
  };

  const columns = [
    { title: 'Company', dataIndex: ['company', 'name'] },
    {
      title: 'Position',
      dataIndex: 'title',
      render: (t, r) => <a onClick={() => navigate(`/app/internship-opportunities/${r.id}`)}>{t}</a>,
    },
    { title: 'District', dataIndex: 'district' },
    {
      title: 'Branches',
      dataIndex: 'branches',
      render: (b) => b.map((x) => <Tag key={x.id}>{x.code}</Tag>),
    },
    {
      title: (
        <Tooltip title="Approved / Applied (holding a seat) / Total positions">Seats</Tooltip>
      ),
      render: (_, r) => `${r.approvedCount} / ${r.appliedCount} / ${r.positions}`,
    },
    { title: 'Deadline', dataIndex: 'applicationDeadline', render: formatDate },
    { title: 'Status', dataIndex: 'status', render: (s) => <Tag color={STATUS_COLOR[s]}>{s}</Tag> },
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
        <Input.Search allowClear placeholder="Search company, position, district" style={{ width: 300 }} value={search} onChange={(e) => setSearch(e.target.value)} />
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
              <div><b>Duration:</b> {r.durationMonths} months · <b>Starts:</b> {formatDate(r.startDate)} · <b>Stipend:</b> {r.stipend || '-'}</div>
              {r.description && <div><b>Description:</b> {r.description}</div>}
            </div>
          ),
        }}
        pagination={{ current: page, pageSize: 20, total: meta.total, onChange: setPage, showSizeChanger: false }}
      />

      {editing && (
        <OpportunityEditModal
          opportunity={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </>
  );
};

export default OpportunityTable;
