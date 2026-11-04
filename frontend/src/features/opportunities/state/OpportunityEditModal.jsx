import React, { useEffect, useMemo, useState } from 'react';
import { Button, Col, DatePicker, Divider, Form, Input, InputNumber, Row, Select, Tooltip, Typography } from 'antd';
import { AppModal } from '../../../components/ui';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import { opportunityService, getErrorMessage } from '../../../services/opportunity.service';
import { lookupService } from '../../../services/lookup.service';
import { STIPEND_FORMAT_RE, STIPEND_FORMAT_MESSAGE, formatStipendInput, stipendToInput } from '../tableUtils';

const FIELD_KEYS = [
  'companyName', 'title', 'district', 'description', 'durationMonths', 'stipend',
  'startDate', 'applicationDeadline', 'status', 'branches',
  'contactName', 'contactPhone', 'contactEmail',
];

/** yyyy-mm-dd of an instant, as the calendar date in India (how the server stores dates). */
const istDate = (value) => (value ? dayjs(new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })) : null);

const toFormValues = (o) => ({
  companyName: o.company?.name || '',
  title: o.title || '',
  district: o.district || '',
  description: o.description || '',
  durationMonths: o.durationMonths,
  stipend: stipendToInput(o.stipend),
  startDate: istDate(o.startDate),
  applicationDeadline: istDate(o.applicationDeadline),
  status: o.status === 'FILLED' ? undefined : o.status,
  branches: (o.branches || []).map((b) => ({ branchId: b.id, positions: b.positions, maxApplications: b.maxApplications ?? null, stipend: stipendToInput(b.stipend) })),
  contactName: o.contactName || '',
  contactPhone: o.contactPhone || '',
  contactEmail: o.contactEmail || '',
});

/** Comparable form of a value, so unchanged fields are not sent. */
const normBranches = (list) =>
  JSON.stringify(
    (list || [])
      .map((b) => ({ branchId: b.branchId, positions: Number(b.positions), maxApplications: b.maxApplications ?? null, stipend: (b.stipend || '').trim() }))
      .sort((a, b) => String(a.branchId).localeCompare(String(b.branchId)))
  );

const norm = (key, v) => {
  if (key === 'branches') return normBranches(v);
  if (v && typeof v.format === 'function') return v.format('YYYY-MM-DD');
  if (Array.isArray(v)) return JSON.stringify([...v].sort());
  if (typeof v === 'string') return v.replace(/\s+/g, ' ').trim();
  return v ?? '';
};

/** Empty form for "Add opportunity". */
const CREATE_DEFAULTS = {
  companyName: '', title: '', district: '', description: '', durationMonths: undefined, stipend: '',
  startDate: null, applicationDeadline: null, status: 'OPEN',
  branches: [{ branchId: undefined, positions: 1, maxApplications: null, stipend: '' }],
  contactName: '', contactPhone: '', contactEmail: '',
};

const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;

/**
 * Add (no `opportunity` given) or edit an opportunity. Edit every field of an opportunity. Only the fields that changed are sent, so e.g. an
 * expired opportunity can be edited without having to touch (or re-validate) its deadline.
 */
const OpportunityEditModal = ({ opportunity, onClose, onSaved }) => {
  const isCreate = !opportunity;
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const watchedBranches = Form.useWatch('branches', form) || [];

  useEffect(() => {
    let cancelled = false;
    lookupService.getBranches()
      .then((res) => {
        // The endpoint returns { branches: [...], total }
        const list = Array.isArray(res) ? res : res?.branches || res?.data?.branches || res?.data || [];
        if (!cancelled) setBranches(list);
      })
      .catch((err) => {
        // The opportunity's own branches stay selectable, but say why the rest are missing
        toast.error(getErrorMessage(err, 'Could not load the branch list'));
      })
      .finally(() => { if (!cancelled) setBranchesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (opportunity) form.setFieldsValue(toFormValues(opportunity));
  }, [opportunity, form]);

  const branchOptions = useMemo(() => {
    const map = new Map(branches.map((b) => [b.id, `${b.code} – ${b.name}`]));
    (opportunity?.branches || []).forEach((b) => { if (!map.has(b.id)) map.set(b.id, `${b.code} – ${b.name}`); });
    return [...map].map(([value, label]) => ({ value, label }));
  }, [branches, opportunity]);

  const initial = isCreate ? CREATE_DEFAULTS : toFormValues(opportunity);
  // What each existing branch already has: selected students and applications received
  const branchStats = new Map((opportunity?.branches || []).map((b) => [b.id, b]));
  const totalPositions = watchedBranches.reduce((n, b) => n + (Number(b?.positions) || 0), 0);
  const totalLimit = watchedBranches.reduce((n, b) => n + (Number(b?.maxApplications) || Number(b?.positions) || 0), 0);

  const cleanBranches = (list) =>
    (list || []).map((b) => ({
      branchId: b.branchId,
      positions: Number(b.positions),
      maxApplications: b.maxApplications ? Number(b.maxApplications) : null,
      stipend: (b.stipend || '').trim() || null,
    }));

  const create = async () => {
    const values = await form.validateFields();
    const payload = { branches: cleanBranches(values.branches) };
    FIELD_KEYS.forEach((key) => {
      if (key === 'branches') return;
      const v = values[key];
      if (v && typeof v.format === 'function') payload[key] = v.format('YYYY-MM-DD');
      else if (typeof v === 'string') { if (v.trim()) payload[key] = v.trim(); }
      else if (Array.isArray(v)) { if (v.length) payload[key] = v; }
      else if (v !== undefined && v !== null) payload[key] = v;
    });
    setSaving(true);
    try {
      await opportunityService.create(payload);
      toast.success('Opportunity created');
      onSaved?.();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not create the opportunity'));
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (isCreate) return create();
    const values = await form.validateFields();
    const changed = {};
    FIELD_KEYS.forEach((key) => {
      if (key === 'status' && !values.status) return; // FILLED is automatic
      if (norm(key, values[key]) === norm(key, initial[key])) return;
      const v = values[key];
      if (v && typeof v.format === 'function') changed[key] = v.format('YYYY-MM-DD');
      else if (key === 'branches') {
        changed.branches = cleanBranches(v);
      } else if (typeof v === 'string') changed[key] = v.trim();
      else changed[key] = v;
    });

    if (Object.keys(changed).length === 0) {
      toast('Nothing was changed');
      onClose();
      return;
    }
    setSaving(true);
    try {
      await opportunityService.update(opportunity.id, changed);
      toast.success('Opportunity updated');
      onSaved?.();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Update failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal
      title={isCreate ? 'Add internship opportunity' : `Edit: ${opportunity.title}`}
      open
      width={900}
      okText={isCreate ? 'Create opportunity' : 'Save changes'}
      onOk={save}
      onCancel={onClose}
      confirmLoading={saving}
      maskClosable={false}
      destroyOnHidden
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto', paddingRight: 8 } }}
    >
      <Form form={form} layout="vertical" requiredMark="optional" initialValues={initial}>
        <Divider orientation="left" plain>Internship</Divider>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="companyName" label="Company" rules={[{ required: true, whitespace: true, message: 'Company is required' }, { max: 150 }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="title" label="Position title" rules={[{ required: true, whitespace: true, message: 'Position title is required' }, { max: 120 }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="district" label="District" rules={[{ max: 80 }]}><Input /></Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="stipend" label="Stipend (per month)" normalize={formatStipendInput} rules={[{ pattern: STIPEND_FORMAT_RE, message: STIPEND_FORMAT_MESSAGE }]}>
              <Input prefix="₹" inputMode="numeric" placeholder="e.g. 10,000" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="description" label="Description" rules={[{ max: 2000 }]}>
              <Input.TextArea rows={3} showCount maxLength={2000} />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left" plain>Schedule</Divider>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="durationMonths" label="Duration (months)" rules={[{ required: true, message: 'Required' }]}>
              <InputNumber min={1} max={24} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="status" label="Status">
              <Select
                disabled={opportunity?.status === 'FILLED'}
                placeholder="Filled"
                options={(isCreate ? ['OPEN', 'DRAFT'] : ['OPEN', 'CLOSED', 'DRAFT']).map((s) => ({ value: s, label: s }))}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="applicationDeadline"
              label="Application deadline"
              dependencies={['startDate']}
              rules={[
                { required: true, message: 'Required' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value) return Promise.resolve();
                    const unchanged = value.format('YYYY-MM-DD') === initial.applicationDeadline?.format('YYYY-MM-DD');
                    if (!unchanged && value.isBefore(dayjs(), 'day')) return Promise.reject(new Error('A changed deadline cannot be in the past'));
                    const start = getFieldValue('startDate');
                    if (start && !start.isAfter(value, 'day')) return Promise.reject(new Error('Must be before the start date'));
                    return Promise.resolve();
                  },
                }),
              ]}
            >
              <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="startDate" label="Start date" dependencies={['applicationDeadline']} rules={[{ required: true, message: 'Required' }]}>
              <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left" plain>Branch-wise positions and applications</Divider>
        <Form.List
          name="branches"
          rules={[{ validator: async (_, list) => { if (!list || list.length < 1) throw new Error('Add at least one branch'); } }]}
        >
          {(fields, { add, remove }, { errors }) => (
            <>
              <Row gutter={8} style={{ marginBottom: 4 }}>
                <Col xs={24} md={7}><Typography.Text type="secondary">Branch</Typography.Text></Col>
                <Col xs={12} md={4}><Typography.Text type="secondary">Positions</Typography.Text></Col>
                <Col xs={12} md={5}><Typography.Text type="secondary">Max applications</Typography.Text></Col>
                <Col xs={24} md={5}><Typography.Text type="secondary">Stipend (optional)</Typography.Text></Col>
              </Row>
              {fields.map(({ key, name }) => {
                const row = watchedBranches[name] || {};
                const stats = branchStats.get(row.branchId);
                const selected = stats?.approvedCount || 0;
                const received = stats?.appliedCount || 0;
                const chosenElsewhere = new Set(watchedBranches.filter((_, i) => i !== name).map((b) => b?.branchId));
                const locked = !!stats; // an existing branch cannot be swapped for another one
                const cannotRemove = received > 0 || selected > 0;
                return (
                  <Row key={key} gutter={8} align="top">
                    <Col xs={24} md={7}>
                      <Form.Item name={[name, 'branchId']} rules={[{ required: true, message: 'Select a branch' }]}>
                        <Select
                          showSearch
                          optionFilterProp="label"
                          disabled={locked}
                          loading={branchesLoading}
                          placeholder="Select branch"
                          options={branchOptions.filter((o) => !chosenElsewhere.has(o.value))}
                          notFoundContent={branchesLoading ? 'Loading branches...' : 'No branches found'}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={4}>
                      <Form.Item
                        name={[name, 'positions']}
                        rules={[{ required: true, message: 'Required' }]}
                        extra={selected > 0 ? `${selected} selected` : undefined}
                      >
                        <InputNumber min={Math.max(selected, 1)} max={500} precision={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={5}>
                      <Form.Item
                        name={[name, 'maxApplications']}
                        dependencies={[['branches', name, 'positions']]}
                        extra={received > 0 ? `${received} received` : undefined}
                        rules={[
                          ({ getFieldValue }) => ({
                            validator(_, value) {
                              const positions = Number(getFieldValue(['branches', name, 'positions'])) || 0;
                              if (value && value < positions) return Promise.reject(new Error(`At least ${positions} (the positions)`));
                              if (!value && received > positions) return Promise.reject(new Error(`Set at least ${received} (already received)`));
                              if (value && value < received) return Promise.reject(new Error(`At least ${received} (already received)`));
                              return Promise.resolve();
                            },
                          }),
                        ]}
                      >
                        <InputNumber min={1} max={2000} precision={0} placeholder="= positions" style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={5}>
                      <Form.Item name={[name, 'stipend']} normalize={formatStipendInput} rules={[{ pattern: STIPEND_FORMAT_RE, message: STIPEND_FORMAT_MESSAGE }]}>
                        <Input prefix="₹" inputMode="numeric" placeholder="= default stipend" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={3}>
                      <Tooltip title={cannotRemove ? 'Students of this branch have applied, so it cannot be removed' : 'Remove branch'}>
                        <Button type="text" danger aria-label="Remove branch" icon={<DeleteOutlined />} disabled={cannotRemove} onClick={() => remove(name)} />
                      </Tooltip>
                    </Col>
                  </Row>
                );
              })}
              <Form.ErrorList errors={errors} />
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => add({ branchId: undefined, positions: 1, maxApplications: null, stipend: '' })}
                disabled={fields.length >= branchOptions.length}
                style={{ marginBottom: 8 }}
              >
                Add branch
              </Button>
              <div style={{ marginBottom: 16 }}>
                <Typography.Text type="secondary">
                  Total: {totalPositions} position(s) · up to {totalLimit} application(s)
                </Typography.Text>
              </div>
            </>
          )}
        </Form.List>

        <Divider orientation="left" plain>Industry contact</Divider>
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item name="contactName" label="Contact name" rules={[{ max: 100 }]}><Input /></Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="contactPhone" label="Contact phone" rules={[{ pattern: PHONE_RE, message: 'Enter a valid phone number' }]}><Input /></Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="contactEmail" label="Contact email" rules={[{ type: 'email', message: 'Enter a valid email' }, { max: 100 }]}><Input /></Form.Item>
          </Col>
        </Row>
      </Form>
    </AppModal>
  );
};

export default OpportunityEditModal;
