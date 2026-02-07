import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Modal, Form, Input, Select, DatePicker, Button, Row, Col, Divider, Upload, Spin, Alert } from 'antd';
import { toast } from 'react-hot-toast';
import { SaveOutlined, UploadOutlined } from '@ant-design/icons';
import { createVisitLog, updateVisitLog, fetchVisitLogById, fetchAssignedStudents } from '../store/facultySlice';
import { fetchCompanies } from '../../../store/slices/companySlice';
import dayjs from 'dayjs';

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const VisitLogModal = ({ open, onClose, visitLogId, onSuccess }) => {
  const isEdit = !!visitLogId;
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [internshipDateError, setInternshipDateError] = useState(null);
  const [selectedInternship, setSelectedInternship] = useState(null);

  const { visitLogs, students } = useSelector((state) => state.faculty);
  const currentVisitLog = visitLogs?.current;
  const assignedStudents = students?.list || [];
  const { companies } = useSelector((state) => state.company || { companies: [] });

  useEffect(() => {
    if (open) {
      const loadData = async () => {
        setDataLoading(true);
        try {
          await Promise.all([
            dispatch(fetchAssignedStudents()),
            dispatch(fetchCompanies()),
          ]);

          if (isEdit && visitLogId) {
            await dispatch(fetchVisitLogById(visitLogId));
          } else {
            form.resetFields();
            setFileList([]);
          }
        } catch (error) {
          toast.error('Failed to load data');
        } finally {
          setDataLoading(false);
        }
      };

      loadData();
    }
  }, [dispatch, isEdit, visitLogId, open]);

  useEffect(() => {
    if (open && isEdit && currentVisitLog) {
      form.setFieldsValue({
        ...currentVisitLog,
        visitDate: currentVisitLog.visitDate ? dayjs(currentVisitLog.visitDate) : null,
        studentId: currentVisitLog.student?.id,
        companyId: currentVisitLog.company?.id,
        // Project Information fields
        titleOfProjectWork: currentVisitLog.titleOfProjectWork,
        assistanceRequiredFromInstitute: currentVisitLog.assistanceRequiredFromInstitute,
        responseFromOrganisation: currentVisitLog.responseFromOrganisation,
        remarksOfOrganisationSupervisor: currentVisitLog.remarksOfOrganisationSupervisor,
        significantChangeInPlan: currentVisitLog.significantChangeInPlan,
        // Observations & Feedback fields
        observationsAboutStudent: currentVisitLog.observationsAboutStudent,
        feedbackSharedWithStudent: currentVisitLog.feedbackSharedWithStudent,
      });
    }
  }, [isEdit, currentVisitLog, form, open]);

  const handleClose = () => {
    form.resetFields();
    setFileList([]);
    setInternshipDateError(null);
    setSelectedInternship(null);
    onClose();
  };

  // Validate visit date against internship dates
  const validateInternshipDates = useCallback((visitDate, internship) => {
    if (!internship || !visitDate) {
      setInternshipDateError(null);
      return true;
    }

    const visit = visitDate.toDate ? visitDate.toDate() : new Date(visitDate);
    visit.setHours(0, 0, 0, 0);

    // Check if internship has started
    if (internship.startDate) {
      const startDate = new Date(internship.startDate);
      startDate.setHours(0, 0, 0, 0);
      if (visit < startDate) {
        setInternshipDateError(`Visit date cannot be before internship start date (${startDate.toLocaleDateString()})`);
        return false;
      }
    }

    // Check if internship has ended
    if (internship.endDate) {
      const endDate = new Date(internship.endDate);
      endDate.setHours(23, 59, 59, 999);
      if (visit > endDate) {
        setInternshipDateError(`Visit date cannot be after internship end date (${new Date(internship.endDate).toLocaleDateString()})`);
        return false;
      }
    }

    setInternshipDateError(null);
    return true;
  }, []);

  // Handle student selection
  const handleStudentSelect = useCallback((studentId) => {
    setInternshipDateError(null);
    setSelectedInternship(null);

    // Find the student in assignedStudents
    const found = assignedStudents.find(s => s.id === studentId);
    if (found) {
      const applications = found.internshipApplications || [];
      if (applications.length > 0) {
        const application = applications[0];
        setSelectedInternship(application);

        // Validate current visit date against the internship
        const currentVisitDate = form.getFieldValue('visitDate');
        if (currentVisitDate) {
          validateInternshipDates(currentVisitDate, application);
        }
      }
    }
  }, [assignedStudents, form, validateInternshipDates]);

  // Handle visit date change
  const handleVisitDateChange = useCallback((date) => {
    if (selectedInternship) {
      validateInternshipDates(date, selectedInternship);
    }
  }, [selectedInternship, validateInternshipDates]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const formData = new FormData();

      Object.keys(values).forEach(key => {
        if (values[key] && key !== 'visitDate' && key !== 'attachments') {
          formData.append(key, values[key]);
        }
      });

      if (values.visitDate) {
        formData.append('visitDate', values.visitDate.format('YYYY-MM-DD'));
      }

      fileList.forEach(file => {
        if (file.originFileObj) {
          formData.append('attachments', file.originFileObj);
        }
      });

      if (isEdit) {
        await dispatch(updateVisitLog({ id: visitLogId, data: formData })).unwrap();
        toast.success('Visit log updated successfully');
      } else {
        await dispatch(createVisitLog(formData)).unwrap();
        toast.success('Visit log created successfully');
      }
      handleClose();
      onSuccess?.();
    } catch (error) {
      toast.error(error?.message || `Failed to ${isEdit ? 'update' : 'create'} visit log`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = useCallback(({ fileList: newFileList }) => {
    setFileList(newFileList);
  }, []);

  const beforeUpload = useCallback((file) => {
    const isValidSize = file.size / 1024 / 1024 < 10;
    if (!isValidSize) {
      toast.error('File must be smaller than 10MB!');
      return Upload.LIST_IGNORE;
    }
    return false;
  }, []);

  const uploadProps = useMemo(() => ({
    beforeUpload,
    fileList,
    onChange: handleFileChange,
    maxCount: 5,
    multiple: true,
  }), [beforeUpload, fileList, handleFileChange]);

  return (
    <Modal
      title={isEdit ? 'Edit Visit Log' : 'Add Visit Log'}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={900}
      destroyOnHidden
    >
      {dataLoading ? (
        <div className="py-12 text-center">
          <Spin size="large" />
        </div>
      ) : (
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Divider plain>Visit Information</Divider>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="visitDate"
                label="Visit Date"
                rules={[{ required: true, message: 'Please select visit date' }]}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  placeholder="Select visit date"
                  format="DD/MM/YYYY"
                  onChange={handleVisitDateChange}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="status"
                label="Status"
                rules={[{ required: true, message: 'Please select status' }]}
              >
                <Select placeholder="Select status" options={STATUS_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="studentId"
                label="Student"
                rules={[{ required: true, message: 'Please select student' }]}
              >
                <Select
                  placeholder="Select student"
                  showSearch
                  filterOption={(input, option) =>
                    option.label.toLowerCase().includes(input.toLowerCase())
                  }
                  onChange={handleStudentSelect}
                  options={assignedStudents?.map(student => ({
                    value: student.id,
                    label: `${student?.user?.name || student.name} (${student?.user?.rollNumber || student.rollNumber})`,
                  }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="companyId"
                label="Company"
                rules={[{ required: true, message: 'Please select company' }]}
              >
                <Select
                  placeholder="Select company"
                  showSearch
                  filterOption={(input, option) =>
                    option.label.toLowerCase().includes(input.toLowerCase())
                  }
                  options={companies?.map(company => ({
                    value: company.id,
                    label: company.name,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          {internshipDateError && (
            <Alert
              message="Cannot Log Visit"
              description={internshipDateError}
              type="error"
              showIcon
              className="mb-4"
            />
          )}

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="contactPerson" label="Contact Person">
                <Input placeholder="Enter contact person name" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="contactNumber"
                label="Contact Number"
                rules={[
                  { pattern: /^[0-9]{10}$/, message: 'Please enter a valid 10-digit phone number' }
                ]}
              >
                <Input placeholder="Enter contact number" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="purpose"
            label="Purpose of Visit"
            rules={[
              { required: true, message: 'Please enter purpose of visit' },
              { min: 10, message: 'Please provide at least 10 characters' }
            ]}
          >
            <Input.TextArea
              rows={2}
              placeholder="Describe the purpose of the visit..."
              showCount
              maxLength={500}
            />
          </Form.Item>

          <Divider plain>Project Information</Divider>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="titleOfProjectWork" label="Title of Project/Work">
                <Input
                  placeholder="Enter the title of the project or work..."
                  maxLength={200}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="assistanceRequiredFromInstitute" label="Assistance Required from Institute">
                <Input.TextArea
                  rows={2}
                  placeholder="Describe any assistance required..."
                  showCount
                  maxLength={500}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="responseFromOrganisation" label="Response from Organisation">
                <Input.TextArea
                  rows={2}
                  placeholder="Enter response from organisation..."
                  showCount
                  maxLength={500}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="remarksOfOrganisationSupervisor" label="Remarks of Organisation Supervisor">
                <Input.TextArea
                  rows={2}
                  placeholder="Enter supervisor remarks..."
                  showCount
                  maxLength={500}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="significantChangeInPlan" label="Any Significant Change with Respect to the Plan of Project/Work">
            <Input.TextArea
              rows={2}
              placeholder="Describe any significant changes in the project plan..."
              showCount
              maxLength={500}
            />
          </Form.Item>

          <Divider plain>Observations & Feedback</Divider>

          <Form.Item
            name="observationsAboutStudent"
            label="Observations about the Student"
            extra="Please provide at least 100 words"
          >
            <Input.TextArea
              rows={4}
              placeholder="Enter your observations about the student (at least 100 words)..."
              showCount
              maxLength={2000}
            />
          </Form.Item>

          <Form.Item name="feedbackSharedWithStudent" label="Feedback Shared with Student">
            <Input.TextArea
              rows={2}
              placeholder="Enter feedback shared with student..."
              showCount
              maxLength={500}
            />
          </Form.Item>

          <Divider plain>Attachments</Divider>

          <Form.Item name="attachments" label="Attachments">
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />}>Upload Files</Button>
            </Upload>
            <div className="text-gray-500 text-xs mt-2">
              Supported formats: PDF, DOC, DOCX, JPG, PNG (Max 10MB per file, up to 5 files)
            </div>
          </Form.Item>

          <div className="flex justify-end gap-3 pt-4 border-t mt-4">
            <Button onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              disabled={!!internshipDateError}
              icon={<SaveOutlined />}
            >
              {isEdit ? 'Update Visit Log' : 'Create Visit Log'}
            </Button>
          </div>
        </Form>
      )}
    </Modal>
  );
};

export default VisitLogModal;
