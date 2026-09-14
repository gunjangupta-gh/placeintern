import React, { useState } from 'react';
import { Card, Upload, Button, Steps, Table, Alert, Space, Divider, Progress, Tooltip } from 'antd';
import { toast } from 'react-hot-toast';
import {
  UploadOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { internshipReportService } from '../../../services/internshipReport.service';

const { Step } = Steps;
const { Dragger } = Upload;

const HEADER = {
  rollNumber: 'Roll Number',
  studentName: 'Student Name',
  companyName: 'Company Name*',
  enrollmentStatus: 'Enrollment Status (Enrolled / Dropped Out)',
  modeOfInternship: 'Mode of Internship (Online / Offline)',
  facultyMentorEmail: 'Faculty Mentor Email',
};

const InternshipReportBulkUpload = ({ onUploaded }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [file, setFile] = useState(null);
  const [validating, setValidating] = useState(false);
  const [previewRows, setPreviewRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);

  const handleDownloadTemplate = async () => {
    try {
      const blob = await internshipReportService.downloadBulkTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'internship-confirmation-template.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to download template');
    }
  };

  const handleFileSelect = (selectedFile) => {
    setFile(selectedFile);
    readAndValidate(selectedFile);
    return false; // prevent antd's own upload behavior
  };

  const readAndValidate = (selectedFile) => {
    setValidating(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

        if (jsonData.length === 0) {
          toast.error('The file is empty or has no data rows');
          setFile(null);
          setValidating(false);
          return;
        }

        // Server-side validation matches students/faculty mentors and checks business rules
        // that can't be reliably replicated on the client (student lookup, mentor email lookup, etc).
        const result = await internshipReportService.validateBulkUpload(selectedFile);

        const errorsByRow = new Map();
        (result.errors || []).forEach((err) => {
          if (!errorsByRow.has(err.row)) errorsByRow.set(err.row, []);
          errorsByRow.get(err.row).push(err.error);
        });
        const warningsByRow = new Map();
        (result.warnings || []).forEach((w) => {
          if (!warningsByRow.has(w.row)) warningsByRow.set(w.row, []);
          warningsByRow.get(w.row).push(w.message);
        });

        const rows = jsonData.map((row, index) => {
          const rowNumber = index + 2; // header is row 1
          return {
            rowNumber,
            rollNumber: row[HEADER.rollNumber],
            studentName: row[HEADER.studentName],
            companyName: row[HEADER.companyName],
            enrollmentStatus: row[HEADER.enrollmentStatus],
            modeOfInternship: row[HEADER.modeOfInternship],
            facultyMentorEmail: row[HEADER.facultyMentorEmail],
            errors: errorsByRow.get(rowNumber) || [],
            warnings: warningsByRow.get(rowNumber) || [],
          };
        });

        setPreviewRows(rows);
        setSummary({ totalRows: result.totalRows, validRows: result.validRows, invalidRows: result.invalidRows });
        setCurrentStep(1);

        if (result.invalidRows > 0) {
          toast.error(`Found ${result.invalidRows} row(s) with errors. They will be skipped on upload.`);
        } else {
          toast.success(`All ${result.validRows} row(s) look good`);
        }
      } catch (error) {
        toast.error(error?.response?.data?.message || 'Failed to read/validate file');
        setFile(null);
      } finally {
        setValidating(false);
      }
    };

    reader.onerror = () => {
      toast.error('Failed to read file. Please ensure it is a valid Excel file.');
      setFile(null);
      setValidating(false);
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('File not found. Please upload again.');
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const result = await internshipReportService.uploadBulk(file, (progressEvent) => {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(percent);
      });
      setUploadResult(result);
      setCurrentStep(2);
      if (result.failed > 0 && result.success === 0) {
        toast.error(`All ${result.failed} row(s) failed`);
      } else if (result.failed > 0) {
        toast.warning(`Created ${result.success} report(s), ${result.failed} failed`);
      } else {
        toast.success(`Created ${result.success} internship report(s)`);
      }
      if (result.success > 0) {
        onUploaded?.();
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const resetUpload = () => {
    setCurrentStep(0);
    setFile(null);
    setPreviewRows([]);
    setSummary(null);
    setUploadResult(null);
    setUploadProgress(0);
  };

  const validRows = previewRows.filter((r) => r.errors.length === 0);
  const invalidRows = previewRows.filter((r) => r.errors.length > 0);

  const baseColumns = [
    { title: 'Row', dataIndex: 'rowNumber', key: 'rowNumber', width: 60 },
    { title: 'Roll Number', dataIndex: 'rollNumber', key: 'rollNumber', render: (t) => t || '-' },
    { title: 'Student Name', dataIndex: 'studentName', key: 'studentName', render: (t) => t || '-' },
    { title: 'Company', dataIndex: 'companyName', key: 'companyName', render: (t) => t || '-' },
  ];

  const validColumns = [
    ...baseColumns,
    { title: 'Mode', dataIndex: 'modeOfInternship', key: 'modeOfInternship', render: (t) => t || '-' },
    { title: 'Faculty Mentor', dataIndex: 'facultyMentorEmail', key: 'facultyMentorEmail', render: (t) => t || '-' },
    {
      title: 'Warnings',
      dataIndex: 'warnings',
      key: 'warnings',
      render: (warnings) =>
        warnings?.length > 0 ? (
          <Tooltip title={warnings.join(', ')}>
            <span style={{ color: '#faad14' }}>{warnings.length} warning(s)</span>
          </Tooltip>
        ) : (
          '-'
        ),
    },
  ];

  const invalidColumns = [
    ...baseColumns,
    {
      title: 'Errors',
      dataIndex: 'errors',
      key: 'errors',
      render: (errors) => (
        <ul className="text-red-500 text-xs list-disc ml-4">
          {errors.map((err, idx) => (
            <li key={idx}>{err}</li>
          ))}
        </ul>
      ),
    },
  ];

  return (
    <Card>
      <Steps current={currentStep} className="mb-6">
        <Step title="Download & Fill" description="Get the pre-filled sheet" />
        <Step title="Preview & Validate" description="Review every row" />
        <Step title="Complete" description="Upload finished" />
      </Steps>

      {currentStep === 0 && (
        <div>
          <Alert
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
            className="mb-4"
            message="How this works"
            description={
              <ul className="list-disc ml-4 mt-2">
                <li>Download the template — it's pre-filled with your institution's students (name, roll number, branch, semester)</li>
                <li>Fill in the internship details for each student you want to record (Company Name is required)</li>
                <li>Do not edit the hidden "Student ID" column — it's used to match rows back to students</li>
                <li>Upload the filled sheet below to preview every row before anything is saved</li>
                <li>This creates new report entries — it does not overwrite existing ones for a student</li>
              </ul>
            }
          />
          <Space className="mb-4">
            <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
              Download Template
            </Button>
          </Space>
          <Dragger accept=".xlsx,.xls" beforeUpload={handleFileSelect} maxCount={1} showUploadList={false} disabled={validating}>
            <p className="ant-upload-drag-icon">
              <UploadOutlined style={{ fontSize: 48 }} />
            </p>
            <p className="ant-upload-text">{validating ? 'Reading and validating…' : 'Click or drag the filled sheet here'}</p>
            <p className="ant-upload-hint">Upload the Excel file you downloaded and filled in</p>
          </Dragger>
        </div>
      )}

      {currentStep === 1 && summary && (
        <div>
          <Alert
            className="mb-4"
            type={summary.invalidRows > 0 ? 'warning' : 'success'}
            message={`Total Rows: ${summary.totalRows}`}
            description={
              <div className="flex items-center gap-4">
                <span className="text-green-600">
                  <CheckCircleOutlined /> Valid: {summary.validRows}
                </span>
                <span className="text-red-600">
                  <CloseCircleOutlined /> Invalid: {summary.invalidRows}
                </span>
              </div>
            }
          />

          {validRows.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2 text-green-600">Valid Records ({validRows.length})</h3>
              <Table columns={validColumns} dataSource={validRows} rowKey="rowNumber" size="small" pagination={{ pageSize: 5 }} />
            </div>
          )}

          {invalidRows.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2 text-red-600">Invalid Records ({invalidRows.length})</h3>
              <Table columns={invalidColumns} dataSource={invalidRows} rowKey="rowNumber" size="small" pagination={{ pageSize: 5 }} />
            </div>
          )}

          <Divider />

          {uploading && (
            <div className="mb-4">
              <Progress percent={uploadProgress} status="active" />
            </div>
          )}

          <Space>
            <Button onClick={resetUpload}>Cancel</Button>
            <Tooltip title={validRows.length === 0 ? 'No valid rows to upload' : ''}>
              <Button type="primary" onClick={handleUpload} loading={uploading} disabled={validRows.length === 0}>
                Upload {validRows.length} Valid Record(s)
              </Button>
            </Tooltip>
          </Space>
        </div>
      )}

      {currentStep === 2 && uploadResult && (
        <div className="py-4">
          <div className="text-center mb-6">
            {uploadResult.success > 0 && uploadResult.failed === 0 ? (
              <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
            ) : uploadResult.success === 0 ? (
              <CloseCircleOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />
            ) : (
              <CheckCircleOutlined style={{ fontSize: 48, color: '#faad14' }} />
            )}
            <h2 className="text-xl font-semibold mt-4">
              {uploadResult.success > 0 && uploadResult.failed === 0
                ? 'Upload Successful!'
                : uploadResult.success === 0
                ? 'Upload Failed'
                : 'Upload Completed with Errors'}
            </h2>
          </div>

          <Alert
            className="mb-4"
            type={uploadResult.failed === 0 ? 'success' : uploadResult.success === 0 ? 'error' : 'warning'}
            message="Upload Summary"
            description={
              <div className="flex justify-center gap-8 py-2">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{uploadResult.total}</div>
                  <div className="text-gray-500">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{uploadResult.success}</div>
                  <div className="text-gray-500">Success</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{uploadResult.failed}</div>
                  <div className="text-gray-500">Failed</div>
                </div>
              </div>
            }
          />

          {uploadResult.successRecords?.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2 text-green-600">
                <CheckCircleOutlined /> Successfully Created ({uploadResult.successRecords.length})
              </h3>
              <Table
                columns={[
                  { title: 'Row', dataIndex: 'row', key: 'row', width: 60 },
                  { title: 'Student', dataIndex: 'student', key: 'student', render: (t) => t || '-' },
                  { title: 'Company', dataIndex: 'companyName', key: 'companyName', render: (t) => t || '-' },
                ]}
                dataSource={uploadResult.successRecords}
                rowKey="row"
                size="small"
                pagination={{ pageSize: 5 }}
              />
            </div>
          )}

          {uploadResult.failedRecords?.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2 text-red-600">
                <CloseCircleOutlined /> Failed Records ({uploadResult.failedRecords.length})
              </h3>
              <Table
                columns={[
                  { title: 'Row', dataIndex: 'row', key: 'row', width: 60 },
                  { title: 'Student', dataIndex: 'student', key: 'student', render: (t) => t || '-' },
                  { title: 'Company', dataIndex: 'companyName', key: 'companyName', render: (t) => t || '-' },
                  {
                    title: 'Error',
                    dataIndex: 'error',
                    key: 'error',
                    render: (text) => <span className="text-red-500">{text}</span>,
                  },
                ]}
                dataSource={uploadResult.failedRecords}
                rowKey="row"
                size="small"
                pagination={{ pageSize: 5 }}
              />
            </div>
          )}

          <div className="text-center mt-6">
            <Button type="primary" onClick={resetUpload}>
              Upload Another File
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default InternshipReportBulkUpload;
