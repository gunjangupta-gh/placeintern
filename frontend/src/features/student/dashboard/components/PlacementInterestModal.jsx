import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Alert, Spin, Result, theme } from 'antd';
import { SendOutlined, CheckCircleOutlined } from '@ant-design/icons';
import toast from 'react-hot-toast';
import PlacementInterestForm, { PLAN_AFTER_DIPLOMA } from './PlacementInterestForm';
import studentService from '../../../../services/student.service';

const PlacementInterestModal = ({ open, onClose, onSuccess, closable = false }) => {
  const { token } = theme.useToken();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingData, setExistingData] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [, forceUpdate] = useState({});

  useEffect(() => {
    if (open) {
      fetchPlacementInterest();
    }
  }, [open]);

  const fetchPlacementInterest = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await studentService.getPlacementInterest();
      if (response.isFilled && response.data) {
        setExistingData(response.data);
      }
    } catch (err) {
      if (err.response?.status !== 404) {
        setError('Failed to load form data.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      setError(null);

      const submitData = { planAfterDiploma: values.planAfterDiploma };
      if (values.planAfterDiploma === PLAN_AFTER_DIPLOMA.PRIVATE_JOB) {
        submitData.interestedForPrivateJob = values.interestedForPrivateJob;
        submitData.expectedSalary = values.expectedSalary;
      }

      if (existingData) {
        await studentService.updatePlacementInterest(submitData);
        toast.success('Updated successfully!');
      } else {
        await studentService.submitPlacementInterest(submitData);
        toast.success('Submitted successfully!');
      }

      setSubmitted(true);
      onSuccess?.();
    } catch (err) {
      if (err.errorFields) return;
      const errorMessage = err.response?.data?.message || 'Failed to submit.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (closable || submitted) {
      setSubmitted(false);
      setExistingData(null);
      form.resetFields();
      onClose?.();
    }
  };

  if (submitted) {
    return (
      <Modal open={open} onCancel={handleClose} footer={null} closable centered width={400}>
        <Result
          icon={<CheckCircleOutlined style={{ color: token.colorSuccess, fontSize: 48 }} />}
          title="Thank You!"
          subTitle="Your response has been recorded."
          extra={<Button type="primary" onClick={handleClose}>Done</Button>}
        />
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      closable={closable}
      maskClosable={closable}
      centered
      width={480}
      title="Placement Interest Form"
      styles={{
        body: {
          maxHeight: '60vh',
          overflowY: 'auto',
          paddingRight: 8,
        },
      }}
      footer={
        <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: token.colorBorder }}>
          {closable && <Button onClick={handleClose}>Cancel</Button>}
          <Button type="primary" loading={submitting} onClick={handleSubmit} icon={<SendOutlined />}>
            {existingData ? 'Update' : 'Submit'}
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="py-8 text-center">
          <Spin />
        </div>
      ) : (
        <>
          {!closable && !existingData && (
            <Alert
              message="Please complete this form to help us understand your career preferences."
              type="info"
              showIcon
              className="mb-4"
            />
          )}
          {error && (
            <Alert type="error" message={error} showIcon className="mb-4" closable onClose={() => setError(null)} />
          )}
          <PlacementInterestForm form={form} initialData={existingData} onValuesChange={() => forceUpdate({})} />
        </>
      )}
    </Modal>
  );
};

export default PlacementInterestModal;
