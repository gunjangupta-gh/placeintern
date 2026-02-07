import React, { useState, useEffect } from 'react';
import {
  Card,
  Steps,
  Upload,
  Button,
  Table,
  Progress,
  Alert,
  Typography,
  Space,
  Row,
  Col,
  Tag,
  Statistic,
  Select,
} from 'antd';
import { toast } from 'react-hot-toast';
import {
  InboxOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  UploadOutlined,
  UserAddOutlined,
  MailOutlined,
  BankOutlined,
} from '@ant-design/icons';
import { bulkService } from '../../../services/bulk.service';
import { stateService } from '../../../services/state.service';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

const BulkUserCreate = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [file, setFile] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Institution selector state
  const [institutions, setInstitutions] = useState([]);
  const [selectedInstitution, setSelectedInstitution] = useState(null);
  const [loadingInstitutions, setLoadingInstitutions] = useState(false);

  // Fetch institutions on mount
  useEffect(() => {
    fetchInstitutions();
  }, []);

  const fetchInstitutions = async () => {
    setLoadingInstitutions(true);
    try {
      const response = await stateService.getInstitutions({ limit: 1000 });
      setInstitutions(response.data || response.institutions || []);
    } catch (error) {
      toast.error('Failed to fetch institutions');
    } finally {
      setLoadingInstitutions(false);
    }
  };

  // Step 0: Upload File
  const handleFileChange = (info) => {
    const { status } = info.file;
    if (status === 'done' || status === 'uploading') {
      setFile(info.file.originFileObj || info.file);
    }
  };

  const beforeUpload = (file) => {
    const isCSV = file.type === 'text/csv';
    const isExcel =
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel';

    if (!isCSV && !isExcel) {
      toast.error('You can only upload CSV or Excel files');
      return Upload.LIST_IGNORE;
    }

    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      toast.error('File must be smaller than 10MB');
      return Upload.LIST_IGNORE;
    }

    setFile(file);
    return false; // Prevent auto upload
  };

  const handleNext = () => {
    if (currentStep === 0 && file) {
      handleValidate();
    } else if (currentStep === 1 && validationResult) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      handleUpload();
    }
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleReset = () => {
    setCurrentStep(0);
    setFile(null);
    setValidationResult(null);
    setUploadProgress(0);
    setUploadResult(null);
  };

  // Step 1: Validate
  const handleValidate = async () => {
    if (!file) {
      toast('Please select a file first', { icon: '⚠️' });
      return;
    }

    if (!selectedInstitution) {
      toast('Please select an institution first', { icon: '⚠️' });
      return;
    }

    setLoading(true);
    try {
      const result = await bulkService.validateUsers(file, selectedInstitution);
      setValidationResult(result);
      setCurrentStep(1);
      toast.success('Validation completed');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Validation failed');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Upload
  const handleUpload = async () => {
    setLoading(true);
    setCurrentStep(2);

    try {
      const result = await bulkService.uploadUsers(
        file,
        (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        },
        true, // useAsync
        selectedInstitution
      );

      setUploadResult(result);
      setCurrentStep(3);
      toast.success('Upload completed');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Upload failed');
      setCurrentStep(1);
    } finally {
      setLoading(false);
    }
  };

  // Download template
  const handleDownloadTemplate = async () => {
    try {
      const blob = await bulkService.downloadUserTemplate();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'user_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  // Download error report
  const handleDownloadErrors = () => {
    if (!validationResult?.errors || validationResult.errors.length === 0) return;

    const errorData = validationResult.errors.map((err) => ({
      Row: err.row,
      Field: err.field,
      Error: err.message,
    }));

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['Row,Field,Error', ...errorData.map((e) => `${e.Row},${e.Field},"${e.Error}"`)].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'validation_errors.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success('Error report downloaded');
  };

  // Download credentials
  const handleDownloadCredentials = () => {
    if (!uploadResult?.credentials || uploadResult.credentials.length === 0) return;

    const credData = uploadResult.credentials.map((cred) => ({
      Email: cred.email,
      Password: cred.password,
      Role: cred.role,
      Name: cred.name,
    }));

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        'Email,Password,Role,Name',
        ...credData.map((c) => `${c.Email},${c.Password},${c.Role},"${c.Name}"`),
      ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'user_credentials.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success('Credentials downloaded');
  };

  // Get role tag color
  const getRoleColor = (role) => {
    const colorMap = {
      principal: 'blue',
      teacher: 'green',
      student: 'orange',
      admin: 'red',
      state_admin: 'purple',
    };
    return colorMap[role] || 'default';
  };

  // Table columns for preview
  const getPreviewColumns = () => {
    if (!validationResult?.data || validationResult.data.length === 0) return [];

    const firstRow = validationResult.data[0];
    const keys = Object.keys(firstRow);

    return keys.map((key) => ({
      title: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
      dataIndex: key,
      key: key,
      render: (text, record, index) => {
        const rowErrors = validationResult.errors?.filter((err) => err.row === index + 2);
        const fieldError = rowErrors?.find((err) => err.field === key);

        // Highlight role column
        if (key === 'role') {
          if (fieldError) {
            return (
              <Space orientation="vertical" size={0}>
                <Tag color="red">{text}</Tag>
                <Text type="danger" style={{ fontSize: '12px' }}>
                  {fieldError.message}
                </Text>
              </Space>
            );
          }
          return <Tag color={getRoleColor(text)}>{text}</Tag>;
        }

        // Highlight email duplicates
        if (key === 'email' && fieldError) {
          return (
            <Space orientation="vertical" size={0}>
              <Text type="danger">{text}</Text>
              <Text type="danger" style={{ fontSize: '12px' }}>
                {fieldError.message}
              </Text>
            </Space>
          );
        }

        // General error handling
        if (fieldError) {
          return (
            <Space orientation="vertical" size={0}>
              <Text type="danger">{text}</Text>
              <Text type="danger" style={{ fontSize: '12px' }}>
                {fieldError.message}
              </Text>
            </Space>
          );
        }

        return text;
      },
    }));
  };

  const getPreviewData = () => {
    if (!validationResult?.data) return [];
    return validationResult.data.map((row, index) => ({
      key: index,
      ...row,
    }));
  };

  // Get validation warnings
  const getValidationWarnings = () => {
    if (!validationResult?.warnings) return [];
    return validationResult.warnings;
  };

  const steps = [
    {
      title: 'Upload File',
      icon: <UploadOutlined />,
    },
    {
      title: 'Validate',
      icon: <CheckCircleOutlined />,
    },
    {
      title: 'Review',
      icon: <WarningOutlined />,
    },
    {
      title: 'Complete',
      icon: <CheckCircleOutlined />,
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Title level={2}>Bulk User Creation</Title>
        <Paragraph type="secondary">
          Create multiple user accounts at once using Excel or CSV files. Users will receive their credentials via
          email after creation.
        </Paragraph>

        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={handleDownloadTemplate}
          style={{ marginBottom: '24px' }}
        >
          Download Template
        </Button>

        <Steps current={currentStep} items={steps} style={{ marginBottom: '32px' }} />

        {/* Step 0: Upload File */}
        {currentStep === 0 && (
          <Card>
            {/* Institution Selector */}
            <div style={{ marginBottom: '16px' }}>
              <Text strong style={{ display: 'block', marginBottom: '8px' }}>
                Select Institution <span style={{ color: 'red' }}>*</span>
              </Text>
              <Select
                placeholder="Select an institution"
                value={selectedInstitution}
                onChange={setSelectedInstitution}
                loading={loadingInstitutions}
                style={{ width: '100%', maxWidth: 400 }}
                showSearch
                optionFilterProp="label"
                suffixIcon={<BankOutlined />}
                options={institutions.map((inst) => ({
                  value: inst.id,
                  label: inst.name,
                }))}
              />
            </div>

            {!selectedInstitution && (
              <Alert
                message="Select an Institution"
                description="You must select an institution before uploading users."
                type="warning"
                showIcon
                style={{ marginBottom: '16px' }}
              />
            )}

            <Alert
              message="Important Information"
              description={
                <ul style={{ marginBottom: 0 }}>
                  <li>Ensure all email addresses are unique and valid</li>
                  <li>Valid roles: FACULTY, MENTOR, PRINCIPAL</li>
                  <li>Passwords will be auto-generated (Welcome@123)</li>
                  <li>Users will need to change password on first login</li>
                </ul>
              }
              type="info"
              showIcon
              style={{ marginBottom: '16px' }}
            />

            <Dragger
              name="file"
              multiple={false}
              beforeUpload={beforeUpload}
              onChange={handleFileChange}
              accept=".csv,.xlsx,.xls"
              maxCount={1}
              disabled={!selectedInstitution}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ opacity: selectedInstitution ? 1 : 0.5 }} />
              </p>
              <p className="ant-upload-text">
                {selectedInstitution
                  ? 'Click or drag file to this area to upload'
                  : 'Please select an institution first'}
              </p>
              <p className="ant-upload-hint">
                Support for CSV and Excel files only. Maximum file size is 10MB.
              </p>
            </Dragger>

            {file && (
              <Alert
                title="File Selected"
                description={`${file.name} (${(file.size / 1024).toFixed(2)} KB)`}
                type="success"
                showIcon
                style={{ marginTop: '16px' }}
              />
            )}

            <div style={{ marginTop: '24px', textAlign: 'right' }}>
              <Button
                type="primary"
                onClick={handleNext}
                disabled={!file || !selectedInstitution}
                loading={loading}
              >
                Validate File
              </Button>
            </div>
          </Card>
        )}

        {/* Step 1: Validate Results */}
        {currentStep === 1 && validationResult && (
          <Card>
            <Row gutter={16} style={{ marginBottom: '24px' }}>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="Total Rows"
                    value={validationResult.total || 0}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="Valid Rows"
                    value={validationResult.valid || 0}
                    prefix={<CheckCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="Error Rows"
                    value={validationResult.errors?.length || 0}
                    prefix={<CloseCircleOutlined />}
                  />
                </Card>
              </Col>
            </Row>

            {validationResult.errors && validationResult.errors.length > 0 && (
              <Alert
                title="Validation Errors Found"
                description={`${validationResult.errors.length} error(s) found in the uploaded file. Please review the errors below.`}
                type="error"
                showIcon
                action={
                  <Button size="small" danger onClick={handleDownloadErrors}>
                    Download Errors
                  </Button>
                }
                style={{ marginBottom: '16px' }}
              />
            )}

            {getValidationWarnings().length > 0 && (
              <Alert
                title="Validation Warnings"
                description={
                  <ul style={{ marginBottom: 0 }}>
                    {getValidationWarnings().slice(0, 5).map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                    {getValidationWarnings().length > 5 && (
                      <li>...and {getValidationWarnings().length - 5} more warnings</li>
                    )}
                  </ul>
                }
                type="warning"
                showIcon
                style={{ marginBottom: '16px' }}
              />
            )}

            <Title level={4}>Data Preview</Title>
            <Paragraph type="secondary">
              Review the data below. Role column is highlighted for easy verification.
            </Paragraph>
            <Table
              columns={getPreviewColumns()}
              dataSource={getPreviewData()}
              scroll={{ x: true }}
              pagination={{ pageSize: 10 }}
            />

            <div style={{ marginTop: '24px', textAlign: 'right' }}>
              <Space>
                <Button onClick={handleBack}>Back</Button>
                <Button
                  type="primary"
                  onClick={handleNext}
                  disabled={validationResult.errors && validationResult.errors.length > 0}
                >
                  Continue to Upload
                </Button>
              </Space>
            </div>
          </Card>
        )}

        {/* Step 2: Upload Progress */}
        {currentStep === 2 && (
          <Card>
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <UserAddOutlined style={{ fontSize: '64px' }} />
              <Title level={3} style={{ marginTop: '16px' }}>
                Creating User Accounts...
              </Title>
              <Progress
                percent={uploadProgress}
                status={uploadProgress === 100 ? 'success' : 'active'}
                style={{ marginTop: '24px' }}
              />
              <Paragraph type="secondary" style={{ marginTop: '16px' }}>
                Please wait while we create user accounts and send credentials. Do not close this window.
              </Paragraph>
            </div>
          </Card>
        )}

        {/* Step 3: Complete */}
        {currentStep === 3 && uploadResult && (
          <Card>
            <div style={{ textAlign: 'center', padding: '24px' }}>
              <CheckCircleOutlined style={{ fontSize: '64px' }} />
              <Title level={2} style={{ marginTop: '16px' }}>
                User Creation Complete!
              </Title>
            </div>

            <Row gutter={16} style={{ marginTop: '24px' }}>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="Successfully Created"
                    value={uploadResult.success || 0}
                    prefix={<CheckCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="Failed"
                    value={uploadResult.failed || 0}
                    prefix={<CloseCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="Emails Sent"
                    value={uploadResult.emailsSent || 0}
                    prefix={<MailOutlined />}
                  />
                </Card>
              </Col>
            </Row>

            {uploadResult.credentials && uploadResult.credentials.length > 0 && (
              <Alert
                title="User Credentials Generated"
                description={
                  <div>
                    <Paragraph>
                      {uploadResult.credentials.length} user account(s) created successfully. Download the credentials
                      file to share with users manually, or they will receive credentials via email.
                    </Paragraph>
                    <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownloadCredentials}>
                      Download Credentials
                    </Button>
                  </div>
                }
                type="success"
                showIcon
                style={{ marginTop: '24px' }}
              />
            )}

            {uploadResult.errors && uploadResult.errors.length > 0 && (
              <Alert
                title="Some users failed to create"
                description={
                  <div>
                    <Paragraph>The following errors occurred:</Paragraph>
                    <ul>
                      {uploadResult.errors.slice(0, 5).map((err, idx) => (
                        <li key={idx}>
                          Row {err.row}: {err.message}
                        </li>
                      ))}
                    </ul>
                    {uploadResult.errors.length > 5 && (
                      <Text type="secondary">...and {uploadResult.errors.length - 5} more errors</Text>
                    )}
                  </div>
                }
                type="warning"
                showIcon
                style={{ marginTop: '24px' }}
              />
            )}

            {uploadResult.emailErrors && uploadResult.emailErrors.length > 0 && (
              <Alert
                title="Email Delivery Issues"
                description={
                  <div>
                    <Paragraph>
                      Some users were created but email delivery failed. Please share credentials manually.
                    </Paragraph>
                    <ul>
                      {uploadResult.emailErrors.slice(0, 3).map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                }
                type="warning"
                showIcon
                style={{ marginTop: '16px' }}
              />
            )}

            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              <Button type="primary" size="large" onClick={handleReset}>
                Create More Users
              </Button>
            </div>
          </Card>
        )}
      </Card>
    </div>
  );
};

export default BulkUserCreate;