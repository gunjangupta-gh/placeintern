import React, { useState } from 'react';
import { Card, Upload, Button, Steps, Table, Alert, Space, Divider, Typography, Row, Col, Statistic } from 'antd';
import { toast } from 'react-hot-toast';
import {
  UploadOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
import { bulkService } from '../../../services/bulk.service';
import * as XLSX from 'xlsx';

const { Step } = Steps;
const { Dragger } = Upload;
const { Title, Text } = Typography;

const BulkUserCreate = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [fileData, setFileData] = useState([]);
  const [originalFile, setOriginalFile] = useState(null);
  const [validationResults, setValidationResults] = useState({ valid: [], invalid: [] });
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const getRawFile = (fileLike) => fileLike?.originFileObj || fileLike;

  const handleDownloadTemplate = async () => {
    try {
      const blob = await bulkService.downloadUserTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bulk-user-upload-template.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded successfully');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  const validateStaffData = (data) => {
    const valid = [];
    const invalid = [];
    const validRoles = ['TEACHER', 'FACULTY_SUPERVISOR', 'ADMIN_STAFF'];

    data.forEach((row, index) => {
      const errors = [];

      // Normalize keys
      const name = row['Name'] || row['name'] || row['Full Name'] || row['Name of the Faculty'] || row['Name of Facuty'];
      const email = row['Email'] || row['email'];
      const phone = row['Phone'] || row['phone'] || row['Contact'] || row['Contact Number'];
      const role = row['Role'] || row['role'] || 'TEACHER';
      const institution = row['Name of the College'] || row['Institution'] || row['institution'];
      const course = row['Course'] || row['Branch'] || row['branch'];
      const designation = row['Designation'] || row['designation'];

      // Required field validations
      if (!name || String(name).trim() === '') errors.push('Name is required');
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) errors.push('Valid email is required');

      // Phone validation
      if (!phone || String(phone).trim() === '') {
        errors.push('Phone is required for password generation');
      } else {
        const phoneDigits = String(phone).replace(/\D/g, '');
        if (phoneDigits.length < 4) {
          errors.push('Phone must have at least 4 digits');
        }
      }

      // Role validation
      const roleUpper = role ? String(role).toUpperCase() : 'TEACHER';
      if (roleUpper && !validRoles.includes(roleUpper)) {
        errors.push(`Invalid role. Must be: ${validRoles.join(', ')}`);
      }

      // Institution validation (required for State Directorate)
      if (!institution || String(institution).trim() === '') {
        errors.push('Institution (Name of the College) is required');
      }

      const record = {
        ...row,
        name,
        email,
        phone,
        role: roleUpper,
        institution,
        course,
        designation,
        rowNumber: index + 2,
        errors: errors,
      };

      if (errors.length === 0) {
        valid.push(record);
      } else {
        invalid.push(record);
      }
    });

    return { valid, invalid };
  };

  const handleFileUpload = (file) => {
    const rawFile = getRawFile(file);

    if (!(rawFile instanceof Blob)) {
      toast.error('Invalid file object. Please choose the Excel file again.');
      setOriginalFile(null);
      return false;
    }

    const fileName = rawFile.name || '';
    const hasExcelExtension = /\.(xlsx|xls)$/i.test(fileName);
    if (!hasExcelExtension) {
      toast.error('Please upload a valid Excel file (.xlsx or .xls)');
      setOriginalFile(null);
      return false;
    }

    setOriginalFile(rawFile);

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const arrayBuffer = e?.target?.result;
        if (!arrayBuffer) {
          throw new Error('Could not read file data');
        }

        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        if (!workbook.SheetNames?.length) {
          throw new Error('No worksheet found in Excel file');
        }

        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

        if (jsonData.length === 0) {
          toast.error('The file is empty or has no valid data');
          setOriginalFile(null);
          return false;
        }

        setFileData(jsonData);

        const results = validateStaffData(jsonData);
        setValidationResults(results);
        setCurrentStep(1);

        if (results.invalid.length > 0) {
          toast(`Found ${results.invalid.length} invalid record(s). Please review before uploading.`, {
            icon: '⚠️',
          });
        } else {
          toast.success(`All ${results.valid.length} record(s) are valid!`);
        }
      } catch (error) {
        const reason = error?.message ? ` (${error.message})` : '';
        toast.error(`Failed to read file. Please ensure it is a valid Excel file${reason}`);
        setOriginalFile(null);
      }
    };

    reader.readAsArrayBuffer(rawFile);
    return false;
  };

  const handleUpload = async () => {
    if (validationResults.valid.length === 0) {
      toast.error('No valid records to upload');
      return;
    }

    if (!originalFile) {
      toast.error('Excel file not found. Please select the file again.');
      return;
    }

    setUploading(true);
    try {
      // Institution is auto-linked from Excel, no need to pass institutionId
      const result = await bulkService.uploadUsers(originalFile, null, false, null);

      setUploadResult(result);

      if (result.success === 0 && result.failed > 0) {
        toast.error(`All ${result.failed} records failed`);
      } else if (result.failed > 0) {
        toast(`Uploaded ${result.success} users, ${result.failed} failed`, {
          icon: '⚠️',
        });
      } else {
        toast.success(`Successfully uploaded all ${result.success} users`);
      }

      setCurrentStep(2);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to upload data');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadCreatedUsers = async () => {
    if (!uploadResult?.successRecords?.length) return;

    try {
      const blob = await bulkService.downloadCreatedUsersReport(uploadResult.successRecords);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `created_users_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Report downloaded');
    } catch (error) {
      toast.error('Failed to download report');
    }
  };

  const handleDownloadErrors = async () => {
    if (!uploadResult?.failedRecords?.length) return;

    try {
      const blob = await bulkService.downloadErrorUsersReport(uploadResult.failedRecords);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `error_users_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Error report downloaded');
    } catch (error) {
      toast.error('Failed to download error report');
    }
  };

  const resetUpload = () => {
    setCurrentStep(0);
    setFileData([]);
    setOriginalFile(null);
    setValidationResults({ valid: [], invalid: [] });
    setUploadResult(null);
  };

  const validColumns = [
    { title: 'Row', dataIndex: 'rowNumber', key: 'rowNumber', width: 60 },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Phone', dataIndex: 'phone', key: 'phone' },
    { title: 'Institution', dataIndex: 'institution', key: 'institution', ellipsis: true },
    { title: 'Course', dataIndex: 'course', key: 'course' },
  ];

  const invalidColumns = [
    { title: 'Row', dataIndex: 'rowNumber', key: 'rowNumber', width: 60 },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    {
      title: 'Errors',
      dataIndex: 'errors',
      key: 'errors',
      render: (errors) => (
        <ul style={{ color: '#ff4d4f', fontSize: '12px', margin: 0, paddingLeft: '16px' }}>
          {errors.map((error, idx) => (
            <li key={idx}>{error}</li>
          ))}
        </ul>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card title="Bulk Faculty/Staff Upload" variant="borderless">
        <Steps current={currentStep} style={{ marginBottom: '24px' }}>
          <Step title="Upload File" description="Select Excel file" />
          <Step title="Validate" description="Review records" />
          <Step title="Complete" description="Upload results" />
        </Steps>

        {/* Step 0: Upload File */}
        {currentStep === 0 && (
          <div>
            <Space style={{ marginBottom: '16px' }}>
              <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
                Download Template
              </Button>
            </Space>

            <Alert
              message="Instructions"
              description={
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  <li>Download the template and fill in faculty details</li>
                  <li><strong>"Name of the College"</strong> column is required - used to auto-link to institution</li>
                  <li><strong>"Course"</strong> column is used to auto-link to branch</li>
                  <li><strong>"Contact Number"</strong> is required (min 4 digits) - used for password</li>
                  <li><strong>Password format:</strong> first 4 letters of name + @ + first 4 digits of phone (e.g., john@9876)</li>
                  <li>Valid roles: TEACHER, FACULTY_SUPERVISOR, ADMIN_STAFF (defaults to TEACHER)</li>
                </ul>
              }
              type="info"
              showIcon
              style={{ marginBottom: '16px' }}
            />

            <Dragger
              accept=".xlsx,.xls"
              beforeUpload={handleFileUpload}
              maxCount={1}
              showUploadList={false}
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined style={{ fontSize: 48 }} />
              </p>
              <p className="ant-upload-text">Click or drag Excel file to upload</p>
              <p className="ant-upload-hint">Supported formats: .xlsx, .xls (max 5MB)</p>
            </Dragger>
          </div>
        )}

        {/* Step 1: Validation Results */}
        {currentStep === 1 && (
          <div>
            <Alert
              message={`Total Records: ${fileData.length}`}
              description={
                <Space size="large">
                  <span style={{ color: '#52c41a' }}>
                    <CheckCircleOutlined /> Valid: {validationResults.valid.length}
                  </span>
                  <span style={{ color: '#ff4d4f' }}>
                    <CloseCircleOutlined /> Invalid: {validationResults.invalid.length}
                  </span>
                </Space>
              }
              type={validationResults.invalid.length > 0 ? 'warning' : 'success'}
              style={{ marginBottom: '16px' }}
            />

            {validationResults.valid.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <Title level={5} style={{ color: '#52c41a' }}>Valid Records</Title>
                <Table
                  columns={validColumns}
                  dataSource={validationResults.valid}
                  rowKey="rowNumber"
                  pagination={{ pageSize: 5 }}
                  size="small"
                  scroll={{ x: true }}
                />
              </div>
            )}

            {validationResults.invalid.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <Title level={5} style={{ color: '#ff4d4f' }}>Invalid Records</Title>
                <Table
                  columns={invalidColumns}
                  dataSource={validationResults.invalid}
                  rowKey="rowNumber"
                  pagination={{ pageSize: 5 }}
                  size="small"
                  scroll={{ x: true }}
                />
              </div>
            )}

            <Divider />

            <Space>
              <Button onClick={resetUpload}>Cancel</Button>
              <Button
                type="primary"
                onClick={handleUpload}
                loading={uploading}
                disabled={validationResults.valid.length === 0}
              >
                Upload {validationResults.valid.length} Valid Record(s)
              </Button>
            </Space>
          </div>
        )}

        {/* Step 2: Upload Results */}
        {currentStep === 2 && uploadResult && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              {uploadResult.success > 0 && uploadResult.failed === 0 ? (
                <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a' }} />
              ) : uploadResult.success === 0 ? (
                <CloseCircleOutlined style={{ fontSize: 64, color: '#ff4d4f' }} />
              ) : (
                <CheckCircleOutlined style={{ fontSize: 64, color: '#faad14' }} />
              )}
              <Title level={3} style={{ marginTop: '16px' }}>
                {uploadResult.success > 0 && uploadResult.failed === 0
                  ? 'Upload Successful!'
                  : uploadResult.success === 0
                  ? 'Upload Failed'
                  : 'Upload Completed with Errors'}
              </Title>
            </div>

            <Row gutter={16} style={{ marginBottom: '24px' }}>
              <Col span={8}>
                <Card>
                  <Statistic title="Total" value={uploadResult.total} />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="Success"
                    value={uploadResult.success}
                    valueStyle={{ color: '#52c41a' }}
                    prefix={<CheckCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="Failed"
                    value={uploadResult.failed}
                    valueStyle={{ color: uploadResult.failed > 0 ? '#ff4d4f' : undefined }}
                    prefix={<CloseCircleOutlined />}
                  />
                </Card>
              </Col>
            </Row>

            {/* Success Records */}
            {uploadResult.successRecords?.length > 0 && (
              <Alert
                message={`${uploadResult.successRecords.length} Users Created Successfully`}
                description={
                  <div>
                    <Text>Download the Excel report to get user credentials (email + password).</Text>
                    <div style={{ marginTop: '12px' }}>
                      <Button type="primary" icon={<FileExcelOutlined />} onClick={handleDownloadCreatedUsers}>
                        Download Created Users (Excel)
                      </Button>
                    </div>
                  </div>
                }
                type="success"
                showIcon
                style={{ marginBottom: '16px' }}
              />
            )}

            {/* Failed Records */}
            {uploadResult.failedRecords?.length > 0 && (
              <Alert
                message={`${uploadResult.failedRecords.length} Records Failed`}
                description={
                  <div>
                    <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                      {uploadResult.failedRecords.slice(0, 5).map((err, idx) => (
                        <li key={idx}>
                          Row {err.row}: {err.name || 'Unknown'} - {err.error}
                        </li>
                      ))}
                      {uploadResult.failedRecords.length > 5 && (
                        <li>...and {uploadResult.failedRecords.length - 5} more</li>
                      )}
                    </ul>
                    <Button danger icon={<FileExcelOutlined />} onClick={handleDownloadErrors}>
                      Download Error Report (Excel)
                    </Button>
                  </div>
                }
                type="error"
                showIcon
                style={{ marginBottom: '16px' }}
              />
            )}

            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <Button type="primary" onClick={resetUpload}>
                Upload Another File
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default BulkUserCreate;
