import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Modal,
  Form,
  Select,
  Input,
  Button,
  Upload,
  Space,
  Row,
  Col,
  Alert,
  Spin,
  Divider,
} from 'antd';
import { toast } from 'react-hot-toast';
import {
  CameraOutlined,
  EnvironmentOutlined,
  UploadOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import PropTypes from 'prop-types';
import { createVisitLog, uploadVisitDocument, fetchVisitLogs } from '../store/facultySlice';

const { Option } = Select;
const { TextArea } = Input;

const MIN_WORDS = 25;
const countWords = (value = '') => value.trim().split(/\s+/).filter(Boolean).length;
const minWordsRule = (label, required) => ({
  validator: (_, value) => {
    const trimmed = (value || '').trim();
    if (!trimmed) {
      return required
        ? Promise.reject(new Error(`${label} is required (${MIN_WORDS} words).`))
        : Promise.resolve();
    }
    const words = countWords(trimmed);
    return words >= MIN_WORDS
      ? Promise.resolve()
      : Promise.reject(new Error(`${label} must be at least ${MIN_WORDS} words (${words}/${MIN_WORDS}).`));
  },
});

const normalizeVisitType = (value) => {
  const visitType = (value || '').toUpperCase();
  return visitType === 'TELEPHONIC' ? 'PHONE' : visitType;
};

const physicalLocationRule = {
  validator: (_, value) => {
    const trimmed = (value || '').trim();
    return trimmed
      ? Promise.resolve()
      : Promise.reject(new Error('Please enter location or capture GPS coordinates'));
  },
};

// Constant styles outside component
const UPLOAD_BUTTON_STYLE = { marginTop: 8 };
const SPACE_COMPACT_STYLE = { width: '100%' };
const IMG_WINDOW_STYLE = { width: '100%' };

const QuickVisitModal = React.memo(({ visible, onClose, onSubmit, students, loading }) => {
  const dispatch = useDispatch();
  const visitLogs = useSelector((state) => state.faculty.visitLogs.list || []);
  const [form] = Form.useForm();
  const isEdit = false;
  const [visitType, setVisitType] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [location, setLocation] = useState(null);
  const [fileList, setFileList] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedApplicationId, setSelectedApplicationId] = useState(null);
  const [internshipDateError, setInternshipDateError] = useState(null);
  const [visitStatus, setVisitStatus] = useState('COMPLETED');
  const [guidanceAcknowledged, setGuidanceAcknowledged] = useState(false);
  const isCompletedStatus = visitStatus === 'COMPLETED';
  const wasVisibleRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!visible) {
      setGuidanceAcknowledged(false);
      return;
    }

    if (guidanceAcknowledged) {
      return;
    }

    const guidanceModal = Modal.confirm({
      title: 'Visit Log Writing Guidance',
      width: 760,
      content: (
        <div>
          <p className="mb-2">While filling today's visit report, please:</p>
          <ul className="list-disc pl-5 space-y-1 mb-2">
            <li>Refer to specific tasks you observed (e.g., transformer testing, bar bending, drawing reading).</li>
            <li>Note what the student did well with examples.</li>
            <li>Give 1-2 precise improvement points plus an action for the next visit.</li>
            <li>Connect your comments to a competency / CO / PO where possible.</li>
          </ul>
          <p className="mb-0">Kindly avoid generic feedback such as "improve practical skills" or "focus on safety" without examples or next steps.</p>
        </div>
      ),
      okText: 'Continue to Visit Log',
      cancelText: 'Cancel',
      onOk: () => setGuidanceAcknowledged(true),
      onCancel: () => onCloseRef.current?.(),
    });

    return () => {
      guidanceModal?.destroy?.();
    };
  }, [visible, guidanceAcknowledged]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      form.resetFields();
      setVisitType(null);
      setLocation(null);
      setFileList([]);
      setSelectedApplicationId(null);
      setInternshipDateError(null);
      setVisitStatus('COMPLETED');
      form.setFieldsValue({ status: 'COMPLETED' });
    }

    wasVisibleRef.current = visible;
  }, [visible, form]);

  const handleStatusChange = useCallback((value) => {
    setVisitStatus(value || 'COMPLETED');
  }, []);

  // Handle student selection - extract applicationId from nested structure
  const handleStudentSelect = useCallback((studentId) => {
    // Reset error state
    setInternshipDateError(null);

    // Find student in the list (handle both flat and nested structures)
    const found = students.find(s =>
      s.student?.id === studentId || s.id === studentId
    );

    if (found) {
      // Get applications from the found item (could be at top level or nested under student)
      const applications = found.internshipApplications ||
                           found.student?.internshipApplications ||
                           [];

      if (applications.length > 0) {
        const application = applications[0];
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison

        // Check if internship has started
        if (application.startDate) {
          const startDate = new Date(application.startDate);
          startDate.setHours(0, 0, 0, 0);
          if (today < startDate) {
            setInternshipDateError(`Internship has not started yet. Start date: ${startDate.toLocaleDateString()}`);
            setSelectedApplicationId(null);
            return;
          }
        }

        // Check if internship has ended
        if (application.endDate) {
          const endDate = new Date(application.endDate);
          endDate.setHours(23, 59, 59, 999); // End of day for end date
          if (today > endDate) {
            setInternshipDateError(`Internship has already ended. End date: ${new Date(application.endDate).toLocaleDateString()}`);
            setSelectedApplicationId(null);
            return;
          }
        }

        setSelectedApplicationId(application.id);
      } else {
        setSelectedApplicationId(null);
        toast('No active internship found for this student', { icon: '⚠️' });
      }
    }
  }, [students]);

  // Handle GPS location capture
  const captureLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setCapturing(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setLocation(coords);

        // Auto-fill location field with coordinates
        const locationText = `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
        form.setFieldsValue({ visitLocation: locationText });

        toast.success('Location captured successfully');
        setCapturing(false);
      },
      (error) => {
        let errorMessage = 'Failed to capture location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable location access.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
          default:
            errorMessage = 'An unknown error occurred';
        }
        toast.error(errorMessage);
        setCapturing(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // Handle visit type change
  const handleVisitTypeChange = (value) => {
    setVisitType(value);

    // Reset location if not physical visit
    if (value !== 'PHYSICAL') {
      setLocation(null);
      form.setFieldsValue({ visitLocation: '' });
    }
  };

  // Handle file upload
  const handleFileChange = ({ fileList: newFileList }) => {
    setFileList(newFileList);
  };

  // Before upload validation
  const beforeUpload = (file) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      toast.error('You can only upload image files!');
      return Upload.LIST_IGNORE;
    }

    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isLt5M) {
      toast.error('Image must be smaller than 5MB!');
      return Upload.LIST_IGNORE;
    }

    return false; // Prevent auto upload
  };

  // Handle form submission
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Validate applicationId is available
      if (!selectedApplicationId) {
        toast.error('No active internship application found for this student. Cannot log visit.');
        return;
      }

      // Check if a visit has already been logged today for this application
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const existingVisitToday = visitLogs.find((visit) => {
        if (visit.applicationId !== selectedApplicationId) return false;
        const visitDate = new Date(visit.visitDate);
        return visitDate >= today && visitDate <= todayEnd;
      });

      if (existingVisitToday) {
        toast.error('You have already logged a visit for this student today. Only one visit per student per day is allowed.');
        return;
      }

      setSubmitting(true);

      // Upload photos first if any
      const photoUrls = [];
      if (fileList.length > 0) {
        for (const file of fileList) {
          if (file.originFileObj) {
            try {
              const result = await dispatch(uploadVisitDocument({ file: file.originFileObj, type: 'visit-photo' })).unwrap();
              photoUrls.push(result.url);
            } catch (error) {
              console.error('Photo upload error:', error);
            }
          }
        }
      }

      // Prepare visit data with applicationId
      const visitTypeValue = normalizeVisitType(values.visitType);
      const visitData = {
        applicationId: selectedApplicationId,
        visitType: visitTypeValue,
        visitDate: new Date().toISOString(),
        status: values.status || 'COMPLETED',
        // Location for physical visits
        ...(visitTypeValue === 'PHYSICAL' && {
          visitLocation: values.visitLocation,
          // GPS coordinates if captured
          ...(location && {
            latitude: location.latitude,
            longitude: location.longitude,
            gpsAccuracy: location.accuracy,
          }),
        }),
        // Project Information fields
        titleOfProjectWork: values.titleOfProjectWork || null,
        assistanceRequiredFromInstitute: values.assistanceRequiredFromInstitute || null,
        responseFromOrganisation: values.responseFromOrganisation || null,
        remarksOfOrganisationSupervisor: values.remarksOfOrganisationSupervisor || null,
        significantChangeInPlan: values.significantChangeInPlan || null,
        // Observations & Feedback fields
        observationsAboutStudent: values.observationsAboutStudent || null,
        feedbackSharedWithStudent: values.feedbackSharedWithStudent || null,
        // Photos
        ...(photoUrls.length > 0 && { visitPhotos: photoUrls }),
      };

      // Use Redux thunk for creating visit
      await dispatch(createVisitLog(visitData)).unwrap();
      toast.success('Visit logged successfully!');
      onSubmit?.(); // Notify parent (for refresh)
      onClose();
    } catch (error) {
      if (error.errorFields) {
        toast.error('Please fill in all required fields');
      } else {
        toast.error(error?.message || error || 'Failed to log visit. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Custom upload button
  const uploadButton = (
    <div>
      <PlusOutlined />
      <div style={UPLOAD_BUTTON_STYLE}>Upload Photo</div>
    </div>
  );

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <CameraOutlined className="text-primary" />
          <span>Quick Log Visit</span>
        </div>
      }
      open={visible && guidanceAcknowledged}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>,
        <Button
          key="submit"
          type="primary"
          onClick={handleSubmit}
          loading={submitting}
          disabled={!!internshipDateError}
          icon={<CameraOutlined />}
        >
          Log Visit
        </Button>,
      ]}
      width={900}
      destroyOnHidden
    >
      <Alert
        message={isCompletedStatus ? 'Completed Status: Full Details Required' : 'Draft Status: Partial Save Allowed'}
        description={isCompletedStatus ? 'Core and detailed visit fields are required for Completed submissions.' : 'For Draft, core fields are required and detailed fields can be filled later before marking Completed.'}
        type={isCompletedStatus ? 'warning' : 'success'}
        showIcon
        closable
        className="mb-4"
      />
      <Form form={form} layout="vertical" className="mt-4">
        {/* Basic Information */}
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="studentId"
              label="Student"
              rules={[{ required: true, message: 'Please select a student' }]}
            >
              <Select
                placeholder="Select student"
                showSearch
                loading={loading}
                filterOption={(input, option) =>
                  option.children?.toLowerCase?.().includes(input.toLowerCase())
                }
                onChange={handleStudentSelect}
              >
                {students?.map((item) => {
                  const student = item.student || item;
                  return (
                    <Option key={student.id} value={student.id}>
                      {student?.user?.name || student.name} {(student?.user?.rollNumber || student.rollNumber) ? `(${student?.user?.rollNumber || student.rollNumber})` : ''}
                    </Option>
                  );
                })}
              </Select>
            </Form.Item>
            {internshipDateError && (
              <Alert
                message="Cannot Log Visit"
                description={internshipDateError}
                type="error"
                showIcon
                className="mb-4"
              />
            )}
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="visitType"
              label="Visit Type"
              rules={[{ required: true, message: 'Please select visit type' }]}
            >
              <Select
                placeholder="Select visit type"
                onChange={handleVisitTypeChange}
              >
                <Option value="PHYSICAL">Physical Visit</Option>
                {/* <Option value="VIRTUAL">Virtual Visit</Option>
                <Option value="PHONE">Phone</Option> */}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="status"
              label="Status"
              rules={[{ required: true, message: 'Please select status' }]}
            >
              <Select placeholder="Select status" onChange={handleStatusChange}>
                <Option value="COMPLETED">Completed</Option>
                <Option value="DRAFT">Draft</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        {/* Location - Required for Physical Visits */}
        {visitType === 'PHYSICAL' && (
          <>
            <Form.Item
              name="visitLocation"
              label="Location"
              rules={[physicalLocationRule]}
            >
              <Space.Compact style={SPACE_COMPACT_STYLE}>
                <Input
                  placeholder="Use GPS button to capture location"
                  prefix={<EnvironmentOutlined />}
                  readOnly
                />
                <Button
                  type="primary"
                  icon={<EnvironmentOutlined />}
                  onClick={captureLocation}
                  loading={capturing}
                >
                  {capturing ? 'Capturing...' : 'GPS'}
                </Button>
              </Space.Compact>
            </Form.Item>

            {location && (
              <Alert
                title="GPS Location Captured"
                description={
                  <div className="text-xs">
                    <div>Latitude: {location.latitude.toFixed(6)}</div>
                    <div>Longitude: {location.longitude.toFixed(6)}</div>
                    <div>Accuracy: {location.accuracy.toFixed(2)} meters</div>
                  </div>
                }
                type="success"
                showIcon
                className="mb-4"
              />
            )}
          </>
        )}

        {/* Project Information */}
        <Divider orientation="left" className="text-sm! my-2!">
          Project Information
        </Divider>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="titleOfProjectWork" label="Title of Project/Work" rules={[{ required: isCompletedStatus, message: 'Please enter project title' }]}>
              <Input
                placeholder="Enter the title of the project or work..."
                maxLength={200}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="assistanceRequiredFromInstitute" label="Assistance Required from Institute" rules={[{ required: isCompletedStatus, message: 'Please describe assistance required' }]}>
              <TextArea
                rows={2}
                placeholder="Describe any assistance required..."
                maxLength={500}
                showCount
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="responseFromOrganisation" label="Response from Organisation" rules={[{ required: isCompletedStatus, message: 'Please enter organisation response' }]}>
              <TextArea
                rows={2}
                placeholder="Enter response from organisation..."
                maxLength={500}
                showCount
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="remarksOfOrganisationSupervisor" label="Remarks of Organisation Supervisor" rules={[{ required: isCompletedStatus, message: 'Please enter supervisor remarks' }]}>
              <TextArea
                rows={2}
                placeholder="Enter supervisor remarks..."
                maxLength={500}
                showCount
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="significantChangeInPlan" label="Any Significant Change with Respect to the Plan of Project/Work" rules={[{ required: isCompletedStatus, message: 'Please describe significant changes' }]}>
          <TextArea
            rows={2}
            placeholder="Describe any significant changes in the project plan..."
            maxLength={500}
            showCount
          />
        </Form.Item>

        {/* Observations & Feedback */}
        <Divider orientation="left" className="text-sm! my-2!">
          Observations & Feedback
        </Divider>

        <Form.Item
          name="observationsAboutStudent"
          label="Observations about the Student"
          extra="Please provide at least 25 words"
          rules={[minWordsRule('Observations', isCompletedStatus)]}
        >
          <TextArea
            rows={4}
            placeholder="Enter your observations about the student (at least 25 words)..."
            maxLength={2000}
            showCount
          />
        </Form.Item>

        <Form.Item
          name="feedbackSharedWithStudent"
          label="Feedback Shared with Student"
          rules={[minWordsRule('Feedback', isCompletedStatus)]}
        >
          <TextArea
            rows={2}
            placeholder="Enter feedback shared with student..."
            maxLength={2000}
            showCount
          />
        </Form.Item>

        {/* Photo Upload Section */}
        <Divider orientation="left" className="text-sm! my-2!">
          Attachments
        </Divider>

        <Form.Item label="Photos (Optional)">
          <Upload
            listType="picture-card"
            fileList={fileList}
            onChange={handleFileChange}
            beforeUpload={beforeUpload}
            multiple
            maxCount={5}
            accept="image/*"
            onPreview={(file) => {
              const src = file.url || URL.createObjectURL(file.originFileObj);
              const imgWindow = window.open(src);
              imgWindow?.document.write(`<img src="${src}" style="width: 100%;" />`);
            }}
          >
            {fileList.length >= 5 ? null : uploadButton}
          </Upload>
          <div className="text-gray-500 text-xs mt-2">
            Upload up to 5 photos. Max 5MB per photo.
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
});

QuickVisitModal.displayName = 'QuickVisitModal';

QuickVisitModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  students: PropTypes.array,
  loading: PropTypes.bool,
};

QuickVisitModal.defaultProps = {
  students: [],
  loading: false,
};

export default QuickVisitModal;
