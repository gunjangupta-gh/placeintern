import React, { useState } from 'react';
import { Card, Upload, Button, Steps, Table, Alert, Space, Divider, Typography, Row, Col, Statistic } from 'antd';
import { toast } from 'react-hot-toast';
import {
  UploadOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { bulkService } from '../../../services/bulk.service';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

const { Step } = Steps;
const { Dragger } = Upload;
const { Title } = Typography;

const BulkStudentUpload = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [fileData, setFileData] = useState([]);
  const [originalFile, setOriginalFile] = useState(null);
  const [validationResults, setValidationResults] = useState({ valid: [], invalid: [] });
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const getRawFile = (fileLike) => fileLike?.originFileObj || fileLike;

  const handleDownloadTemplate = async () => {
    try {
      const blob = await bulkService.downloadStudentTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bulk-student-upload-template.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded successfully');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  const validateStudentData = (data) => {
    const valid = [];
    const invalid = [];

    data.forEach((row, index) => {
      const errors = [];

      // Normalize keys - match backend BulkStudentRowDto
      const rollNumber = row['Roll Number'] || row['rollNumber'] || row['Roll No'];
      const name = row['Name'] || row['name'] || row['Student Name'];
      const admissionYear = row['Admission Year'] || row['admissionYear'];
      const batch = row['Batch'] || row['batch'];
      const institution = row['College Name'] || row['Institution'] || row['institution'];
      const course = row['Course'] || row['Branch'] || row['branch'];

      if (!rollNumber || String(rollNumber).trim() === '') errors.push('Roll Number is required');
      if (!name || String(name).trim() === '') errors.push('Name is required');
      if (!admissionYear || isNaN(Number(admissionYear))) {
        errors.push('Admission Year is required');
      } else if (Number(admissionYear) < 2000 || Number(admissionYear) > 2100) {
        errors.push('Admission Year must be between 2000 and 2100');
      }
      if (!batch || String(batch).trim() === '') errors.push('Batch is required');
      if (!institution || String(institution).trim() === '') errors.push('College Name is required');

      const record = {
        ...row,
        rollNumber,
        name,
        admissionYear,
        batch,
        institution,
        course,
        rowNumber: index + 2,
        errors,
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

        const results = validateStudentData(jsonData);
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
      // Institution is auto-linked from the "College Name" column, no need to pass institutionId.
      // Large files (>100 rows) are always processed in the background queue regardless of the
      // `async` flag we send here - the server decides based on row count, so the response can
      // come back either as a finished result or as a "queued" job reference.
      const result = await bulkService.uploadStudents(originalFile, null, false, null);

      setUploadResult(result);

      if (result.jobId || result.bulkJobId) {
        toast.success('Upload queued for background processing! Track progress in Job History.');
      } else if (result.success === 0 && result.failed > 0) {
        toast.error(`All ${result.failed} records failed`);
      } else if (result.failed > 0) {
        toast(`Uploaded ${result.success} students, ${result.failed} failed`, {
          icon: '⚠️',
        });
      } else {
        toast.success(`Successfully uploaded all ${result.success} students`);
      }

      setCurrentStep(2);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to upload data');
    } finally {
      setUploading(false);
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
    { title: 'Roll Number', dataIndex: 'rollNumber', key: 'rollNumber' },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Admission Year', dataIndex: 'admissionYear', key: 'admissionYear' },
    { title: 'Batch', dataIndex: 'batch', key: 'batch' },
    { title: 'College', dataIndex: 'institution', key: 'institution', ellipsis: true },
    { title: 'Course', dataIndex: 'course', key: 'course' },
  ];

  const invalidColumns = [
    { title: 'Row', dataIndex: 'rowNumber', key: 'rowNumber', width: 60 },
    { title: 'Roll Number', dataIndex: 'rollNumber', key: 'rollNumber' },
    { title: 'Name', dataIndex: 'name', key: 'name' },
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
    <div className="p-6">
      <Card title="Bulk Student Upload" variant="borderless">
        <Steps current={currentStep} style={{ marginBottom: '24px' }}>
          <Step title="Upload File" description="Select Excel file" />
          <Step title="Validate" description="Review records" />
          <Step title="Complete" description="Upload results" />
        </Steps>

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
                  <li>Download the template and fill in Roll Number, Name, Admission Year and Batch</li>
                  <li><strong>"College Name"</strong> column is required - used to auto-link to the institution</li>
                  <li><strong>"Batch"</strong> must match an existing batch (e.g. "2023-2026")</li>
                  <li><strong>"Course"</strong> column is optional - used to auto-link to a branch</li>
                  <li>Students log in with Roll Number + Password - no email required</li>
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
              <p className="ant-upload-hint">Supported formats: .xlsx, .xls (max 10MB)</p>
            </Dragger>
          </div>
        )}

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

        {currentStep === 2 && uploadResult && (uploadResult.jobId || uploadResult.bulkJobId) && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <CheckCircleOutlined style={{ fontSize: 72, color: '#52c41a' }} />
            <Title level={3} style={{ marginTop: '16px' }}>Upload Queued!</Title>
            <p style={{ color: '#8c8c8c' }}>
              Your file has more than 100 rows, so it's being processed in the background.
              Track progress and see the final results in Job History.
            </p>
            <Space style={{ marginTop: '24px' }}>
              <Button type="primary" onClick={resetUpload}>Upload Another File</Button>
              <Button icon={<HistoryOutlined />} onClick={() => navigate('/app/bulk/job-history')}>
                View Job History
              </Button>
            </Space>
          </div>
        )}

        {currentStep === 2 && uploadResult && !(uploadResult.jobId || uploadResult.bulkJobId) && (
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

            {uploadResult.successRecords?.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <Title level={5} style={{ color: '#52c41a' }}>
                  Successfully Created ({uploadResult.successRecords.length})
                </Title>
                <Table
                  columns={[
                    { title: 'Row', dataIndex: 'row', key: 'row', width: 60 },
                    { title: 'Name', dataIndex: 'name', key: 'name' },
                    { title: 'Roll Number', dataIndex: 'rollNumber', key: 'rollNumber' },
                    { title: 'Institution', dataIndex: 'institution', key: 'institution' },
                    { title: 'Temporary Password', dataIndex: 'temporaryPassword', key: 'temporaryPassword' },
                  ]}
                  dataSource={uploadResult.successRecords}
                  rowKey="row"
                  pagination={{ pageSize: 5 }}
                  size="small"
                  scroll={{ x: true }}
                />
              </div>
            )}

            {uploadResult.failedRecords?.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <Title level={5} style={{ color: '#ff4d4f' }}>
                  Failed Records ({uploadResult.failedRecords.length})
                </Title>
                <Table
                  columns={[
                    { title: 'Row', dataIndex: 'row', key: 'row', width: 60 },
                    { title: 'Name', dataIndex: 'name', key: 'name', render: (t) => t || '-' },
                    { title: 'Roll Number', dataIndex: 'rollNumber', key: 'rollNumber', render: (t) => t || '-' },
                    {
                      title: 'Error',
                      dataIndex: 'error',
                      key: 'error',
                      render: (text) => <span style={{ color: '#ff4d4f' }}>{text}</span>,
                    },
                  ]}
                  dataSource={uploadResult.failedRecords}
                  rowKey="row"
                  pagination={{ pageSize: 5 }}
                  size="small"
                  scroll={{ x: true }}
                />
              </div>
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

export default BulkStudentUpload;
