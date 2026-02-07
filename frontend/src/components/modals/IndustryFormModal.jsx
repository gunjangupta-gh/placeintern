import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Button, Steps, message, Row, Col } from 'antd';
import { createIndustry, updateIndustry } from '../../services/industryApi';
import { toast } from "react-hot-toast";

const { Step } = Steps;
const { Option } = Select;

// Mock data for enums. In a real app, you might fetch this from the backend.
const industryTypes = ["IT", "MANUFACTURING", "FINANCE", "HEALTHCARE", "EDUCATION"];
const companySizes = ["MICRO", "SMALL", "MEDIUM", "LARGE"];

const steps = [
  { title: 'Company Info', content: 'First-content' },
  { title: 'Contact', content: 'Second-content' },
  { title: 'Address & Legal', content: 'Last-content' },
];

const IndustryFormModal = ({ visible, onClose, onSuccess, industry }) => {
  const [form] = Form.useForm();
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (industry) {
      form.setFieldsValue(industry);
    } else {
      form.resetFields();
    }
  }, [industry, form]);

  const handleNext = () => setCurrent(current + 1);
  const handlePrev = () => setCurrent(current - 1);

  const handleFinish = async (values) => {
    setLoading(true);
    try {
      if (industry) {
        await updateIndustry(industry.id, values);
        toast.success('Industry updated successfully');
      } else {
        await createIndustry(values);
        toast.success('Industry created successfully');
      }
      onSuccess();
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'An error occurred';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={industry ? 'Edit Industry' : 'Create Industry'}
      open={visible}
      onCancel={onClose}
      width={800}
      footer={null} // Custom footer below
      className="rounded-xl overflow-hidden"
    >
      <Steps current={current} className="mb-8">
        {steps.map(item => <Step key={item.title} title={item.title} />)}
      </Steps>

      <Form form={form} layout="vertical" onFinish={handleFinish}>
        {/* Step 1: Company Information */}
        <div style={{ display: current === 0 ? 'block' : 'none' }}>
           <Row gutter={16}>
              <Col span={12}>
                 <Form.Item name="companyName" label="Company Name" rules={[{ required: true }]}>
                    <Input />
                 </Form.Item>
              </Col>
              <Col span={12}>
                 <Form.Item name="establishedYear" label="Established Year">
                    <Input type="number" />
                 </Form.Item>
              </Col>
           </Row>
           <Row gutter={16}>
              <Col span={12}>
                 <Form.Item name="industryType" label="Industry Type" rules={[{ required: true }]}>
                    <Select placeholder="Select type">{industryTypes.map(type => <Option key={type} value={type}>{type}</Option>)}</Select>
                 </Form.Item>
              </Col>
              <Col span={12}>
                 <Form.Item name="companySize" label="Company Size" rules={[{ required: true }]}>
                    <Select placeholder="Select size">{companySizes.map(size => <Option key={size} value={size}>{size}</Option>)}</Select>
                 </Form.Item>
              </Col>
           </Row>
           <Form.Item name="companyDescription" label="Company Description">
              <Input.TextArea rows={4} />
           </Form.Item>
        </div>

        {/* Step 2: Contact Information */}
        <div style={{ display: current === 1 ? 'block' : 'none' }}>
            <Row gutter={16}>
               <Col span={12}><Form.Item name="contactPersonName" label="Contact Person" rules={[{ required: true }]}><Input /></Form.Item></Col>
               <Col span={12}><Form.Item name="contactPersonTitle" label="Contact Title" rules={[{ required: true }]}><Input /></Form.Item></Col>
            </Row>
            <Row gutter={16}>
               <Col span={12}><Form.Item name="primaryEmail" label="Primary Email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item></Col>
               <Col span={12}><Form.Item name="alternateEmail" label="Alternate Email" rules={[{ type: 'email' }]}><Input /></Form.Item></Col>
            </Row>
            <Row gutter={16}>
               <Col span={12}><Form.Item name="primaryPhone" label="Primary Phone" rules={[{ required: true }]}><Input /></Form.Item></Col>
               <Col span={12}><Form.Item name="alternatePhone" label="Alternate Phone"><Input /></Form.Item></Col>
            </Row>
            <Form.Item name="website" label="Website URL" rules={[{ type: 'url' }]}><Input /></Form.Item>
        </div>

        {/* Step 3: Address & Legal */}
        <div style={{ display: current === 2 ? 'block' : 'none' }}>
            <Form.Item name="address" label="Address" rules={[{ required: true }]}><Input /></Form.Item>
            <Row gutter={16}>
               <Col span={8}><Form.Item name="city" label="City" rules={[{ required: true }]}><Input /></Form.Item></Col>
               <Col span={8}><Form.Item name="state" label="State" rules={[{ required: true }]}><Input /></Form.Item></Col>
               <Col span={8}><Form.Item name="pinCode" label="PIN Code" rules={[{ required: true }]}><Input /></Form.Item></Col>
            </Row>
            <Row gutter={16}>
               <Col span={8}><Form.Item name="registrationNumber" label="Registration No." rules={[{ required: true }]}><Input /></Form.Item></Col>
               <Col span={8}><Form.Item name="panNumber" label="PAN Number" rules={[{ required: true }]}><Input /></Form.Item></Col>
               <Col span={8}><Form.Item name="gstNumber" label="GST Number"><Input /></Form.Item></Col>
            </Row>
        </div>
      </Form>

      <div className="steps-action mt-8 flex justify-end gap-3">
        {current > 0 && (
          <Button onClick={handlePrev} className="rounded-lg">
            Previous
          </Button>
        )}
        {current < steps.length - 1 && (
          <Button type="primary" onClick={handleNext} className="rounded-lg px-6">
            Next
          </Button>
        )}
        {current === steps.length - 1 && (
          <Button 
            type="primary" 
            loading={loading} 
            onClick={() => form.submit()}
            className="rounded-lg px-8 shadow-lg shadow-primary/20"
          >
            {industry ? 'Update Industry' : 'Create Industry'}
          </Button>
        )}
      </div>
    </Modal>
  );
};

export default IndustryFormModal;