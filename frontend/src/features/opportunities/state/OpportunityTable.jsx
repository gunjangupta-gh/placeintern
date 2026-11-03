import React, { useCallback, useEffect, useState } from 'react';
import { Button, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import { opportunityService, getErrorMessage, formatDate } from '../../../services/opportunity.service';
import { useDebounce } from '../../../hooks/useDebounce';

const STATUS_COLOR = { OPEN: 'green', CLOSED: 'default', DRAFT: 'orange', FILLED: 'blue' };

const OpportunityTable = ({ refreshKey }) => {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
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

  const openEdit = (row) => {
    setEditing(row);
    form.setFieldsValue({
      positions: row.positions,
      stipend: row.stipend,
      status: row.status === 'FILLED' ? undefined : row.status,
      applicationDeadline: dayjs(row.applicationDeadline),
      startDate: dayjs(row.startDate),
    });
  };

  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      await opportunityService.update(editing.id, {
        positions: v.positions,
        stipend: v.stipend || undefined,
        ...(v.status ? { status: v.status } : {}),
        applicationDeadline: v.applicationDeadline.format('YYYY-MM-DD'),
        startDate: v.startDate.format('YYYY-MM-DD'),
      });
      toast.success('Opportunity updated');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Update failed'));
    } finally {
      setSaving(false);
    }
  };

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
    { title: 'Position', dataIndex: 'title' },
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
        <Space>
          <Button size="small" onClick={() => openEdit(r)}>Edit</Button>
          {r.status !== 'FILLED' && (
            <Button size="small" onClick={() => toggle(r)}>{r.status === 'OPEN' ? 'Close' : 'Reopen'}</Button>
          )}
          <Popconfirm title="Delete this opportunity?" description="Not possible once students have applied." onConfirm={() => remove(r)}>
            <Button size="small" danger>Delete</Button>
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

      <Modal title="Edit opportunity" open={!!editing} onCancel={() => setEditing(null)} onOk={save} confirmLoading={saving} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="positions" label="Number of positions" rules={[{ required: true }]} extra={editing ? `Cannot go below current applications/approvals (${editing.appliedCount}).` : null}>
            <InputNumber min={1} max={500} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="applicationDeadline" label="Application deadline" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
          </Form.Item>
          <Form.Item name="startDate" label="Start date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
          </Form.Item>
          <Form.Item name="stipend" label="Stipend"><Input maxLength={50} /></Form.Item>
          <Form.Item name="status" label="Status">
            <Select options={['OPEN', 'CLOSED', 'DRAFT'].map((s) => ({ value: s, label: s }))} placeholder="Auto (filled when positions are taken)" allowClear />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default OpportunityTable;
