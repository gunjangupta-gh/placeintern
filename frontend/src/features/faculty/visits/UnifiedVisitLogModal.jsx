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
  Alert,
  DatePicker,
  Row,
  Col,
  Tooltip,
  Tag,
  Typography,
  Card,
  Switch,
} from 'antd';
import { toast } from 'react-hot-toast';
import {
  EnvironmentOutlined,
  UploadOutlined,
  PlusOutlined,
  SaveOutlined,
  CameraOutlined,
  LockOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { createVisitLog, updateVisitLog, selectVisitLogs, uploadVisitDocument } from '../store/facultySlice';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

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

const VISIT_TYPES = [
  { value: 'PHYSICAL', label: 'Physical' },
  // { value: 'VIRTUAL', label: 'Virtual' },
  // { value: 'PHONE', label: 'Phone' },
];

const physicalLocationRule = {
  validator: (_, value) => {
    const trimmed = (value || '').trim();
    return trimmed
      ? Promise.resolve()
      : Promise.reject(new Error('Please enter visit location for physical visits'));
  },
};

const STATUS_OPTIONS = [
  { value: 'COMPLETED', label: 'Completed', color: 'green' },
  { value: 'DRAFT', label: 'Draft', color: 'orange' },
];

const UnifiedVisitLogModal = ({
  visible,
  onClose,
  onSuccess,
  students = [],
  loading = false,
  selectedStudent = null,
  visitLogId = null,
  existingData = null,
}) => {
  const dispatch = useDispatch();
  const { loading: visitLogsLoading, list: visitLogs = [] } = useSelector(selectVisitLogs);

  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [visitType, setVisitType] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [gpsLocation, setGpsLocation] = useState(null);
  const [photoList, setPhotoList] = useState([]);
  const [signedDocList, setSignedDocList] = useState([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadingSignedDoc, setUploadingSignedDoc] = useState(false);
  const [selectedInternship, setSelectedInternship] = useState(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState(null);
  const [visitStatus, setVisitStatus] = useState('COMPLETED');
  const [guidanceAcknowledged, setGuidanceAcknowledged] = useState(false);
  const onCloseRef = useRef(onClose);

  const isEdit = !!visitLogId;
  const isCompletedStatus = visitStatus === 'COMPLETED';

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

  useEffect(() => {
    if (!visible) return;

    form.resetFields();
    setVisitType(null);
    setGpsLocation(null);
    setPhotoList([]);
    setSignedDocList([]);
    setSelectedInternship(null);
    setSelectedApplicationId(null);
    setVisitStatus('COMPLETED');

    if (selectedStudent) {
      const studentId = (selectedStudent.student || selectedStudent).id;
      form.setFieldsValue({ studentId });
      const found = students.find(s => s.student?.id === studentId || s.id === studentId);
      if (found) {
        const applications = found.internshipApplications || found.student?.internshipApplications || [];
        if (applications.length > 0) {
          setSelectedApplicationId(applications[0].id);
          setSelectedInternship({
            companyName: applications[0].companyName || applications[0].internship?.industry?.companyName || 'N/A',
            location: applications[0].companyAddress || applications[0].internship?.industry?.address || '',
          });
        }
      }
    }

    if (existingData) {
      const studentId = existingData.application?.student?.id;
      const normalizedVisitType = normalizeVisitType(existingData.visitType);
      form.setFieldsValue({
        studentId,
        visitDate: existingData.visitDate ? dayjs(existingData.visitDate) : dayjs(),
        visitType: normalizedVisitType,
        visitLocation: existingData.visitLocation,
        titleOfProjectWork: existingData.titleOfProjectWork,
        assistanceRequiredFromInstitute: existingData.assistanceRequiredFromInstitute,
        responseFromOrganisation: existingData.responseFromOrganisation,
        remarksOfOrganisationSupervisor: existingData.remarksOfOrganisationSupervisor,
        significantChangeInPlan: existingData.significantChangeInPlan,
        observationsAboutStudent: existingData.observationsAboutStudent,
        feedbackSharedWithStudent: existingData.feedbackSharedWithStudent,
        status: existingData.status || 'COMPLETED',
        nextVisitDate: existingData.nextVisitDate ? dayjs(existingData.nextVisitDate) : null,
        followUpRequired: existingData.followUpRequired || false,
      });
      setVisitStatus(existingData.status || 'COMPLETED');
      setVisitType(normalizedVisitType);
      if (existingData.latitude && existingData.longitude) {
        setGpsLocation({ latitude: existingData.latitude, longitude: existingData.longitude, accuracy: existingData.gpsAccuracy });
      }
      if (existingData.applicationId) setSelectedApplicationId(existingData.applicationId);
      if (existingData.application?.internship?.industry) {
        setSelectedInternship({
          companyName: existingData.application.internship.industry.companyName || 'N/A',
          location: existingData.application.internship.industry.address || existingData.application.internship.industry.city || '',
        });
      }
      if (existingData.visitPhotos?.length > 0) {
        setPhotoList(existingData.visitPhotos.map((url, idx) => ({ uid: `existing-${idx}`, name: `Photo ${idx + 1}`, status: 'done', url })));
      }
      if (existingData.signedDocumentUrl) {
        setSignedDocList([{ uid: 'existing-signed-doc', name: 'Signed Document', status: 'done', url: existingData.signedDocumentUrl }]);
      }
    } else {
      form.setFieldsValue({ visitDate: dayjs(), status: 'COMPLETED' });
      setVisitStatus('COMPLETED');
    }
  }, [visible, selectedStudent, existingData, form]);

  useEffect(() => {
    if (!visible || existingData || !selectedStudent || selectedApplicationId) return;

    const studentId = (selectedStudent.student || selectedStudent).id;
    const found = students.find(s => s.student?.id === studentId || s.id === studentId);
    if (!found) return;

    const applications = found.internshipApplications || found.student?.internshipApplications || [];
    if (applications.length > 0) {
      setSelectedApplicationId(applications[0].id);
      setSelectedInternship({
        companyName: applications[0].companyName || applications[0].internship?.industry?.companyName || 'N/A',
        location: applications[0].companyAddress || applications[0].internship?.industry?.address || '',
      });
    }
  }, [visible, existingData, selectedStudent, selectedApplicationId, students]);

  const handleStatusChange = useCallback((value) => {
    setVisitStatus(value || 'COMPLETED');
  }, []);

  const handleStudentSelect = useCallback((studentId) => {
    const assignment = students.find(s => s.id === studentId || s.student?.id === studentId);
    const studentData = assignment?.student || assignment;
    if (studentData) {
      const applications = assignment?.internshipApplications || studentData?.internshipApplications || [];
      if (applications.length > 0) {
        setSelectedApplicationId(applications[0].id);
        setSelectedInternship({
          companyName: applications[0].companyName || applications[0].internship?.industry?.companyName || 'N/A',
          location: applications[0].companyAddress || applications[0].internship?.industry?.address || '',
        });
      } else {
        setSelectedApplicationId(null);
        setSelectedInternship(null);
        toast('No active internship found', { icon: '⚠️' });
      }
    }
  }, [students]);

  const handleVisitTypeChange = (value) => {
    setVisitType(value);
    if (value !== 'PHYSICAL') {
      setGpsLocation(null);
      form.setFieldsValue({ visitLocation: '' });
    }
  };

  const captureGpsLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return;
    }
    setCapturing(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy };
        setGpsLocation(coords);
        form.setFieldsValue({ visitLocation: `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}` });
        toast.success('GPS captured');
        setCapturing(false);
      },
      (error) => {
        toast.error(error.code === 1 ? 'Location permission denied' : 'Failed to capture location');
        setCapturing(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handlePhotoChange = ({ fileList }) => setPhotoList(fileList.slice(0, 5));
  const beforePhotoUpload = (file) => {
    if (!file.type.startsWith('image/')) { toast.error('Images only!'); return Upload.LIST_IGNORE; }
    if (file.size / 1024 / 1024 >= 5) { toast.error('Max 5MB!'); return Upload.LIST_IGNORE; }
    return false;
  };

  const handleSignedDocChange = ({ fileList }) => setSignedDocList(fileList.slice(0, 1));
  const beforeSignedDocUpload = (file) => {
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'].includes(file.type)) { toast.error('Only JPEG, PNG, GIF, WebP or PDF files allowed!'); return Upload.LIST_IGNORE; }
    if (file.size / 1024 / 1024 >= 10) { toast.error('Max 10MB!'); return Upload.LIST_IGNORE; }
    return false;
  };

  const uploadFiles = async () => {
    const photoUrls = [];
    let signedDocUrl = null;
    if (photoList.length > 0) {
      setUploadingPhotos(true);
      try {
        for (const file of photoList) {
          if (file.originFileObj) {
            const result = await dispatch(uploadVisitDocument({ file: file.originFileObj, type: 'visit-photo' })).unwrap();
            photoUrls.push(result.url);
          } else if (file.url) { photoUrls.push(file.url); }
        }
      } catch (error) {
        console.error('Photo upload error:', error);
        toast.error(error?.message || 'Failed to upload photo. Please try again.');
        throw error;
      } finally {
        setUploadingPhotos(false);
      }
    }
    if (signedDocList.length > 0 && signedDocList[0].originFileObj) {
      setUploadingSignedDoc(true);
      try {
        const result = await dispatch(uploadVisitDocument({ file: signedDocList[0].originFileObj, type: 'visit-signed-document' })).unwrap();
        signedDocUrl = result.url;
      } catch (error) {
        console.error('Signed doc upload error:', error);
        toast.error(error?.message || 'Failed to upload signed document. Please try again.');
        throw error;
      } finally {
        setUploadingSignedDoc(false);
      }
    } else if (signedDocList.length > 0 && signedDocList[0].url) { signedDocUrl = signedDocList[0].url; }
    return { photoUrls, signedDocUrl };
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!isEdit && !selectedApplicationId) { toast.error('No active internship found'); return; }

      // Check if a visit has already been logged on the selected date for this application (only for new visits)
      if (!isEdit && selectedApplicationId) {
        const selectedDate = values.visitDate ? values.visitDate.toDate() : new Date();
        selectedDate.setHours(0, 0, 0, 0);
        const selectedDateEnd = new Date(selectedDate);
        selectedDateEnd.setHours(23, 59, 59, 999);

        const existingVisitOnDate = visitLogs.find((visit) => {
          if (visit.applicationId !== selectedApplicationId) return false;
          const visitDate = new Date(visit.visitDate);
          return visitDate >= selectedDate && visitDate <= selectedDateEnd;
        });

        if (existingVisitOnDate) {
          toast.error('You have already logged a visit for this student on this date. Only one visit per student per day is allowed.');
          return;
        }
      }

      setSubmitting(true);
      const { photoUrls, signedDocUrl } = await uploadFiles();
      const visitTypeValue = normalizeVisitType(values.visitType);

      // Common fields for both create and update
      const commonData = {
        status: values.status || 'COMPLETED',
        titleOfProjectWork: values.titleOfProjectWork || null,
        assistanceRequiredFromInstitute: values.assistanceRequiredFromInstitute || null,
        responseFromOrganisation: values.responseFromOrganisation || null,
        remarksOfOrganisationSupervisor: values.remarksOfOrganisationSupervisor || null,
        significantChangeInPlan: values.significantChangeInPlan || null,
        observationsAboutStudent: values.observationsAboutStudent || null,
        feedbackSharedWithStudent: values.feedbackSharedWithStudent || null,
        nextVisitDate: values.nextVisitDate ? values.nextVisitDate.toISOString() : null,
        followUpRequired: values.followUpRequired || false,
        ...(photoUrls.length > 0 && { visitPhotos: photoUrls }),
        ...(signedDocUrl && { signedDocumentUrl: signedDocUrl }),
      };

      if (isEdit) {
        // Update: only send editable fields (locked fields are excluded)
        await dispatch(updateVisitLog({ id: visitLogId, data: commonData })).unwrap();
        toast.success('Visit updated');
      } else {
        // Create: include all fields including locked ones
        const createData = {
          ...commonData,
          applicationId: selectedApplicationId,
          visitDate: values.visitDate.toISOString(),
          visitType: visitTypeValue,
          visitLocation: values.visitLocation || null,
          ...(gpsLocation && { latitude: gpsLocation.latitude, longitude: gpsLocation.longitude, gpsAccuracy: gpsLocation.accuracy }),
        };
        await dispatch(createVisitLog(createData)).unwrap();
        toast.success(values.status === 'DRAFT' ? 'Saved as draft' : 'Visit logged');
      }
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error(error?.message || 'Failed to save');
    } finally { setSubmitting(false); }
  };

  const SectionTitle = ({ children }) => (
    <Text strong className="text-xs uppercase tracking-wide text-gray-500 block mb-2">{children}</Text>
  );

  return (
    <Modal
      title={
        <Space>
          <CameraOutlined className="text-primary" />
          <span>{isEdit ? 'Edit Visit' : 'Log Visit'}</span>
          {isEdit && <Tag icon={<LockOutlined />} color="orange">Core fields locked</Tag>}
        </Space>
      }
      open={visible && guidanceAcknowledged}
      onCancel={onClose}
      width={720}
      destroyOnHidden
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto', padding: '12px 24px' } }}
      footer={
        <Space>
          <Button onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="primary" onClick={handleSubmit} loading={submitting || uploadingPhotos || uploadingSignedDoc} icon={<SaveOutlined />}>
            {isEdit ? 'Update' : 'Save'}
          </Button>
        </Space>
      }
    >
      <Alert
        message="Important: All Fields Required"
        description="Core fields are always required. For COMPLETED visits, all detailed sections are mandatory; for DRAFT visits, detailed sections are optional."
        type="info"
        showIcon
        closable
        className="mb-3"
      />
      <Alert
        message={isCompletedStatus ? 'Mentor Alert: Completed visit requires all mandatory details.' : 'Mentor Alert: Draft visit can be saved with partial details.'}
        type={isCompletedStatus ? 'warning' : 'success'}
        showIcon
        className="mb-3"
      />
      <Form form={form} layout="vertical" size="small" className="space-y-3">
        {/* Core Visit Info */}
        <Card size="small" className="mb-3!">
          <SectionTitle>Visit Details</SectionTitle>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="visitDate" label="Date & Time" rules={[{ required: true, message: 'Please select date & time' }]} className="mb-2!">
                <DatePicker showTime className="w-full" format="DD/MM/YY HH:mm" disabled={isEdit} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="visitType" label="Type" rules={[{ required: true, message: 'Please select visit type' }]} className="mb-2!">
                <Select placeholder="Select" onChange={handleVisitTypeChange} disabled={isEdit}>
                  {VISIT_TYPES.map(t => <Option key={t.value} value={t.value}>{t.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="Status" className="mb-2!">
                <Select onChange={handleStatusChange}>
                  {STATUS_OPTIONS.map(s => <Option key={s.value} value={s.value}><Tag color={s.color}>{s.label}</Tag></Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {(!selectedStudent || isEdit) && (
            <Form.Item name="studentId" label="Student" rules={[{ required: true, message: 'Please select student' }]} className="mb-2!">
              <Select placeholder="Select student" showSearch loading={loading} onChange={handleStudentSelect} disabled={isEdit}
                filterOption={(input, option) => option.children?.toLowerCase().includes(input.toLowerCase())}>
                {students?.map((student) => {
                  const s = student.student || student;
                  return <Option key={s.id} value={s.id}>{s.user?.name || s.name} ({s.user?.rollNumber || s.rollNumber})</Option>;
                })}
              </Select>
            </Form.Item>
          )}

          {selectedInternship && (
            <Alert message={<Space size="small"><Text strong>Company:</Text><Text>{selectedInternship.companyName}</Text>
              {selectedInternship.location && <><Text type="secondary">|</Text><EnvironmentOutlined /><Text type="secondary">{selectedInternship.location}</Text></>}
            </Space>} type="info" className="py-1!" />
          )}

          {visitType === 'PHYSICAL' && (
            <Form.Item name="visitLocation" label="Location" rules={[physicalLocationRule]} className="mb-0! mt-2!">
              <Space.Compact className="w-full">
                <Input placeholder="Use GPS button to capture location" prefix={<EnvironmentOutlined />} readOnly disabled={isEdit} />
                <Tooltip title={isEdit ? 'Locked' : 'Capture GPS'}>
                  <Button type="primary" icon={<EnvironmentOutlined />} onClick={captureGpsLocation} loading={capturing} disabled={isEdit} />
                </Tooltip>
              </Space.Compact>
            </Form.Item>
          )}
          {gpsLocation && (
            <Text type="success" className="text-xs">✓ GPS: {gpsLocation.latitude.toFixed(4)}, {gpsLocation.longitude.toFixed(4)} (±{gpsLocation.accuracy?.toFixed(0)}m)</Text>
          )}

          <Row gutter={12} className="mt-3!">
            <Col span={12}>
              <Form.Item name="nextVisitDate" label="Next Visit Date" className="mb-0!">
                <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Schedule next visit" suffixIcon={<CalendarOutlined />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="followUpRequired" label="Follow-up Required" valuePropName="checked" className="mb-0!">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Project Info */}
        <Card size="small" className="mb-3!">
          <SectionTitle>Project Information</SectionTitle>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="titleOfProjectWork" label="Project Title" rules={[{ required: isCompletedStatus, message: 'Please enter project title' }]} className="mb-2!">
                <Input placeholder="Title of project/work" maxLength={200} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="assistanceRequiredFromInstitute" label="Assistance Required" rules={[{ required: isCompletedStatus, message: 'Please enter assistance details' }]} className="mb-2!">
                <Input placeholder="Assistance from institute" maxLength={200} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="responseFromOrganisation" label="Org Response" rules={[{ required: isCompletedStatus, message: 'Please enter organisation response' }]} className="mb-2!">
                <Input placeholder="Response from organisation" maxLength={200} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="remarksOfOrganisationSupervisor" label="Supervisor Remarks" rules={[{ required: isCompletedStatus, message: 'Please enter supervisor remarks' }]} className="mb-2!">
                <Input placeholder="Supervisor remarks" maxLength={200} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="significantChangeInPlan" label="Changes in Plan" rules={[{ required: isCompletedStatus, message: 'Please describe changes in plan' }]} className="mb-0!">
            <Input placeholder="Any significant changes to project plan" maxLength={300} />
          </Form.Item>
        </Card>

        {/* Observations */}
        <Card size="small" className="mb-3!">
          <SectionTitle>Observations & Feedback</SectionTitle>
          <Form.Item
            name="observationsAboutStudent"
            label="Observations"
            rules={[minWordsRule('Observations', isCompletedStatus)]}
            className="mb-2!"
          >
            <TextArea rows={2} placeholder="Observations about student (min 25 words)" maxLength={2000} showCount />
          </Form.Item>
          <Form.Item
            name="feedbackSharedWithStudent"
            label="Feedback to Student"
            rules={[minWordsRule('Feedback', isCompletedStatus)]}
            className="mb-0!"
          >
            <TextArea rows={1} placeholder="Feedback shared with student (min 25 words)" maxLength={2000} />
          </Form.Item>
        </Card>

        {/* Attachments */}
        <Card size="small">
          <SectionTitle>Attachments</SectionTitle>
          <Row gutter={16}>
            <Col span={12}>
              <Text className="text-xs text-gray-500 block mb-1">Photos (max 5)</Text>
              <Upload listType="picture-card" fileList={photoList} onChange={handlePhotoChange} beforeUpload={beforePhotoUpload} multiple maxCount={5} accept="image/*">
                {photoList.length < 5 && <div><PlusOutlined /><div className="text-xs mt-1">Upload</div></div>}
              </Upload>
            </Col>
            <Col span={12}>
              <Text className="text-xs text-gray-500 block mb-1">Signed Document</Text>
              <Upload fileList={signedDocList} onChange={handleSignedDocChange} beforeUpload={beforeSignedDocUpload} maxCount={1} accept=".pdf,.jpg,.jpeg,.png">
                <Button icon={<UploadOutlined />} size="small">{signedDocList.length ? 'Replace' : 'Upload'}</Button>
              </Upload>
              <Text type="secondary" className="text-xs">PDF or image, max 10MB</Text>
            </Col>
          </Row>
        </Card>
      </Form>
    </Modal>
  );
};

export default UnifiedVisitLogModal;
