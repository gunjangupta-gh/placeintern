import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Modal, Form, Input, Select, DatePicker, Button, Row, Col, Divider, Spin, Switch } from 'antd';
import { toast } from 'react-hot-toast';
import { SaveOutlined } from '@ant-design/icons';
import { createPrincipal, updatePrincipal, fetchPrincipalById, clearCurrentPrincipal } from '../store/stateSlice';
import dayjs from 'dayjs';
import { useInstitutions } from '../../shared/hooks/useLookup';

const PrincipalModal = ({ open, onClose, principalId, onSuccess }) => {
  const isEdit = !!principalId;
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);

  const { currentPrincipal } = useSelector((state) => state.state);

  // Use global lookup data for institutions
  const { activeInstitutions, loading: institutionsLoading } = useInstitutions();

  useEffect(() => {
    if (open) {
      const loadData = async () => {
        setDataLoading(true);
        try {
          if (isEdit && principalId) {
            await dispatch(fetchPrincipalById(principalId));
          }
        } catch (error) {
          toast.error('Failed to load data');
        } finally {
          setDataLoading(false);
        }
      };

      loadData();
    }
  }, [dispatch, isEdit, principalId, open]);

  useEffect(() => {
    if (isEdit && currentPrincipal && open) {
      form.setFieldsValue({
        name: currentPrincipal.name,
        email: currentPrincipal.email,
        phone: currentPrincipal.phoneNo,
        dateOfBirth: currentPrincipal.dob ? dayjs(currentPrincipal.dob) : null,
        institutionId: currentPrincipal.Institution?.id || currentPrincipal.institutionId,
        designation: currentPrincipal.designation,
        isActive: currentPrincipal.active !== false,
      });
    } else if (!isEdit && open) {
      form.resetFields();
    }
  }, [isEdit, currentPrincipal, form, open]);

  const handleClose = () => {
    form.resetFields();
    dispatch(clearCurrentPrincipal());
    onClose();
  };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      if (isEdit) {
        // Update payload - exclude institutionId (can't change institution)
        const updatePayload = {
          name: values.name,
          email: values.email,
          phoneNo: values.phone,
          designation: values.designation || 'Principal',
          active: values.isActive !== false,
        };
        await dispatch(updatePrincipal({ id: principalId, data: updatePayload })).unwrap();
        toast.success('Principal updated successfully');
      } else {
        // Create payload - include institutionId and password
        const createPayload = {
          name: values.name,
          email: values.email,
          phoneNo: values.phone,
          institutionId: values.institutionId,
          designation: values.designation || 'Principal',
          active: values.isActive !== false,
          password: values.password || 'Principal@123',
        };
        await dispatch(createPrincipal(createPayload)).unwrap();
        toast.success('Principal created successfully');
      }

      handleClose();
      onSuccess?.();
    } catch (error) {
      toast.error(error?.message || `Failed to ${isEdit ? 'update' : 'create'} principal`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={isEdit ? 'Edit Principal' : 'Add New Principal'}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={800}
      destroyOnHidden
    >
      {dataLoading || institutionsLoading ? (
        <div className="py-12 text-center">
          <Spin size="large" />
        </div>
      ) : (
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Divider plain>Personal Information</Divider>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="name"
                label="Full Name"
                rules={[
                  { required: true, message: 'Please enter full name' },
                  { min: 3, message: 'Name must be at least 3 characters' }
                ]}
              >
                <Input placeholder="Enter full name" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Please enter email' },
                  { type: 'email', message: 'Please enter a valid email' }
                ]}
                extra={isEdit ? "Note: Changing email will affect login credentials" : null}
              >
                <Input placeholder="Enter email" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="phone"
                label="Phone Number"
                rules={[
                  { pattern: /^\+?[0-9]{10,15}$/, message: 'Please enter valid phone number (10-15 digits)' }
                ]}
              >
                <Input placeholder="Enter phone number" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="dateOfBirth"
                label="Date of Birth"
              >
                <DatePicker
                  style={{ width: '100%' }}
                  placeholder="Select date of birth"
                  disabledDate={(current) => current && current > dayjs().subtract(25, 'years')}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider plain>Professional Information</Divider>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="institutionId"
                label="Institution"
                rules={[{ required: true, message: 'Please select institution' }]}
              >
                <Select
                  placeholder="Select institution"
                  showSearch
                  allowClear
                  filterOption={(input, option) =>
                    (option?.children || '').toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {activeInstitutions?.map(inst => (
                    <Select.Option key={inst.id} value={inst.id}>
                      {inst.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="designation"
                label="Designation"
                initialValue="Principal"
              >
                <Input placeholder="Enter designation" />
              </Form.Item>
            </Col>
          </Row>

          {!isEdit && (
            <>
              <Divider plain>Account Credentials</Divider>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="password"
                    label="Password"
                    rules={[
                      { required: true, message: 'Please enter password' },
                      { min: 8, message: 'Password must be at least 8 characters' }
                    ]}
                    initialValue="Principal@123"
                  >
                    <Input.Password placeholder="Enter password" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          <Divider plain>Account Settings</Divider>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="isActive"
                label="Account Status"
                valuePropName="checked"
                initialValue={true}
              >
                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item className="mt-6 mb-0 text-right">
            <Button onClick={handleClose} style={{ marginRight: 8 }}>
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<SaveOutlined />}
            >
              {isEdit ? 'Update Principal' : 'Create Principal'}
            </Button>
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
};

export default PrincipalModal;
