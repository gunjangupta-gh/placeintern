import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Modal,
  Form,
  Input,
  Button,
  Select,
  Row,
  Col,
  Divider,
  Typography,
  Checkbox,
  Alert,
  Spin
} from 'antd';
import { toast } from 'react-hot-toast';
import {
  SaveOutlined,
  BankOutlined,
  PhoneOutlined,
  MailOutlined,
  GlobalOutlined,
  TeamOutlined,
  EditOutlined,
  PlusOutlined,
  EnvironmentOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import {
  createInstitution,
  updateInstitution,
  selectInstitutions,
} from '../store/stateSlice';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const InstitutionModal = ({ open, onClose, institutionId, onSuccess }) => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const institutions = useSelector(selectInstitutions);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createPrincipal, setCreatePrincipal] = useState(false);

  const isEditMode = !!institutionId;

  // Institution Types (aligned with backend/schema)
  const institutionTypes = [
    "ENGINEERING",
    "POLYTECHNIC",
    "PHARMACY",
    "MANAGEMENT",
    "ARCHITECTURE",
    "HOTEL_MANAGEMENT",
    "ARTS_AND_SCIENCE"
  ];

  useEffect(() => {
    if (open) {
      if (isEditMode) {
        setLoading(true);
        // Find institution from store or fetch if needed
        const institution = institutions.find((i) => i.id === institutionId);
        if (institution) {
          // Map backend fields to form fields if necessary
          form.setFieldsValue({
            ...institution,
            // Ensure proper boolean/string types if needed
            isActive: institution.isActive?.toString(), 
          });
        }
        setLoading(false);
        setCreatePrincipal(false); // Reset principal creation on edit
      } else {
        form.resetFields();
        form.setFieldsValue({
          country: "India",
          state: "Punjab", // Default or dynamic
          isActive: "true",
          type: "POLYTECHNIC",
        });
        setCreatePrincipal(false);
      }
    }
  }, [open, institutionId, institutions, isEditMode, form]);

  const handleClose = () => {
    form.resetFields();
    setCreatePrincipal(false);
    onClose();
  };

  const onFinish = async (values) => {
    setSubmitting(true);
    try {
      // Transform values if needed (e.g., string "true" to boolean true)
      const payload = {
        ...values,
        isActive: values.isActive === 'true',
        // If creating principal is checked, those fields are included
      };

      if (isEditMode) {
        await dispatch(updateInstitution({ id: institutionId, data: payload })).unwrap();
        toast.success('Institution updated successfully');
      } else {
        await dispatch(createInstitution(payload)).unwrap();
        toast.success('Institution created successfully');
      }
      
      handleClose();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Submission error:", error);
      toast.error(error.message || 'Failed to save institution');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-3 py-1">
          <div className="bg-primary/10 p-2 rounded-lg text-primary">
            {isEditMode ? <EditOutlined className="text-lg" /> : <BankOutlined className="text-lg" />}
          </div>
          <span className="font-bold text-lg text-text-primary">
            {isEditMode ? 'Edit Institution' : 'Add New Institution'}
          </span>
        </div>
      }
      open={open}
      onCancel={handleClose}
      footer={null}
      width={900}
      destroyOnHidden
      centered
      className="rounded-2xl overflow-hidden"
      styles={{
        content: { borderRadius: '16px', padding: 0 },
        header: { padding: '20px 24px', borderBottom: '1px solid var(--color-border)' },
        body: { padding: '24px', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' },
        mask: { backdropFilter: 'blur(4px)' }
      }}
    >
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Spin size="large" />
        </div>
      ) : (
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          requiredMark="optional"
          className="institution-form"
        >
          {/* Basic Information Section */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <InfoCircleOutlined className="text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest text-text-tertiary">Basic Information</span>
            </div>

            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="type"
                  label={<span className="font-medium text-text-secondary">Institution Type</span>}
                  rules={[{ required: true, message: "Please select institution type" }]}
                >
                  <Select placeholder="Select type" className="h-10">
                    {institutionTypes.map((type) => (
                      <Option key={type} value={type}>
                        {type.replace("_", " ")}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item 
                  name="code" 
                  label={<span className="font-medium text-text-secondary">Institution Code</span>}
                  rules={[{ required: true, message: "Please enter institution code" }]}
                >
                  <Input placeholder="e.g. GPC-001" className="h-10 rounded-lg" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item 
                  name="name" 
                  label={<span className="font-medium text-text-secondary">Full Name</span>}
                  rules={[{ required: true, message: "Please enter full name" }]}
                >
                  <Input placeholder="Full institution name" className="h-10 rounded-lg" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item name="shortName" label={<span className="font-medium text-text-secondary">Short Name</span>}>
                  <Input placeholder="Abbreviated name" className="h-10 rounded-lg" />
                </Form.Item>
              </Col>
            </Row>
          </div>

          <Divider className="border-border/60" />

          {/* Location Section */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <EnvironmentOutlined className="text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest text-text-tertiary">Location Details</span>
            </div>

            <Row gutter={24}>
              <Col xs={24}>
                <Form.Item
                  name="address"
                  label={<span className="font-medium text-text-secondary">Address</span>}
                  rules={[{ required: true, message: "Please enter address" }]}
                >
                  <TextArea rows={2} placeholder="Full address" className="rounded-lg" />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item name="city" label={<span className="font-medium text-text-secondary">City</span>}>
                  <Input placeholder="City" className="h-10 rounded-lg" />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item name="district" label={<span className="font-medium text-text-secondary">District</span>}>
                  <Input placeholder="District" className="h-10 rounded-lg" />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item
                  name="state"
                  label={<span className="font-medium text-text-secondary">State</span>}
                  rules={[{ required: true, message: "Please enter state" }]}
                >
                  <Input placeholder="State" className="h-10 rounded-lg" />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item name="pinCode" label={<span className="font-medium text-text-secondary">PIN Code</span>}>
                  <Input placeholder="6-digit PIN" maxLength={6} className="h-10 rounded-lg" />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item
                  name="country"
                  label={<span className="font-medium text-text-secondary">Country</span>}
                  rules={[{ required: true, message: "Please enter country" }]}
                >
                  <Input placeholder="Country" className="h-10 rounded-lg" />
                </Form.Item>
              </Col>
            </Row>
          </div>

          <Divider className="border-border/60" />

          {/* Contact Section */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <PhoneOutlined className="text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest text-text-tertiary">Contact Information</span>
            </div>

            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="contactEmail"
                  label={<span className="font-medium text-text-secondary">Email</span>}
                  rules={[{ required: true, message: "Please enter email" }, { type: "email", message: "Invalid email" }]}
                >
                  <Input prefix={<MailOutlined className="text-text-tertiary" />} placeholder="contact@institution.edu" className="h-10 rounded-lg" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="contactPhone"
                  label={<span className="font-medium text-text-secondary">Phone</span>}
                  rules={[{ required: true, message: "Please enter phone" }]}
                >
                  <Input prefix={<PhoneOutlined className="text-text-tertiary" />} placeholder="Phone number" className="h-10 rounded-lg" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item name="website" label={<span className="font-medium text-text-secondary">Website</span>}>
                  <Input prefix={<GlobalOutlined className="text-text-tertiary" />} placeholder="https://www.institution.edu" className="h-10 rounded-lg" />
                </Form.Item>
              </Col>
            </Row>
          </div>

          <Divider className="border-border/60" />

          {/* Additional Details */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <BankOutlined className="text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest text-text-tertiary">Additional Details</span>
            </div>

            <Row gutter={24}>
              <Col xs={24} md={8}>
                <Form.Item name="establishedYear" label={<span className="font-medium text-text-secondary">Est. Year</span>}>
                  <Input type="number" placeholder="YYYY" min={1800} max={new Date().getFullYear()} className="h-10 rounded-lg" />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item name="totalStudentSeats" label={<span className="font-medium text-text-secondary">Student Capacity</span>}>
                  <Input type="number" placeholder="0" min={0} className="h-10 rounded-lg" />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item name="totalStaffSeats" label={<span className="font-medium text-text-secondary">Staff Capacity</span>}>
                  <Input type="number" placeholder="0" min={0} className="h-10 rounded-lg" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item name="affiliatedTo" label={<span className="font-medium text-text-secondary">Affiliated To</span>}>
                  <Input placeholder="University/Board" className="h-10 rounded-lg" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item name="recognizedBy" label={<span className="font-medium text-text-secondary">Recognized By</span>}>
                  <Input placeholder="AICTE, UGC, etc." className="h-10 rounded-lg" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item name="isActive" label={<span className="font-medium text-text-secondary">Status</span>} rules={[{ required: true }]}>
                  <Select className="h-10">
                    <Option value="true">Active</Option>
                    <Option value="false">Inactive</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </div>

          {/* Create Principal Section (Only for Create Mode) */}
          {!isEditMode && (
            <div className="bg-primary/5 p-6 rounded-xl border border-primary/10">
              <Form.Item className="mb-0">
                <Checkbox
                  checked={createPrincipal}
                  onChange={(e) => setCreatePrincipal(e.target.checked)}
                  className="font-semibold text-text-primary"
                >
                  Create Principal Account for this Institute
                </Checkbox>
              </Form.Item>

              {createPrincipal && (
                <div className="mt-6 animate-fade-in">
                  <Row gutter={24}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="principalName"
                        label={<span className="font-medium text-text-secondary">Principal Name</span>}
                        rules={[{ required: createPrincipal, message: "Please enter principal name" }, { min: 3 }]}
                      >
                        <Input prefix={<TeamOutlined className="text-text-tertiary" />} placeholder="Full name" className="h-10 rounded-lg" />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={12}>
                      <Form.Item
                        name="principalPhone"
                        label={<span className="font-medium text-text-secondary">Principal Phone</span>}
                        rules={[{ required: createPrincipal, message: "Please enter phone number" }, { pattern: /^[0-9]{10}$/, message: "Must be 10 digits" }]}
                      >
                        <Input prefix={<PhoneOutlined className="text-text-tertiary" />} placeholder="10-digit phone" maxLength={10} className="h-10 rounded-lg" />
                      </Form.Item>
                    </Col>
                  </Row>

              <Alert
                title="Credentials Info"
                description="Default credentials will be generated automatically for the Principal and Institutional Admin."
                type="info"
                showIcon
                className="rounded-lg border-info/20"
              />
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-border/60">
            <Button
              onClick={handleClose}
              className="h-10 px-6 rounded-lg font-medium hover:bg-surface-hover"
            >
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              icon={isEditMode ? <SaveOutlined /> : <PlusOutlined />}
              className="h-10 px-6 rounded-lg font-bold shadow-lg shadow-primary/20"
            >
              {isEditMode ? 'Update Institution' : 'Create Institution'}
            </Button>
          </div>
        </Form>
      )}
    </Modal>
  );
};

export default InstitutionModal;
