import React, { useEffect, useMemo, useState } from 'react';
import { Col, DatePicker, Divider, Form, Input, InputNumber, Modal, Row, Select } from 'antd';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import { opportunityService, getErrorMessage } from '../../../services/opportunity.service';
import { lookupService } from '../../../services/lookup.service';

const FIELD_KEYS = [
  'companyName', 'title', 'district', 'description', 'positions', 'durationMonths', 'stipend',
  'startDate', 'applicationDeadline', 'status', 'eligibleYears', 'branchIds',
  'contactName', 'contactPhone', 'contactEmail',
];

/** yyyy-mm-dd of an instant, as the calendar date in India (how the server stores dates). */
const istDate = (value) => (value ? dayjs(new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })) : null);

const toFormValues = (o) => ({
  companyName: o.company?.name || '',
  title: o.title || '',
  district: o.district || '',
  description: o.description || '',
  positions: o.positions,
  durationMonths: o.durationMonths,
  stipend: o.stipend || '',
  startDate: istDate(o.startDate),
  applicationDeadline: istDate(o.applicationDeadline),
  status: o.status === 'FILLED' ? undefined : o.status,
  eligibleYears: o.eligibleYears || [],
  branchIds: (o.branches || []).map((b) => b.id),
  contactName: o.contactName || '',
  contactPhone: o.contactPhone || '',
  contactEmail: o.contactEmail || '',
});

/** Comparable form of a value, so unchanged fields are not sent. */
const norm = (key, v) => {
  if (v && typeof v.format === 'function') return v.format('YYYY-MM-DD');
  if (Array.isArray(v)) return JSON.stringify([...v].sort());
  if (typeof v === 'string') return v.replace(/\s+/g, ' ').trim();
  return v ?? '';
};

const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;

/**
 * Edit every field of an opportunity. Only the fields that changed are sent, so e.g. an
 * expired opportunity can be edited without having to touch (or re-validate) its deadline.
 */
const OpportunityEditModal = ({ opportunity, onClose, onSaved }) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(true);

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

  if (!opportunity) return null;
  const initial = toFormValues(opportunity);
  const hasApplicants = opportunity.appliedCount > 0;
  const minPositions = Math.max(opportunity.appliedCount || 0, opportunity.approvedCount || 0, 1);

  const save = async () => {
    const values = await form.validateFields();
    const changed = {};
    FIELD_KEYS.forEach((key) => {
      if (key === 'status' && !values.status) return; // FILLED is automatic
      if (norm(key, values[key]) === norm(key, initial[key])) return;
      const v = values[key];
      if (v && typeof v.format === 'function') changed[key] = v.format('YYYY-MM-DD');
      else if (typeof v === 'string') changed[key] = v.trim();
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
    <Modal
      title={`Edit: ${opportunity.title}`}
      open
      width={780}
      okText="Save changes"
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
            <Form.Item name="companyName" label="Company" rules={[{ required: true, whitespace: true, message: 'Company is required' }, { max: 150 }]}
              extra="An existing company is matched by name; a new name creates a new company.">
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
            <Form.Item name="stipend" label="Stipend" rules={[{ max: 50 }]}><Input placeholder="e.g. 8000 per month" /></Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="description" label="Description" rules={[{ max: 2000 }]}>
              <Input.TextArea rows={3} showCount maxLength={2000} />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left" plain>Seats and schedule</Divider>
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item name="positions" label="Positions" rules={[{ required: true, message: 'Required' }]}
              extra={hasApplicants || opportunity.approvedCount ? `At least ${minPositions} (current applications / selected).` : undefined}>
              <InputNumber min={minPositions} max={500} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="durationMonths" label="Duration (months)" rules={[{ required: true, message: 'Required' }]}>
              <InputNumber min={1} max={24} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="status" label="Status" extra={opportunity.status === 'FILLED' ? 'Filled automatically while all positions are taken.' : undefined}>
              <Select
                disabled={opportunity.status === 'FILLED'}
                placeholder="Filled"
                options={['OPEN', 'CLOSED', 'DRAFT'].map((s) => ({ value: s, label: s }))}
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

        <Divider orientation="left" plain>Who can apply</Divider>
        <Row gutter={16}>
          <Col xs={24} md={16}>
            <Form.Item
              name="branchIds"
              label="Eligible branches"
              rules={[{ required: true, type: 'array', min: 1, message: 'Select at least one branch' }]}
              extra={hasApplicants ? "Branches can be added. A branch can't be removed once its students have applied." : undefined}
            >
              <Select
                mode="multiple"
                showSearch
                optionFilterProp="label"
                options={branchOptions}
                loading={branchesLoading}
                placeholder="Select branches"
                maxTagCount="responsive"
                notFoundContent={branchesLoading ? 'Loading branches...' : 'No branches found'}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="eligibleYears" label="Eligible years" extra="Leave empty for all years.">
              <Select mode="multiple" placeholder="All years" options={[1, 2, 3].map((y) => ({ value: y, label: `Year ${y}` }))} />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left" plain>Industry contact (visible to State only)</Divider>
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
    </Modal>
  );
};

export default OpportunityEditModal;
