import React, { useEffect, useState } from 'react';
import { Form, Input, Select, Button, Row, Col, Spin, Modal, Divider } from 'antd';
import { toast } from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { createStaff, updateStaff, fetchStaff } from '../store/principalSlice';
import { SaveOutlined } from '@ant-design/icons';
import { useBranches } from '../../shared/hooks/useLookup';

const StaffModal = ({ open, onClose, staffId, onSuccess }) => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);

  const { staff } = useSelector(state => state.principal);
  const staffMember = staffId ? staff.list?.find(s => s.id === staffId) : null;
  const isEditMode = !!staffId;

  // Use global lookup data for branches
  const { activeBranches, loading: branchesLoading } = useBranches();

  useEffect(() => {
    if (open) {
      const loadData = async () => {
        setInitialLoading(true);
        try {
          // Only fetch staff data if editing and staff not in list
          if (staffId && !staffMember) {
            await dispatch(fetchStaff({}));
          }
        } finally {
          setInitialLoading(false);
        }
      };
      loadData();
    }
  }, [dispatch, staffId, staffMember, open]);

  useEffect(() => {
    if (open && staffMember) {
      // Find matching branch ID from the branch name
      let branchId = null;
      if (staffMember.branchName || staffMember.department) {
        const branchName = staffMember.branchName || staffMember.department;
        const matchingBranch = activeBranches?.find(b =>
          b.name === branchName || b.shortName === branchName
        );
        branchId = matchingBranch?.id || null;
      }

      form.setFieldsValue({
        name: staffMember.name,
        email: staffMember.email,
        phoneNo: staffMember.phoneNo,
        role: staffMember.role,
        designation: staffMember.designation,
        branchId,
      });
    } else if (open && !isEditMode) {
      form.resetFields();
    }
  }, [staffMember, form, open, isEditMode, activeBranches]);

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      // Transform branchId to branch name
      let branchName = null;
      if (values.branchId) {
        const selectedBranch = activeBranches?.find(b => b.id === values.branchId);
        branchName = selectedBranch?.name || null;
      }

      const formattedValues = {
        name: values.name,
        email: values.email,
        phoneNo: values.phoneNo,
        role: values.role,
        designation: values.designation,
        branchName: branchName,
      };

      if (isEditMode) {
        await dispatch(updateStaff({ id: staffId, data: formattedValues })).unwrap();
        toast.success('Staff updated successfully');
      } else {
        await dispatch(createStaff(formattedValues)).unwrap();
        toast.success('Staff created successfully');
      }
      handleClose();
      onSuccess?.();
    } catch (error) {
      toast.error(error?.message || 'Operation failed');
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
      {initialLoading || branchesLoading ? (
        <div className="flex justify-center items-center py-12">
          <Spin size="large" />
        </div>
      ) : (
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Divider plain>Personal Information</Divider>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="name"
                label="Full Name"
                rules={[{ required: true, message: 'Please enter full name' }]}
              >
                <Input placeholder="Enter full name" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Please enter email' },
                  { type: 'email', message: 'Please enter valid email' }
                ]}
              >
                <Input placeholder="Enter email" disabled={isEditMode} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="phoneNo"
                label="Phone Number"
                rules={[
                  { pattern: /^\+?[0-9]{10,15}$/, message: 'Please enter valid phone number (10-15 digits)' }
                ]}
              >
                <Input placeholder="Enter phone number" />
              </Form.Item>
            </Col>
          </Row>

          <Divider plain>Professional Information</Divider>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="role"
                label="Role"
                rules={[{ required: true, message: 'Please select role' }]}
              >
                <Select placeholder="Select role">
                  <Select.Option value="TEACHER">Teacher</Select.Option>
                  <Select.Option value="FACULTY_SUPERVISOR">Faculty Supervisor</Select.Option>
                  <Select.Option value="PLACEMENT_OFFICER">Placement Officer</Select.Option>
                  <Select.Option value="ACCOUNTANT">Accountant</Select.Option>
                  <Select.Option value="ADMISSION_OFFICER">Admission Officer</Select.Option>
                  <Select.Option value="EXAMINATION_OFFICER">Examination Officer</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="branchId"
                label="Branch"
              >
                <Select placeholder="Select branch" allowClear>
                  {activeBranches?.map(branch => (
                    <Select.Option key={branch.id} value={branch.id}>
                      {branch.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item
                name="designation"
                label="Designation"
              >
                <Input placeholder="Enter designation (e.g., Assistant Professor, Senior Lecturer)" />
              </Form.Item>
            </Col>
          </Row>

          <div className="flex justify-end gap-3 pt-4 border-t mt-4">
            <Button onClick={handleClose} className="rounded-lg">
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />} className="rounded-lg shadow-md shadow-primary/20">
              {isEditMode ? 'Update Staff' : 'Create Staff'}
            </Button>
          </div>
        </Form>
      )}
    </Modal>
  );
};

export default StaffModal;

