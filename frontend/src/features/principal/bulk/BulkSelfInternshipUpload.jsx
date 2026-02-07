import React, { useState, useEffect } from 'react';
import {
  Card,
  Upload,
  Button,
  Steps,
  Table,
  Alert,
  Space,
  Divider,
  Progress,
  Switch,
  Tooltip,
  Select,
} from 'antd';
import { toast } from 'react-hot-toast';
import {
  UploadOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  HistoryOutlined,
  BankOutlined,
} from '@ant-design/icons';
import { bulkService } from '../../../services/bulk.service';
import { stateService } from '../../../services/state.service';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { fetchPrincipalDashboard } from '../store/principalSlice';
import * as XLSX from 'xlsx';

const { Step } = Steps;
const { Dragger } = Upload;

const BulkSelfInternshipUpload = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const isStateDirectorate = user?.role === 'STATE_DIRECTORATE';

  const [currentStep, setCurrentStep] = useState(0);
  const [fileData, setFileData] = useState([]);
  const [originalFile, setOriginalFile] = useState(null);
  const [validationResults, setValidationResults] = useState({ valid: [], invalid: [] });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [useAsync, setUseAsync] = useState(false); // Default to sync for immediate feedback
  const [uploadResult, setUploadResult] = useState(null);

  // Institution selector state for STATE_DIRECTORATE
  const [institutions, setInstitutions] = useState([]);
  const [selectedInstitution, setSelectedInstitution] = useState(null);
  const [loadingInstitutions, setLoadingInstitutions] = useState(false);

  // Fetch institutions for STATE_DIRECTORATE
  useEffect(() => {
    if (isStateDirectorate) {
      fetchInstitutions();
    }
  }, [isStateDirectorate]);

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

  const handleDownloadTemplate = async () => {
    try {
      const blob = await bulkService.downloadSelfInternshipTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bulk-self-internship-upload-template.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded successfully');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  const validateInternshipData = (data) => {
    const valid = [];
    const invalid = [];
    const seenIdentifiers = new Set();

    data.forEach((row, index) => {
      const errors = [];
      const warnings = [];

      // Normalize column names - match backend expected column names
      const studentEmail = row['Student Email'] || row['Email'] || row['studentEmail'];
      const rollNumber = row['Roll Number'] || row['rollNumber'] || row['Roll No'];
      const enrollmentNumber = row['Enrollment Number'] || row['enrollmentNumber'] || row['Admission Number'];
      const companyName = row['Company Name'] || row['companyName'] || row['Company'];
      const companyAddress = row['Company Address'] || row['companyAddress'];
      const companyContact = row['Company Contact'] || row['companyContact'] || row['Company Phone'];
      const companyEmail = row['Company Email'] || row['companyEmail'];
      const hrName = row['HR Name'] || row['hrName'] || row['Contact Person'];
      const hrDesignation = row['HR Designation'] || row['hrDesignation'];
      const hrContact = row['HR Contact'] || row['hrContact'] || row['HR Phone'];
      const hrEmail = row['HR Email'] || row['hrEmail'];
      const jobProfile = row['Job Profile'] || row['jobProfile'] || row['Role'] || row['Position'];
      const stipend = row['Stipend'] || row['stipend'];
      const startDate = row['Start Date'] || row['startDate'];
      const endDate = row['End Date'] || row['endDate'];
      const duration = row['Duration'] || row['duration'];
      const facultyMentorName = row['Faculty Mentor Name'] || row['Mentor Name'] || row['facultyMentorName'];
      const facultyMentorEmail = row['Faculty Mentor Email'] || row['Mentor Email'] || row['facultyMentorEmail'];
      const facultyMentorContact = row['Faculty Mentor Contact'] || row['Mentor Contact'] || row['facultyMentorContact'];
      const facultyMentorDesignation = row['Faculty Mentor Designation'] || row['facultyMentorDesignation'];
      const joiningLetterUrl = row['Joining Letter URL'] || row['joiningLetterUrl'];

      // At least one student identifier required
      if (!studentEmail && !rollNumber && !enrollmentNumber) {
        errors.push('At least one student identifier (Email, Roll Number, or Enrollment Number) is required');
      }

      // Check for duplicates
      const identifier = studentEmail || rollNumber || enrollmentNumber;
      if (identifier && seenIdentifiers.has(String(identifier).toLowerCase())) {
        errors.push('Duplicate student entry in file');
      } else if (identifier) {
        seenIdentifiers.add(String(identifier).toLowerCase());
      }

      // Company name is required
      if (!companyName || String(companyName).trim() === '') {
        errors.push('Company name is required');
      }

      // Validate email formats if provided
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (studentEmail && !emailRegex.test(String(studentEmail))) {
        errors.push('Invalid student email format');
      }

      if (companyEmail && !emailRegex.test(String(companyEmail))) {
        warnings.push('Invalid company email format');
      }

      if (hrEmail && !emailRegex.test(String(hrEmail))) {
        warnings.push('Invalid HR email format');
      }

      if (facultyMentorEmail && !emailRegex.test(String(facultyMentorEmail))) {
        warnings.push('Invalid faculty mentor email format');
      }

      // Validate phone numbers
      if (hrContact && !/^[0-9]{10}$/.test(String(hrContact).replace(/\D/g, ''))) {
        warnings.push('HR contact should be 10 digits');
      }

      // Validate date formats
      if (startDate && isNaN(new Date(startDate).getTime())) {
        warnings.push('Invalid start date format (use YYYY-MM-DD)');
      }

      if (endDate && isNaN(new Date(endDate).getTime())) {
        warnings.push('Invalid end date format (use YYYY-MM-DD)');
      }

      const record = {
        ...row,
        studentEmail,
        rollNumber,
        enrollmentNumber,
        companyName,
        companyAddress,
        companyContact,
        companyEmail,
        hrName,
        hrDesignation,
        hrContact,
        hrEmail,
        jobProfile,
        stipend,
        startDate,
        endDate,
        duration,
        facultyMentorName,
        facultyMentorEmail,
        facultyMentorContact,
        facultyMentorDesignation,
        joiningLetterUrl,
        studentIdentifier: studentEmail || rollNumber || enrollmentNumber,
        rowNumber: index + 2,
        errors,
        warnings,
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
    setOriginalFile(file);

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        if (jsonData.length === 0) {
          toast.error('The file is empty or has no valid data');
          setOriginalFile(null);
          return false;
        }

        if (jsonData.length > 500) {
          toast.error('Maximum 500 records can be uploaded at once');
          setOriginalFile(null);
          return false;
        }

        setFileData(jsonData);

        const results = validateInternshipData(jsonData);
        setValidationResults(results);
        setCurrentStep(1);

        if (results.invalid.length > 0) {
          toast.warning(`Found ${results.invalid.length} invalid record(s). Please review before uploading.`);
        } else {
          toast.success(`All ${results.valid.length} record(s) are valid!`);
        }
      } catch (error) {
        toast.error('Failed to read file. Please ensure it is a valid Excel file.');
        setOriginalFile(null);
      }
    };

    reader.readAsArrayBuffer(file);
    return false;
  };

  const handleUpload = async () => {
    if (validationResults.valid.length === 0) {
      toast.error('No valid records to upload');
      return;
    }

    if (!originalFile) {
      toast.error('File not found. Please upload again.');
      return;
    }

    // STATE_DIRECTORATE must select an institution
    if (isStateDirectorate && !selectedInstitution) {
      toast.error('Please select an institution first');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const institutionId = isStateDirectorate ? selectedInstitution : null;
      const result = await bulkService.uploadSelfInternships(
        originalFile,
        (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        },
        useAsync,
        institutionId
      );

      setUploadResult(result);

      if (useAsync && result.jobId) {
        toast.success('Upload queued successfully! You can track progress in Job History.');
      } else {
        // Show appropriate message based on results
        if (result.success === 0 && result.failed > 0) {
          toast.error(`All ${result.failed} records failed validation`);
        } else if (result.failed > 0) {
          toast.warning(`Uploaded ${result.success} internships, ${result.failed} failed`);
        } else {
          toast.success(`Successfully uploaded all ${result.success} internship records`);
        }
      }

      // Refresh dashboard stats if any records were uploaded successfully
      if (result.success > 0) {
        dispatch(fetchPrincipalDashboard({ forceRefresh: true }));
      }

      // Always go to step 2 to show summary
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
    setUploadProgress(0);
    setUploadResult(null);
  };

  const validColumns = [
    { title: 'Row', dataIndex: 'rowNumber', key: 'rowNumber', width: 60 },
    { title: 'Student', dataIndex: 'studentIdentifier', key: 'studentIdentifier', ellipsis: true },
    { title: 'Company', dataIndex: 'companyName', key: 'companyName', ellipsis: true },
    { title: 'Job Profile', dataIndex: 'jobProfile', key: 'jobProfile', ellipsis: true, render: (text) => text || '-' },
    { title: 'HR Name', dataIndex: 'hrName', key: 'hrName', ellipsis: true, render: (text) => text || '-' },
    {
      title: 'Warnings',
      dataIndex: 'warnings',
      key: 'warnings',
      render: (warnings) =>
        warnings?.length > 0 ? (
          <Tooltip title={warnings.join(', ')}>
            <span className="text-yellow-600">{warnings.length} warning(s)</span>
          </Tooltip>
        ) : (
          '-'
        ),
    },
  ];

  const invalidColumns = [
    { title: 'Row', dataIndex: 'rowNumber', key: 'rowNumber', width: 60 },
    { title: 'Student', dataIndex: 'studentIdentifier', key: 'studentIdentifier', ellipsis: true, render: (text) => text || 'N/A' },
    { title: 'Company', dataIndex: 'companyName', key: 'companyName', ellipsis: true, render: (text) => text || '-' },
    {
      title: 'Errors',
      dataIndex: 'errors',
      key: 'errors',
      render: (errors) => (
        <ul className="text-red-500 text-xs list-disc ml-4">
          {errors.map((error, idx) => (
            <li key={idx}>{error}</li>
          ))}
        </ul>
      ),
    },
  ];

  return (
    <div className="p-6">
      <Card
        title="Bulk Upload Self-Identified Internships"
        extra={
          <Button
            icon={<HistoryOutlined />}
            onClick={() => navigate('/app/bulk/job-history')}
          >
            View Job History
          </Button>
        }
      >
        <Steps current={currentStep} className="mb-6">
          <Step title="Upload File" description="Select Excel file" />
          <Step title="Validate" description="Review records" />
          <Step title="Complete" description="Upload successful" />
        </Steps>

        {currentStep === 0 && (
          <div>
            <Space className="mb-4" size="middle" wrap>
              {/* Institution selector for STATE_DIRECTORATE */}
              {isStateDirectorate && (
                <Select
                  placeholder="Select Institution"
                  value={selectedInstitution}
                  onChange={setSelectedInstitution}
                  loading={loadingInstitutions}
                  style={{ width: 300 }}
                  showSearch
                  optionFilterProp="label"
                  suffixIcon={<BankOutlined />}
                  options={institutions.map((inst) => ({
                    value: inst.id,
                    label: inst.name,
                  }))}
                />
              )}
              <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
                Download Template
              </Button>
            </Space>

            {/* Warning for STATE_DIRECTORATE if no institution selected */}
            {isStateDirectorate && !selectedInstitution && (
              <Alert
                title="Select an Institution"
                description="As a State Directorate user, you must select an institution before uploading self-identified internships."
                type="warning"
                showIcon
                className="mb-4"
              />
            )}

            <Alert
              title="Instructions"
              description={
                <ul className="list-disc ml-4 mt-2">
                  <li>Download the template file first</li>
                  <li>Fill in student identifier (Email, Roll Number, or Enrollment Number)</li>
                  <li>Company Name is required for each record</li>
                  <li>Include company details, HR info, and faculty mentor (optional)</li>
                  <li>Maximum 500 records per upload</li>
                  <li>Supported formats: .xlsx, .xls</li>
                </ul>
              }
              type="info"
              showIcon
              icon={<InfoCircleOutlined />}
              className="mb-4"
            />

            <Dragger
              accept=".xlsx,.xls"
              beforeUpload={handleFileUpload}
              maxCount={1}
              showUploadList={false}
              disabled={isStateDirectorate && !selectedInstitution}
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined style={{ fontSize: 48, opacity: isStateDirectorate && !selectedInstitution ? 0.5 : 1 }} />
              </p>
              <p className="ant-upload-text">
                {isStateDirectorate && !selectedInstitution
                  ? 'Please select an institution first'
                  : 'Click or drag file to upload'}
              </p>
              <p className="ant-upload-hint">
                Upload Excel file with self-identified internship data
              </p>
            </Dragger>
          </div>
        )}

        {currentStep === 1 && (
          <div>
            <Alert
              title={`Total Records: ${fileData.length}`}
              description={
                <div className="flex items-center gap-4">
                  <span className="text-green-600">
                    <CheckCircleOutlined /> Valid: {validationResults.valid.length}
                  </span>
                  <span className="text-red-600">
                    <CloseCircleOutlined /> Invalid: {validationResults.invalid.length}
                  </span>
                </div>
              }
              type={validationResults.invalid.length > 0 ? 'warning' : 'success'}
              className="mb-4"
            />

            {validationResults.valid.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2 text-green-600">
                  Valid Records ({validationResults.valid.length})
                </h3>
                <Table
                  columns={validColumns}
                  dataSource={validationResults.valid}
                  rowKey="rowNumber"
                  pagination={{ pageSize: 5 }}
                  size="small"
                />
              </div>
            )}

            {validationResults.invalid.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2 text-red-600">
                  Invalid Records ({validationResults.invalid.length})
                </h3>
                <Table
                  columns={invalidColumns}
                  dataSource={validationResults.invalid}
                  rowKey="rowNumber"
                  pagination={{ pageSize: 5 }}
                  size="small"
                />
              </div>
            )}

            <Divider />

            <div className="mb-4">
              <Space>
                <span>Process in background:</span>
                <Switch
                  checked={useAsync}
                  onChange={setUseAsync}
                  checkedChildren="Yes"
                  unCheckedChildren="No"
                />
                <Tooltip title="Background processing is recommended for large files. You can track progress in Job History.">
                  <InfoCircleOutlined className="text-gray-400" />
                </Tooltip>
              </Space>
            </div>

            {uploading && (
              <div className="mb-4">
                <Progress percent={uploadProgress} status="active" />
              </div>
            )}

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

        {currentStep === 2 && (
          <div className="py-4">
            {/* Async Job Queued */}
            {useAsync && uploadResult?.jobId ? (
              <div className="text-center py-8">
                <CheckCircleOutlined style={{ fontSize: 72, color: '#52c41a' }} />
                <h2 className="text-2xl font-semibold mt-4">Upload Queued!</h2>
                <p className="text-gray-600 mt-2">
                  Your upload is being processed in the background.
                </p>
                <Space className="mt-6">
                  <Button type="primary" onClick={resetUpload}>
                    Upload Another File
                  </Button>
                  <Button onClick={() => navigate('/app/bulk/job-history')}>View Job History</Button>
                </Space>
              </div>
            ) : uploadResult ? (
              <>
                {/* Summary Header */}
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

                {/* Summary Stats */}
                <Alert
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
                  type={uploadResult.failed === 0 ? 'success' : uploadResult.success === 0 ? 'error' : 'warning'}
                  className="mb-4"
                />

                {/* Success Records */}
                {uploadResult.successRecords?.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-2 text-green-600">
                      <CheckCircleOutlined /> Successfully Created ({uploadResult.successRecords.length})
                    </h3>
                    <Table
                      columns={[
                        { title: 'Row', dataIndex: 'row', key: 'row', width: 60 },
                        { title: 'Student', dataIndex: 'studentEmail', key: 'studentEmail' },
                        { title: 'Company', dataIndex: 'companyName', key: 'companyName' },
                      ]}
                      dataSource={uploadResult.successRecords}
                      rowKey="row"
                      pagination={{ pageSize: 5 }}
                      size="small"
                    />
                  </div>
                )}

                {/* Failed Records */}
                {uploadResult.failedRecords?.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-2 text-red-600">
                      <CloseCircleOutlined /> Failed Records ({uploadResult.failedRecords.length})
                    </h3>
                    <Table
                      columns={[
                        { title: 'Row', dataIndex: 'row', key: 'row', width: 60 },
                        { title: 'Student', dataIndex: 'studentEmail', key: 'studentEmail', render: (text) => text || '-' },
                        { title: 'Company', dataIndex: 'companyName', key: 'companyName', render: (text) => text || '-' },
                        {
                          title: 'Error',
                          dataIndex: 'error',
                          key: 'error',
                          render: (text) => <span className="text-red-500">{text}</span>,
                        },
                      ]}
                      dataSource={uploadResult.failedRecords}
                      rowKey="row"
                      pagination={{ pageSize: 5 }}
                      size="small"
                    />
                  </div>
                )}

                <div className="text-center mt-6">
                  <Space>
                    <Button type="primary" onClick={resetUpload}>
                      Upload Another File
                    </Button>
                    <Button onClick={() => navigate('/app/bulk/job-history')}>View Job History</Button>
                    <Button onClick={() => navigate('/app/internships')}>
                      View Self-Identified Internships
                    </Button>
                  </Space>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p>No upload result available.</p>
                <Button type="primary" onClick={resetUpload} className="mt-4">
                  Try Again
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default BulkSelfInternshipUpload;
