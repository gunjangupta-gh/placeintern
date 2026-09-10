import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, AutoComplete, Switch, InputNumber, Row, Col, Divider, Typography } from 'antd';
import { toast } from 'react-hot-toast';
import principalService from '../../../services/principal.service';
import { internshipReportService } from '../../../services/internshipReport.service';

const { Text } = Typography;

const ENROLLMENT_STATUS_OPTIONS = [
  { value: 'ENROLLED', label: 'Enrolled' },
  { value: 'DROPPED_OUT', label: 'Dropped Out' },
];

const MODE_OPTIONS = [
  { value: 'ONLINE', label: 'Online' },
  { value: 'OFFLINE', label: 'Offline' },
];

const MENTOR_ROLES = ['TEACHER', 'FACULTY_COORDINATOR'];

const InternshipReportModal = ({ open, onClose, report, onSuccess }) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  const [mentors, setMentors] = useState([]);
  const [mentorsLoading, setMentorsLoading] = useState(false);

  const [companies, setCompanies] = useState([]);

  const isWorkInPunjab = Form.useWatch('isWorkInPunjab', form);
  const isStipendOffered = Form.useWatch('isStipendOffered', form);
  const isOfferLetterReceived = Form.useWatch('isOfferLetterReceived', form);

  const isEditMode = !!report;

  useEffect(() => {
    if (!open) return;

    const loadLookups = async () => {
      setStudentsLoading(true);
      setMentorsLoading(true);
      try {
        const [studentRes, staffRes] = await Promise.all([
          principalService.getStudents({ limit: 500 }),
          principalService.getStaff({ limit: 500, active: true }),
        ]);
        setStudents(studentRes.data || studentRes.students || []);
        const staffList = staffRes.data || staffRes.staff || [];
        setMentors(staffList.filter((s) => MENTOR_ROLES.includes(s.role)));
      } catch (error) {
        toast.error('Failed to load students/faculty list');
      } finally {
        setStudentsLoading(false);
        setMentorsLoading(false);
      }
    };

    loadLookups();
    fetchCompanies();
  }, [open]);

  useEffect(() => {
    if (open && report) {
      form.setFieldsValue({
        studentId: report.studentId,
        enrollmentStatus: report.enrollmentStatus,
        companyName: report.companyName,
        organizationWebsite: report.organizationWebsite,
        modeOfInternship: report.modeOfInternship,
        industrySector: report.industrySector,
        isWorkInPunjab: report.isWorkInPunjab,
        workDistrict: report.workDistrict,
        workState: report.workState,
        hrName: report.hrName,
        hrPhoneNumber: report.hrPhoneNumber,
        isStipendOffered: report.isStipendOffered,
        stipendAmountPerMonth: report.stipendAmountPerMonth,
        isOfferLetterReceived: report.isOfferLetterReceived,
        offerLetterUrl: report.offerLetterUrl,
        facultyMentorId: report.facultyMentorId,
      });
    } else if (open) {
      form.resetFields();
    }
  }, [open, report, form]);

  const fetchCompanies = async (search = '') => {
    try {
      const response = await internshipReportService.getCompanies({ search, limit: 100 });
      setCompanies(response.companies || []);
    } catch (error) {
      // Non-blocking — company autocomplete is a convenience, manual entry always works
    }
  };

  const handleCompanySelect = (value) => {
    const selected = companies.find((c) => c.name === value);
    if (selected) {
      form.setFieldsValue({
        companyName: selected.name,
        organizationWebsite: selected.website || form.getFieldValue('organizationWebsite'),
        industrySector: selected.industrySector || form.getFieldValue('industrySector'),
      });
    }
  };

  const companyOptions = companies.map((company) => ({
    value: company.name,
    label: (
      <div>
        <div style={{ fontWeight: 500 }}>{company.name}</div>
        {company.address && <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>{company.address}</div>}
      </div>
    ),
  }));

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      if (isEditMode) {
        await internshipReportService.updateReport(report.id, values);
        toast.success('Internship report updated');
      } else {
        await internshipReportService.createReport(values);
        toast.success('Internship report added');
      }
      onSuccess?.();
      onClose();
    } catch (error) {
      if (error?.errorFields) return; // form validation error, already shown inline
      toast.error(error?.response?.data?.message || error?.message || 'Failed to save internship report');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isEditMode ? 'Edit Internship Report' : 'Add Internship Report'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={saving}
      width={720}
      destroyOnClose
    >
      <Form form={form} layout="vertical" initialValues={{ enrollmentStatus: 'ENROLLED' }}>
        <Text strong style={{ fontSize: 12, textTransform: 'uppercase', color: 'rgba(0,0,0,0.45)' }}>Student</Text>
        <Row gutter={16} style={{ marginTop: 8 }}>
          <Col span={12}>
            <Form.Item
              label="Student"
              name="studentId"
              rules={[{ required: true, message: 'Please select a student' }]}
            >
              <Select
                showSearch
                loading={studentsLoading}
                disabled={isEditMode}
                placeholder="Search student by name or roll number"
                optionFilterProp="label"
                options={students.map((s) => ({
                  value: s.id,
                  label: `${s.user?.name || s.name} (${s.user?.rollNumber || s.rollNumber || 'N/A'})`,
                }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Enrollment Status" name="enrollmentStatus">
              <Select options={ENROLLMENT_STATUS_OPTIONS} />
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ margin: '8px 0 16px' }} />
        <Text strong style={{ fontSize: 12, textTransform: 'uppercase', color: 'rgba(0,0,0,0.45)' }}>Internship Details</Text>
        <Row gutter={16} style={{ marginTop: 8 }}>
          <Col span={24}>
            <Form.Item
              label="Company Name"
              name="companyName"
              extra="Select an existing company to auto-fill details, or type a new one manually"
              rules={[{ required: true, message: 'Please enter company name' }]}
            >
              <AutoComplete
                options={companyOptions}
                onSelect={handleCompanySelect}
                onSearch={fetchCompanies}
                placeholder="Search or enter company name"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Organization Website" name="organizationWebsite">
              <Input placeholder="https://company.com" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Sector of the Industry" name="industrySector">
              <Input placeholder="e.g. IT, Manufacturing" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Mode of Internship" name="modeOfInternship">
              <Select options={MODE_OPTIONS} allowClear placeholder="Online / Offline" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Work Location in Punjab?" name="isWorkInPunjab" valuePropName="checked">
              <Switch checkedChildren="Yes" unCheckedChildren="No" />
            </Form.Item>
          </Col>
          {isWorkInPunjab && (
            <Col span={12}>
              <Form.Item
                label="Work District"
                name="workDistrict"
                rules={[{ required: true, message: 'Please enter the work district' }]}
              >
                <Input placeholder="e.g. SAS Nagar" />
              </Form.Item>
            </Col>
          )}
          {isWorkInPunjab === false && (
            <Col span={12}>
              <Form.Item
                label="State (outside Punjab)"
                name="workState"
                rules={[{ required: true, message: 'Please enter the state' }]}
              >
                <Input placeholder="e.g. Haryana" />
              </Form.Item>
            </Col>
          )}
        </Row>

        <Divider style={{ margin: '8px 0 16px' }} />
        <Text strong style={{ fontSize: 12, textTransform: 'uppercase', color: 'rgba(0,0,0,0.45)' }}>HR Contact</Text>
        <Row gutter={16} style={{ marginTop: 8 }}>
          <Col span={12}>
            <Form.Item label="HR Name" name="hrName">
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="HR Phone Number" name="hrPhoneNumber">
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ margin: '8px 0 16px' }} />
        <Text strong style={{ fontSize: 12, textTransform: 'uppercase', color: 'rgba(0,0,0,0.45)' }}>Stipend & Offer Letter</Text>
        <Row gutter={16} style={{ marginTop: 8 }}>
          <Col span={12}>
            <Form.Item label="Stipend Offered?" name="isStipendOffered" valuePropName="checked">
              <Switch checkedChildren="Yes" unCheckedChildren="No" />
            </Form.Item>
          </Col>
          {isStipendOffered && (
            <Col span={12}>
              <Form.Item
                label="Amount per Month"
                name="stipendAmountPerMonth"
                rules={[{ required: true, message: 'Please enter the stipend amount' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0} placeholder="e.g. 5000" />
              </Form.Item>
            </Col>
          )}
          <Col span={12}>
            <Form.Item label="Offer Letter Received?" name="isOfferLetterReceived" valuePropName="checked">
              <Switch checkedChildren="Yes" unCheckedChildren="No" />
            </Form.Item>
          </Col>
          {isOfferLetterReceived && (
            <Col span={12}>
              <Form.Item
                label="Link to Offer Letter"
                name="offerLetterUrl"
                rules={[{ required: true, message: 'Please enter the offer letter link' }]}
              >
                <Input placeholder="https://..." />
              </Form.Item>
            </Col>
          )}
        </Row>

        <Divider style={{ margin: '8px 0 16px' }} />
        <Text strong style={{ fontSize: 12, textTransform: 'uppercase', color: 'rgba(0,0,0,0.45)' }}>Faculty Mentor</Text>
        <Row gutter={16} style={{ marginTop: 8 }}>
          <Col span={24}>
            <Form.Item label="Faculty Mentor" name="facultyMentorId">
              <Select
                showSearch
                allowClear
                loading={mentorsLoading}
                placeholder="Select a teacher or faculty coordinator"
                optionFilterProp="label"
                options={mentors.map((m) => ({
                  value: m.id,
                  label: `${m.name}${m.department ? ` — ${m.department}` : ''}`,
                }))}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

export default InternshipReportModal;
