import React, { useState, useEffect, useCallback } from 'react';
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

const VISIT_TYPES = [
  { value: 'PHYSICAL', label: 'Physical' },
  { value: 'VIRTUAL', label: 'Virtual' },
  { value: 'TELEPHONIC', label: 'Telephonic' },
];

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
  const { loading: visitLogsLoading } = useSelector(selectVisitLogs);

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

  const isEdit = !!visitLogId;

  useEffect(() => {
    if (visible) {
      form.resetFields();
      setVisitType(null);
      setGpsLocation(null);
      setPhotoList([]);
      setSignedDocList([]);
      setSelectedInternship(null);
      setSelectedApplicationId(null);

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
        form.setFieldsValue({
          studentId,
          visitDate: existingData.visitDate ? dayjs(existingData.visitDate) : dayjs(),
          visitType: existingData.visitType,
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
        setVisitType(existingData.visitType);
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
      }
    }
  }, [visible, selectedStudent, existingData, form, students]);

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
        const result = await dispatch(uploadVisitDocument({ file: signedDocList[0].originFileObj, type: 'signed-visit-document' })).unwrap();
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
      setSubmitting(true);
      const { photoUrls, signedDocUrl } = await uploadFiles();

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
          visitType: values.visitType,
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
      open={visible}
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
      <Form form={form} layout="vertical" size="small" className="space-y-3">
        {/* Core Visit Info */}
        <Card size="small" className="!mb-3">
          <SectionTitle>Visit Details</SectionTitle>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="visitDate" label="Date & Time" rules={[{ required: true }]} className="!mb-2">
                <DatePicker showTime className="w-full" format="DD/MM/YY HH:mm" disabled={isEdit} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="visitType" label="Type" rules={[{ required: true }]} className="!mb-2">
                <Select placeholder="Select" onChange={handleVisitTypeChange} disabled={isEdit}>
                  {VISIT_TYPES.map(t => <Option key={t.value} value={t.value}>{t.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="Status" className="!mb-2">
                <Select>
                  {STATUS_OPTIONS.map(s => <Option key={s.value} value={s.value}><Tag color={s.color}>{s.label}</Tag></Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {(!selectedStudent || isEdit) && (
            <Form.Item name="studentId" label="Student" rules={[{ required: true }]} className="!mb-2">
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
            </Space>} type="info" className="!py-1" />
          )}

          {visitType === 'PHYSICAL' && (
            <Form.Item name="visitLocation" label="Location" className="!mb-0 !mt-2">
              <Space.Compact className="w-full">
                <Input placeholder="Location or GPS" prefix={<EnvironmentOutlined />} disabled={isEdit} />
                <Tooltip title={isEdit ? 'Locked' : 'Capture GPS'}>
                  <Button type="primary" icon={<EnvironmentOutlined />} onClick={captureGpsLocation} loading={capturing} disabled={isEdit} />
                </Tooltip>
              </Space.Compact>
            </Form.Item>
          )}
          {gpsLocation && (
            <Text type="success" className="text-xs">✓ GPS: {gpsLocation.latitude.toFixed(4)}, {gpsLocation.longitude.toFixed(4)} (±{gpsLocation.accuracy?.toFixed(0)}m)</Text>
          )}

          <Row gutter={12} className="!mt-3">
            <Col span={12}>
              <Form.Item name="nextVisitDate" label="Next Visit Date" className="!mb-0">
                <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Schedule next visit" suffixIcon={<CalendarOutlined />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="followUpRequired" label="Follow-up Required" valuePropName="checked" className="!mb-0">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Project Info */}
        <Card size="small" className="!mb-3">
          <SectionTitle>Project Information</SectionTitle>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="titleOfProjectWork" label="Project Title" className="!mb-2">
                <Input placeholder="Title of project/work" maxLength={200} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="assistanceRequiredFromInstitute" label="Assistance Required" className="!mb-2">
                <Input placeholder="Assistance from institute" maxLength={200} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="responseFromOrganisation" label="Org Response" className="!mb-2">
                <Input placeholder="Response from organisation" maxLength={200} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="remarksOfOrganisationSupervisor" label="Supervisor Remarks" className="!mb-2">
                <Input placeholder="Supervisor remarks" maxLength={200} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="significantChangeInPlan" label="Changes in Plan" className="!mb-0">
            <Input placeholder="Any significant changes to project plan" maxLength={300} />
          </Form.Item>
        </Card>

        {/* Observations */}
        <Card size="small" className="!mb-3">
          <SectionTitle>Observations & Feedback</SectionTitle>
          <Form.Item name="observationsAboutStudent" label="Observations" className="!mb-2">
            <TextArea rows={2} placeholder="Observations about student (min 100 words recommended)" maxLength={2000} showCount />
          </Form.Item>
          <Form.Item name="feedbackSharedWithStudent" label="Feedback to Student" className="!mb-0">
            <TextArea rows={1} placeholder="Feedback shared with student" maxLength={500} />
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
