import React, { useEffect, useState } from 'react';
import { Form, Input, Select, DatePicker, Button, Row, Col, Upload, Spin, Modal, Divider, theme } from 'antd';
import { toast } from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { createStudent, updateStudent, fetchStudents } from '../store/principalSlice';
import { UploadOutlined, SaveOutlined, UserOutlined, PhoneOutlined, MailOutlined, HomeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useLookup } from '../../shared/hooks/useLookup';
import { getImageUrl, getPresignedUrl } from '../../../utils/imageUtils';
import principalService from '../../../services/principal.service';

const StudentModal = ({ open, onClose, studentId, onSuccess }) => {
  const dispatch = useDispatch();
  const { token } = theme.useToken();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);

  const { students } = useSelector(state => state.principal);
  const student = studentId ? students.list?.find(s => s.id === studentId) : null;
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
          // Only fetch student data if editing and student not in list
          if (studentId && !student) {
            await dispatch(fetchStudents({}));
          }
        } finally {
          setInitialLoading(false);
        }
      };
      loadData();
    }
  }, [dispatch, studentId, student, open]);

  useEffect(() => {
    const setFormValues = async () => {
      if (open && student) {
        let profileImageValue = undefined;
        if (student.profileImage) {
          if (typeof student.profileImage === 'string') {
            let urlToDisplay = student.profileImage;

            try {
              // Logic to resolve presigned URL, similar to ProfileAvatar
              if (urlToDisplay.startsWith('http')) {
                if (urlToDisplay.includes('minio') || urlToDisplay.includes('127.0.0.1:9000') || urlToDisplay.includes('cms-uploads')) {
                  urlToDisplay = await getPresignedUrl(urlToDisplay);
                }
              } else {
                // Relative path
                const fullUrl = getImageUrl(urlToDisplay);
                urlToDisplay = await getPresignedUrl(fullUrl);
              }
            } catch (err) {
              console.error('Failed to resolve profile image URL:', err);
              // Fallback to basic URL generation if presigning fails
              if (!urlToDisplay.startsWith('http')) {
                urlToDisplay = getImageUrl(urlToDisplay);
              }
            }

            profileImageValue = [{
              uid: '-1',
              name: 'Profile Image',
              status: 'done',
              url: urlToDisplay,
            }];
          } else if (Array.isArray(student.profileImage)) {
            profileImageValue = student.profileImage;
          }
        }

        // Fetch unmasked contact details for edit form
        let unmaskedEmail = student?.user?.email || student.email;
        let unmaskedPhone = student?.user?.phoneNo || student.contact || student.phoneNo;

        // Check if values are masked (contain asterisks)
        const isMasked = (value) => value && typeof value === 'string' && value.includes('*');

        if (studentId && (isMasked(unmaskedEmail) || isMasked(unmaskedPhone))) {
          try {
            const unmaskedData = await principalService.getUnmaskedContactDetails(studentId);
            if (unmaskedData) {
              unmaskedEmail = unmaskedData.email || unmaskedEmail;
              unmaskedPhone = unmaskedData.phoneNo || unmaskedPhone;
            }
          } catch (err) {
            console.error('Failed to fetch unmasked contact details:', err);
          }
        }

        form.setFieldsValue({
          // Student-specific fields
          admissionType: student.admissionType,
          category: student.category,
          batchId: student.batchId || student.batch?.id,
          branchId: student.branchId || student.branch?.id,
          currentYear: student.currentYear,
          currentSemester: student.currentSemester,
          clearanceStatus: student.clearanceStatus,
          parentName: student.parentName,
          parentContact: student.parentContact,
          motherName: student.motherName,
          gender: student.gender,
          address: student.address,
          city: student.city,
          state: student.state,
          district: student.district,
          tehsil: student.tehsil,
          pinCode: student.pinCode,
          // User fields - use unmasked values
          name: student?.user?.name || student.name,
          email: unmaskedEmail,
          rollNumber: student?.user?.rollNumber || student.rollNumber,
          contact: unmaskedPhone,
          dob: student?.user?.dob ? dayjs(student?.user?.dob) : (student.dob ? dayjs(student.dob) : null),
          profileImage: profileImageValue,
        });
      } else if (open && !isEditMode) {
        form.resetFields();
      }
    };

    setFormValues();
  }, [student, form, open, isEditMode]);

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const formattedValues = {
        ...values,
        dob: values.dob ? values.dob.format('YYYY-MM-DD') : null,
        dateOfBirth: values.dob ? values.dob.format('YYYY-MM-DD') : null,
      };

      // Remove profileImage from values if it's not a new file
      if (formattedValues.profileImage && Array.isArray(formattedValues.profileImage)) {
        const hasNewFile = formattedValues.profileImage.some(f => f.originFileObj);
        if (!hasNewFile) {
          delete formattedValues.profileImage;
        }
      }

      if (isEditMode) {
        await dispatch(updateStudent({ id: studentId, data: formattedValues })).unwrap();
        toast.success('Student updated successfully');
      } else {
        await dispatch(createStudent(formattedValues)).unwrap();
        toast.success('Student created successfully');
      }
      handleClose();
      onSuccess?.();
    } catch (error) {
      toast.error(error?.message || error || 'Operation failed');
    } finally {
      setLoading(false);
    }
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
      title={isEditMode ? 'Edit Student' : 'Add New Student'}
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
        <Form form={form} layout="vertical" onFinish={onFinish} style={{ maxHeight: '70vh', overflowY: 'auto', padding: '0 8px' }}>
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
              <Form.Item
                name="profileImage"
                label="Profile Image"
                valuePropName="fileList"
                getValueFromEvent={normFile}
              >
                <Upload beforeUpload={() => false} maxCount={1} accept="image/*" listType="picture">
                  <Button icon={<UploadOutlined />}>Click to Upload</Button>
                </Upload>
              </Form.Item>
            </Col>
          </Row>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 16, borderTop: `1px solid ${token.colorBorderSecondary}`, marginTop: 16, position: 'sticky', bottom: 0, backgroundColor: token.colorBgContainer, paddingBottom: 8 }}>
            <Button onClick={handleClose}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
              {isEditMode ? 'Update Student' : 'Create Student'}
            </Button>
          </div>
        </Form>
      )}
    </Modal>
  );
};

export default StudentModal;
