import React, { useEffect, useState } from 'react';
import { Form, Input, Select, DatePicker, Button, Row, Col, Upload, Spin, Modal, Divider, Avatar, Image, theme } from 'antd';
import { toast } from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { updateStudent, fetchAssignedStudents, selectStudents } from '../store/facultySlice';
import { UploadOutlined, SaveOutlined, UserOutlined, PhoneOutlined, MailOutlined, HomeOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useLookup } from '../../shared/hooks/useLookup';
import { getImageUrl, getPresignedUrl } from '../../../utils/imageUtils';
import { facultyService } from '../../../services/faculty.service';

const FacultyStudentModal = ({ open, onClose, studentId, studentData: propStudentData, onSuccess }) => {
  const dispatch = useDispatch();
  const { token } = theme.useToken();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);

  // Profile image state
  const [profileImageUrl, setProfileImageUrl] = useState(null);
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState('');

  // Use faculty students state as fallback
  const studentsState = useSelector(selectStudents);
  const studentsList = studentsState?.list || [];

  // Find student in the faculty's assigned students list if not provided via props
  const foundStudent = studentId && !propStudentData ? studentsList.find(s => {
    // Handle both nested structure (s.student) and flat structure
    const stud = s.student || s;
    const id = stud.id || s.id;
    return id === studentId;
  }) : null;

  // Get the actual student object - prefer prop, then found, handle nested structure
  const studentData = propStudentData || foundStudent?.student || foundStudent;
  const isEditMode = !!studentId;

  // Use global lookup data
  const { activeBatches, activeBranches, isLoading: lookupLoading } = useLookup({
    include: ['batches', 'branches']
  });

  useEffect(() => {
    if (open) {
      const loadData = async () => {
        setInitialLoading(true);
        try {
          // Only fetch students if editing and student not in list
          if (studentId && !studentData) {
            await dispatch(fetchAssignedStudents({ forceRefresh: true }));
          }
        } finally {
          setInitialLoading(false);
        }
      };
      loadData();
    }
  }, [dispatch, studentId, studentData, open]);

  useEffect(() => {
    const setFormValues = async () => {
      if (open && studentData) {
        // Load profile image URL from MinIO
        if (studentData.profileImage) {
          try {
            let urlToDisplay = studentData.profileImage;

            if (typeof urlToDisplay === 'string') {
              // Logic to resolve presigned URL for MinIO
              if (urlToDisplay.startsWith('http')) {
                if (urlToDisplay.includes('minio') || urlToDisplay.includes('127.0.0.1:9000') || urlToDisplay.includes('cms-uploads')) {
                  urlToDisplay = await getPresignedUrl(urlToDisplay);
                }
              } else {
                // Relative path
                const fullUrl = getImageUrl(urlToDisplay);
                urlToDisplay = await getPresignedUrl(fullUrl);
              }
              setProfileImageUrl(urlToDisplay);
            }
          } catch (err) {
            console.error('Failed to resolve profile image URL:', err);
            // Fallback to basic URL generation if presigning fails
            const fallbackUrl = studentData.profileImage.startsWith('http')
              ? studentData.profileImage
              : getImageUrl(studentData.profileImage);
            setProfileImageUrl(fallbackUrl);
          }
        } else {
          setProfileImageUrl(null);
        }

        // Fetch unmasked contact details for edit form
        let unmaskedEmail = studentData?.user?.email || studentData.email;
        let unmaskedPhone = studentData?.user?.phoneNo || studentData.contact || studentData.phoneNo;

        // Check if values are masked (contain asterisks)
        const isMasked = (value) => value && typeof value === 'string' && value.includes('*');

        if (studentId && (isMasked(unmaskedEmail) || isMasked(unmaskedPhone))) {
          try {
            const unmaskedData = await facultyService.getUnmaskedContactDetails(studentId);
            if (unmaskedData) {
              unmaskedEmail = unmaskedData.email || unmaskedEmail;
              unmaskedPhone = unmaskedData.phoneNo || unmaskedPhone;
            }
          } catch (err) {
            console.error('Failed to fetch unmasked contact details:', err);
          }
        }

        // Set form values (without profileImage - we handle it separately)
        // Extract user fields and student fields properly
        form.setFieldsValue({
          // Student-specific fields
          admissionType: studentData.admissionType,
          category: studentData.category,
          batchId: studentData.batchId || studentData.batch?.id,
          branchId: studentData.branchId || studentData.branch?.id,
          currentYear: studentData.currentYear,
          currentSemester: studentData.currentSemester,
          clearanceStatus: studentData.clearanceStatus,
          parentName: studentData.parentName,
          parentContact: studentData.parentContact,
          motherName: studentData.motherName,
          gender: studentData.gender,
          address: studentData.address,
          city: studentData.city,
          state: studentData.state,
          district: studentData.district,
          tehsil: studentData.tehsil,
          pinCode: studentData.pinCode,
          // User fields - use unmasked values
          name: studentData?.user?.name || studentData.name,
          email: unmaskedEmail,
          rollNumber: studentData?.user?.rollNumber || studentData.rollNumber,
          contact: unmaskedPhone,
          dob: (studentData?.user?.dob || studentData.dob) ? dayjs(studentData?.user?.dob || studentData.dob) : null,
        });
      } else if (open && !isEditMode) {
        form.resetFields();
        setProfileImageUrl(null);
        setProfileImageFile(null);
      }
    };

    setFormValues();
  }, [studentData, form, open, isEditMode, studentId]);

  const handleClose = () => {
    form.resetFields();
    setProfileImageUrl(null);
    setProfileImageFile(null);
    onClose();
  };

  // Handle profile image preview
  const handlePreview = async () => {
    if (profileImageUrl) {
      setPreviewImage(profileImageUrl);
      setPreviewOpen(true);
    } else if (profileImageFile) {
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewImage(reader.result);
        setPreviewOpen(true);
      };
      reader.readAsDataURL(profileImageFile);
    }
  };

  // Handle profile image change
  const handleImageChange = (info) => {
    const file = info.file.originFileObj || info.file;
    if (file) {
      // Validate file size (max 500KB)
      if (file.size > 500 * 1024) {
        toast.error('Image must be less than 500KB');
        return;
      }
      setProfileImageFile(file);
      // Create preview URL
      const reader = new FileReader();
      reader.onload = () => {
        setProfileImageUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove profile image
  const handleRemoveImage = () => {
    setProfileImageFile(null);
    setProfileImageUrl(null);
  };

  const onFinish = async (values) => {
    if (!studentId) {
      toast.error('Student ID is missing');
      return;
    }

    setLoading(true);
    try {
      const formattedValues = {
        ...values,
        dob: values.dob ? values.dob.format('YYYY-MM-DD') : null,
      };

      // Remove profileImage from form values - we handle it separately
      delete formattedValues.profileImage;
      // Remove dateOfBirth if it exists (we only use dob)
      delete formattedValues.dateOfBirth;

      // Upload profile image if a new file was selected
      if (profileImageFile) {
        setUploadingImage(true);
        try {
          const uploadResult = await facultyService.uploadStudentDocument(
            studentId,
            profileImageFile,
            'profile' // Use correct document type
          );
          // Add the new profile image URL to the update data
          if (uploadResult?.fileUrl || uploadResult?.data?.fileUrl) {
            formattedValues.profileImage = uploadResult.fileUrl || uploadResult.data.fileUrl;
          }
        } catch (uploadError) {
          console.error('Profile image upload failed:', uploadError);
          toast('Profile image upload failed, but other data will be saved', { icon: '⚠️' });
        } finally {
          setUploadingImage(false);
        }
      }

      // Use faculty updateStudent action
      const result = await dispatch(updateStudent({ id: studentId, data: formattedValues })).unwrap();
      toast.success('Student updated successfully');

      // Pass the updated data to parent for optimistic update
      const updatedData = result?.data || formattedValues;
      handleClose();
      onSuccess?.(updatedData);
    } catch (error) {
      console.error('Update error:', error);
      toast.error(error?.message || error || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const onFinishFailed = (errorInfo) => {
    console.log('Form validation failed:', errorInfo);
    toast.error('Please fill in all required fields');
  };

  const normFile = (e) => {
    if (Array.isArray(e)) {
      return e;
    }
    return e?.fileList;
  };

  // Category options matching schema
  const categoryOptions = [
    { value: 'GENERAL', label: 'General' },
    { value: 'OBC', label: 'OBC' },
    { value: 'SC', label: 'SC' },
    { value: 'ST', label: 'ST' },
  ];

  // Admission type options matching schema
  const admissionTypeOptions = [
    { value: 'FIRST_YEAR', label: 'First Year' },
    { value: 'LEET', label: 'LEET' },
  ];

  // Gender options
  const genderOptions = [
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
    { value: 'Other', label: 'Other' },
  ];

  // Clearance status options
  const clearanceStatusOptions = [
    { value: 'PENDING', label: 'Pending' },
    { value: 'CLEARED', label: 'Cleared' },
    { value: 'HOLD', label: 'Hold' },
    { value: 'REJECTED', label: 'Rejected' },
  ];

  return (
    <Modal
      title="Edit Student"
      open={open}
      onCancel={handleClose}
      footer={null}
      width={900}
      centered
      destroyOnClose
      transitionName=""
      maskTransitionName=""
    >
      {initialLoading || lookupLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : (
        <Form form={form} layout="vertical" onFinish={onFinish} onFinishFailed={onFinishFailed} style={{ maxHeight: '70vh', overflowY: 'auto', padding: '0 8px' }}>
          <Divider plain><span style={{ color: token.colorPrimary, fontWeight: 500 }}>Personal Information</span></Divider>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="name"
                label="Name"
                rules={[{ required: true, message: 'Please enter full name' }]}
              >
                <Input prefix={<UserOutlined style={{ color: token.colorTextDisabled }} />} placeholder="Enter full name" />
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
                <Input prefix={<MailOutlined style={{ color: token.colorTextDisabled }} />} placeholder="Enter email" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="contact"
                label="Contact"
                rules={[
                  { required: true, message: 'Please enter contact number' },
                  { pattern: /^\+?[0-9]{10,15}$/, message: 'Please enter valid phone number (10-15 digits)' }
                ]}
              >
                <Input prefix={<PhoneOutlined style={{ color: token.colorTextDisabled }} />} placeholder="Enter contact number" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="rollNumber"
                label="Roll Number"
                rules={[{ required: true, message: 'Please enter roll number' }]}
              >
                <Input prefix={<UserOutlined style={{ color: token.colorTextDisabled }} />} placeholder="Enter roll number" />
              </Form.Item>
            </Col>
          </Row>

          <Divider plain><span style={{ color: token.colorPrimary, fontWeight: 500 }}>Academic Information</span></Divider>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="admissionType"
                label="Admission Type"
                rules={[{ required: true, message: 'Please select admission type' }]}
              >
                <Select placeholder="Select admission type" options={admissionTypeOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="category"
                label="Category"
                rules={[{ required: true, message: 'Please select category' }]}
              >
                <Select placeholder="Select category" options={categoryOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="batchId" label="Batch">
                <Select placeholder="Select batch" allowClear>
                  {activeBatches?.map(batch => (
                    <Select.Option key={batch.id} value={batch.id}>
                      {batch.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="branchId" label="Branch">
                <Select placeholder="Select branch" allowClear>
                  {activeBranches?.map(branch => (
                    <Select.Option key={branch.id} value={branch.id}>
                      {branch.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="currentYear" label="Current Year">
                <Select placeholder="Select year" allowClear>
                  {[1, 2, 3, 4].map(year => (
                    <Select.Option key={year} value={year}>
                      Year {year}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="currentSemester" label="Current Semester">
                <Select placeholder="Select semester" allowClear>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                    <Select.Option key={sem} value={sem}>
                      Semester {sem}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="clearanceStatus" label="Clearance Status">
                <Select placeholder="Select status" options={clearanceStatusOptions} allowClear />
              </Form.Item>
            </Col>
          </Row>

          <Divider plain><span style={{ color: token.colorPrimary, fontWeight: 500 }}>Parent/Guardian Information</span></Divider>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="parentName"
                label="Parent Name"
                rules={[{ required: true, message: 'Please enter parent name' }]}
              >
                <Input prefix={<UserOutlined style={{ color: token.colorTextDisabled }} />} placeholder="Enter parent name" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="parentContact"
                label="Parent Contact"
                rules={[
                  { required: true, message: 'Please enter parent contact' },
                  { pattern: /^\+?[0-9]{10,15}$/, message: 'Please enter valid phone number (10-15 digits)' }
                ]}
              >
                <Input prefix={<PhoneOutlined style={{ color: token.colorTextDisabled }} />} placeholder="Enter parent contact" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="motherName" label="Mother Name">
                <Input prefix={<UserOutlined style={{ color: token.colorTextDisabled }} />} placeholder="Enter mother name" />
              </Form.Item>
            </Col>
          </Row>

          <Divider plain><span style={{ color: token.colorPrimary, fontWeight: 500 }}>Personal Details</span></Divider>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="gender"
                label="Gender"
                rules={[{ required: true, message: 'Please select gender' }]}
              >
                <Select placeholder="Select gender" options={genderOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="dob" label="Date of Birth">
                <DatePicker
                  style={{ width: '100%' }}
                  format="DD/MM/YYYY"
                  placeholder="Select date of birth"
                  disabledDate={(current) => current && current > dayjs().endOf('day')}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider plain><span style={{ color: token.colorPrimary, fontWeight: 500 }}>Address Information</span></Divider>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="pinCode"
                label="Pin Code"
                rules={[
                  { required: true, message: 'Please enter pin code' },
                  { pattern: /^[0-9]{6}$/, message: 'Please enter valid 6-digit pin code' }
                ]}
              >
                <Input placeholder="Enter pin code" maxLength={6} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="address"
                label="Address"
                rules={[{ required: true, message: 'Please enter address' }]}
              >
                <Input prefix={<HomeOutlined style={{ color: token.colorTextDisabled }} />} placeholder="Enter address" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="city"
                label="City/Village"
                rules={[{ required: true, message: 'Please enter city/village' }]}
              >
                <Input placeholder="Enter city/village" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="state"
                label="State"
                rules={[{ required: true, message: 'Please enter state' }]}
              >
                <Input placeholder="Enter state" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="tehsil"
                label="Tehsil"
                rules={[{ required: true, message: 'Please enter tehsil' }]}
              >
                <Input placeholder="Enter tehsil" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="district"
                label="District"
                rules={[{ required: true, message: 'Please enter district' }]}
              >
                <Input placeholder="Enter district" />
              </Form.Item>
            </Col>
          </Row>

          <Divider plain><span style={{ color: token.colorPrimary, fontWeight: 500 }}>Profile Image</span></Divider>

          <Row gutter={16}>
            <Col xs={24}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {/* Current Profile Image Preview */}
                {profileImageUrl && (
                  <div style={{ position: 'relative' }}>
                    <Image
                      src={profileImageUrl}
                      alt="Profile"
                      width={100}
                      height={100}
                      style={{ borderRadius: token.borderRadiusLG, objectFit: 'cover', border: `2px solid ${token.colorBorderSecondary}` }}
                      fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgesAIpvN4AAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAwqADAAQAAAABAAAAwwAAAABtNcJRAAAA/klEQVR4Ae3XAQ0AAADCMPV/egQJ+9kAQdIAAAAAdKsUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU8P8AhQoVKlSoUKFChQoVKlSoUKFChQoVKlSoUKFChQoVKlSoUKFChQoVKlSoUKFChQoVKlSoUKFChQoVKlSoUKFChQoVKlSoUKFChQoVKlSoUKFChQoVKlSoUKFChQoVKlSoUKFChQoVKlSoUKFChQoVKlSoUI0KKQNWv6+dZgAAAABJRU5ErkJggg=="
                      preview={{
                        mask: <span style={{ color: '#fff', fontSize: 12 }}>Preview</span>,
                      }}
                    />
                    <Button
                      type="text"
                      danger
                      size="small"
                      style={{ position: 'absolute', top: -8, right: -8, backgroundColor: token.colorBgContainer, borderRadius: '50%', boxShadow: token.boxShadow }}
                      onClick={handleRemoveImage}
                    >
                      ×
                    </Button>
                  </div>
                )}

                {/* Upload Button */}
                <Upload
                  beforeUpload={() => false}
                  showUploadList={false}
                  accept="image/*"
                  onChange={handleImageChange}
                  maxCount={1}
                >
                  <Button
                    icon={profileImageUrl ? <UploadOutlined /> : <PlusOutlined />}
                    loading={uploadingImage}
                    style={{ borderRadius: token.borderRadiusLG }}
                  >
                    {profileImageUrl ? 'Change Image' : 'Upload Image'}
                  </Button>
                </Upload>

                <span style={{ color: token.colorTextDescription, fontSize: 12 }}>Max 500KB, JPG/PNG</span>
              </div>
            </Col>
          </Row>

          {/* Image Preview Modal */}
          <Modal
            open={previewOpen}
            title="Profile Image Preview"
            footer={null}
            onCancel={() => setPreviewOpen(false)}
            centered
            destroyOnClose
            transitionName=""
            maskTransitionName=""
          >
            <img alt="Preview" style={{ width: '100%' }} src={previewImage} />
          </Modal>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 16, borderTop: `1px solid ${token.colorBorderSecondary}`, marginTop: 16, position: 'sticky', bottom: 0, backgroundColor: token.colorBgContainer, paddingBottom: 8 }}>
            <Button onClick={handleClose}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
              Update Student
            </Button>
          </div>
        </Form>
      )}
    </Modal>
  );
};

export default FacultyStudentModal;