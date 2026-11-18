import React, { useEffect, useMemo, useState } from 'react';
import { Button, DatePicker, Divider, Form, Input, Typography } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import { useDispatch } from 'react-redux';
import { AppModal } from '../../../components/ui';
import InternshipCompensationFields from '../../../components/common/InternshipCompensationFields';
import { compensationFormValues, compensationPayload } from '../../../utils/internshipCompensation';
import { updateInternship } from '../store/facultySlice';

const { Text } = Typography;

const durationText = (start, end) => {
  if (!start || !end) return '';
  const s = dayjs(start);
  const e = dayjs(end);
  if (!s.isValid() || !e.isValid() || e.isBefore(s)) return '';
  const months = e.diff(s, 'month');
  const days = e.diff(s.add(months, 'month'), 'day');
  if (months > 0 && days > 0) return `${months} months ${days} days`;
  if (months > 0) return `${months} month${months > 1 ? 's' : ''}`;
  const total = e.diff(s, 'day');
  return `${total} day${total > 1 ? 's' : ''}`;
};

/**
 * Edit an assigned student's internship (company, HR contact, dates, internship type + stipend / fee).
 * Same fields and same API as the Edit button inside the dashboard's student details modal.
 */
const EditStudentInternshipModal = ({ open, application, onClose, onSaved }) => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const startDate = Form.useWatch('startDate', form);
  const endDate = Form.useWatch('endDate', form);

  // The Form is re-mounted on every open (destroyOnHidden), so initialValues are applied fresh each time
  const initialValues = useMemo(
    () => ({
      companyName: application?.companyName,
      jobProfile: application?.jobProfile,
      companyAddress: application?.companyAddress,
      companyContact: application?.companyContact,
      companyEmail: application?.companyEmail,
      hrName: application?.hrName,
      hrDesignation: application?.hrDesignation,
      hrContact: application?.hrContact,
      hrEmail: application?.hrEmail,
      startDate: application?.startDate ? dayjs(application.startDate) : null,
      endDate: application?.endDate ? dayjs(application.endDate) : null,
      internshipDuration: application?.internshipDuration,
      ...compensationFormValues(application),
    }),
    [application],
  );

  // Duration follows the dates
  useEffect(() => {
    if (open && startDate && endDate) form.setFieldValue('internshipDuration', durationText(startDate, endDate));
  }, [open, startDate, endDate, form]);

  const handleSave = async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return; // antd shows the field errors
    }
    if (!application?.id) {
      toast.error('No internship found. Cannot save changes.');
      return;
    }
    setSaving(true);
    try {
      await dispatch(
        updateInternship({
          internshipId: application.id,
          data: {
            companyName: values.companyName,
            companyAddress: values.companyAddress,
            companyContact: values.companyContact,
            companyEmail: values.companyEmail,
            hrName: values.hrName,
            hrDesignation: values.hrDesignation,
            hrContact: values.hrContact,
            hrEmail: values.hrEmail,
            startDate: values.startDate?.toISOString(),
            endDate: values.endDate?.toISOString(),
            jobProfile: values.jobProfile,
            location: values.companyAddress,
            ...compensationPayload(values),
          },
        }),
      ).unwrap();
      toast.success('Internship updated successfully');
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(typeof error === 'string' ? error : error?.message || 'Failed to update internship');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal
      open={open}
      onCancel={onClose}
      title={
        <span>
          <EditOutlined className="mr-2" />
          Edit Internship
        </span>
      }
      width={720}
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button key="save" type="primary" loading={saving} onClick={handleSave}>
          Save Changes
        </Button>,
      ]}
    >
      <Form form={form} initialValues={initialValues} layout="vertical" size="small" className="max-h-[65vh] overflow-y-auto pr-2" requiredMark="optional">
        <Text strong className="text-xs block mb-2">Company Information</Text>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
          <Form.Item name="companyName" label="Company Name" rules={[{ required: true, message: 'Enter company name' }]} className="mb-2">
            <Input placeholder="Enter company name" />
          </Form.Item>
          <Form.Item name="jobProfile" label="Job Profile / Role" className="mb-2">
            <Input placeholder="e.g., Software Developer Intern" />
          </Form.Item>
          <Form.Item name="companyAddress" label="Company Address" className="mb-2 sm:col-span-2">
            <Input placeholder="Enter company address" />
          </Form.Item>
          <Form.Item name="companyContact" label="Company Phone" className="mb-2">
            <Input placeholder="e.g., +91 9876543210" />
          </Form.Item>
          <Form.Item name="companyEmail" label="Company Email" rules={[{ type: 'email', message: 'Enter a valid email' }]} className="mb-2">
            <Input placeholder="e.g., hr@company.com" />
          </Form.Item>
        </div>

        <Divider className="my-3" />
        <Text strong className="text-xs block mb-2">HR / Supervisor Details</Text>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
          <Form.Item name="hrName" label="HR / Supervisor Name" className="mb-2">
            <Input placeholder="Enter HR name" />
          </Form.Item>
          <Form.Item name="hrDesignation" label="Designation" className="mb-2">
            <Input placeholder="e.g., HR Manager" />
          </Form.Item>
          <Form.Item name="hrContact" label="Contact Number" className="mb-2">
            <Input placeholder="e.g., +91 9876543210" />
          </Form.Item>
          <Form.Item name="hrEmail" label="Email Address" rules={[{ type: 'email', message: 'Enter a valid email' }]} className="mb-2">
            <Input placeholder="e.g., hr@company.com" />
          </Form.Item>
        </div>

        <Divider className="my-3" />
        <Text strong className="text-xs block mb-2">Internship Duration & Compensation</Text>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
          <Form.Item name="startDate" label="Start Date" rules={[{ required: true, message: 'Select start date' }]} className="mb-2">
            <DatePicker className="w-full" format="DD MMM YYYY" />
          </Form.Item>
          <Form.Item name="endDate" label="End Date" rules={[{ required: true, message: 'Select end date' }]} className="mb-2">
            <DatePicker className="w-full" format="DD MMM YYYY" />
          </Form.Item>
          <InternshipCompensationFields form={form} compact />
          <Form.Item name="internshipDuration" label="Duration (auto-calculated)" className="mb-2">
            <Input disabled placeholder="Select start & end dates" />
          </Form.Item>
        </div>
      </Form>
    </AppModal>
  );
};

export default EditStudentInternshipModal;
