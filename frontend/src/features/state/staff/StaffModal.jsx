import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Modal, Form, Input, Button, Select, Switch, Spin, Row, Col, Divider } from 'antd';
import { toast } from 'react-hot-toast';
import { SaveOutlined } from '@ant-design/icons';
import { createStaff, updateStaff } from '../store/stateSlice';
import stateService from '../../../services/state.service';
import { useLookup } from '../../shared/hooks/useLookup';

const StaffModal = ({ open, onClose, staffId, onSuccess }) => {
  const dispatch = useDispatch();
  const isEditMode = !!staffId;

  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);

  // Use global lookup data
  const { activeInstitutions, activeBranches, isLoading: lookupLoading } = useLookup({
    include: ['institutions', 'branches']
  });

  useEffect(() => {
    if (open) {
      if (isEditMode) {
        loadStaffData();
      } else {
        form.resetFields();
      }
    }
  }, [open, staffId]);

  const loadStaffData = async () => {
    try {
      setInitialLoading(true);
      const data = await stateService.getStaffById(staffId);
      form.setFieldsValue({
        name: data.name,
        email: data.email,
        phoneNo: data.phoneNo,
        role: data.role,
        institutionId: data.institutionId,
        branchName: data.branchName,
        designation: data.designation,
        active: data.active !== false,
      });
    } catch (error) {
      toast.error('Failed to load staff data');
      onClose();
    } finally {
      setInitialLoading(false);
    }
  };

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  const handleSubmit = async (values) => {
    try {
      setLoading(true);

      if (isEditMode) {
        const { password, ...updateData } = values;
        await dispatch(updateStaff({ id: staffId, data: updateData })).unwrap();
        toast.success('Staff member updated successfully');
      } else {
        await dispatch(createStaff(values)).unwrap();
        toast.success('Staff member created successfully');
      }

      handleClose();
      onSuccess?.();
    } catch (error) {
      toast.error(error?.message || `Failed to ${isEditMode ? 'update' : 'create'} staff member`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={isEditMode ? 'Edit Staff Member' : 'Add New Staff Member'}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={600}
      destroyOnHidden
    >
      {initialLoading || lookupLoading ? (
        <div className="flex justify-center items-center py-12">
          <Spin size="large" />
        </div>
      ) : (
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            active: true,
            role: 'TEACHER',
          }}
        >
          <Divider plain>Personal Information</Divider>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="name"
                label="Full Name"
                rules={[{ required: true, message: 'Please enter staff name' }]}
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
                  { type: 'email', message: 'Please enter a valid email' },
                ]}
              >
                <Input placeholder="Enter email address" disabled={isEditMode} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            {!isEditMode && (
              <Col xs={24} md={12}>
                <Form.Item
                  name="password"
                  label="Password"
                  rules={[
                    { required: true, message: 'Please enter password' },
                    { min: 8, message: 'Password must be at least 8 characters' },
                  ]}
                >
                  <Input.Password placeholder="Enter password (min 8 characters)" />
                </Form.Item>
              </Col>
            )}

            <Col xs={24} md={12}>
              <Form.Item
                name="phoneNo"
                label="Phone Number"
                rules={[
                  { pattern: /^\+?[0-9]{10,15}$/, message: 'Please enter valid phone number (10-15 digits)' },
                ]}
              >
                <Input placeholder="Enter phone number" />
              </Form.Item>
            </Col>
          </Row>

          <Divider plain>Professional Information</Divider>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="role"
                label="Role"
                rules={[{ required: true, message: 'Please select a role' }]}
              >
                <Select placeholder="Select role">
                  <Select.Option value="TEACHER">Teacher</Select.Option>
                  <Select.Option value="FACULTY_SUPERVISOR">Faculty Supervisor</Select.Option>
                  <Select.Option value="PLACEMENT_OFFICER">Placement Officer</Select.Option>
                  <Select.Option value="ACCOUNTANT">Accountant</Select.Option>
                  <Select.Option value="ADMISSION_OFFICER">Admission Officer</Select.Option>
                  <Select.Option value="EXAMINATION_OFFICER">Examination Officer</Select.Option>
                  <Select.Option value="PMS_OFFICER">PMS Officer</Select.Option>
                  <Select.Option value="EXTRACURRICULAR_HEAD">Extracurricular Head</Select.Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="institutionId"
                label="Institution"
                rules={[{ required: true, message: 'Please select an institution' }]}
              >
                <Select
                  placeholder="Select institution"
                  showSearch
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    option.children.toLowerCase().includes(input.toLowerCase())
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
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="branchName" label="Branch">
                <Select placeholder="Select branch" allowClear showSearch optionFilterProp="children">
                  {activeBranches?.map(branch => (
                    <Select.Option key={branch.id} value={branch.shortName}>
                      {branch.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item name="designation" label="Designation">
                <Input placeholder="Enter designation (e.g., Assistant Professor)" />
              </Form.Item>
            </Col>
          </Row>

          {isEditMode && (
            <>
              <Divider plain>Account Settings</Divider>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="active"
                    label="Active Status"
                    valuePropName="checked"
                  >
                    <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

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
              {isEditMode ? 'Update Staff' : 'Create Staff'}
            </Button>
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
};

export default StaffModal;
