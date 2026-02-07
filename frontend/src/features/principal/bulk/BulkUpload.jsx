import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Card, Upload, Button, Steps, Table, Alert, Space, Select, Divider } from 'antd';
import { toast } from 'react-hot-toast';
import { fetchPrincipalDashboard } from '../store/principalSlice';
import { UploadOutlined, DownloadOutlined, CheckCircleOutlined, CloseCircleOutlined, BankOutlined } from '@ant-design/icons';
import { bulkService } from '../../../services/bulk.service';
import { stateService } from '../../../services/state.service';
import * as XLSX from 'xlsx';

const { Step } = Steps;
const { Dragger } = Upload;

const BulkUpload = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const isStateDirectorate = user?.role === 'STATE_DIRECTORATE';

  const [currentStep, setCurrentStep] = useState(0);
  const [uploadType, setUploadType] = useState('students');
  const [fileData, setFileData] = useState([]);
  const [originalFile, setOriginalFile] = useState(null);
  const [validationResults, setValidationResults] = useState({ valid: [], invalid: [] });
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null); // Store upload results for summary

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
      const blob = uploadType === 'students'
        ? await bulkService.downloadStudentTemplate()
        : await bulkService.downloadUserTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bulk-${uploadType}-upload-template.xlsx`;
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

      // Normalize keys - match backend expected column names (maps to User + Student tables)
      // User fields: name, email, phoneNo, rollNumber, dob
      // Student fields: gender
      const name = row['Name'] || row['name'] || row['Student Name'];
      const email = row['Email'] || row['email'];
      const phoneNo = row['Phone'] || row['phone'] || row['Contact'] || row['phoneNo'];
      const rollNumber = row['Roll Number'] || row['rollNumber'];
      const gender = row['Gender'] || row['gender'];
      const dateOfBirth = row['Date of Birth'] || row['DOB'] || row['dateOfBirth'];

      // Required field validations
      if (!name || String(name).trim() === '') errors.push('Name is required');
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) errors.push('Valid email is required');

      // Optional field validations
      if (gender && !['MALE', 'FEMALE', 'OTHER'].includes(String(gender).toUpperCase())) {
        errors.push('Gender must be MALE, FEMALE, or OTHER');
      }

      const record = {
        ...row,
        name,
        email,
        phoneNo,
        rollNumber,
        gender,
        dateOfBirth,
        rowNumber: index + 2, // +2 because Excel starts at 1 and header is row 1
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

  const validateStaffData = (data) => {
    const valid = [];
    const invalid = [];
    // Match backend valid roles (maps to User model with TEACHER role)
    const validRoles = ['TEACHER', 'FACULTY_SUPERVISOR'];

    data.forEach((row, index) => {
      const errors = [];

      // Normalize keys - match backend BulkUserRowDto (maps to User table)
      // User fields: name, email, phoneNo, role, designation
      const name = row['Name'] || row['name'] || row['Full Name'];
      const email = row['Email'] || row['email'];
      const phone = row['Phone'] || row['phone'] || row['Contact'] || row['phoneNo'];
      const role = row['Role'] || row['role'];
      const designation = row['Designation'] || row['designation'];
      const department = row['Department'] || row['department'];
      const employeeId = row['Employee ID'] || row['employeeId'] || row['Employee Id'];

      // Required field validations (matching backend BulkUserRowDto)
      if (!name || String(name).trim() === '') errors.push('Name is required');
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) errors.push('Valid email is required');
      if (!role || String(role).trim() === '') {
        errors.push('Role is required');
      } else if (!validRoles.includes(String(role).toUpperCase())) {
        errors.push(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
      }

      const record = {
        ...row,
        name,
        email,
        phone,
        role: role ? String(role).toUpperCase() : undefined,
        designation,
        department,
        employeeId,
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
    // Store original file for later upload
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

        setFileData(jsonData);

        // Validate data for preview purposes
        const results = uploadType === 'students'
          ? validateStudentData(jsonData)
          : validateStaffData(jsonData);

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
    return false; // Prevent auto upload
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
    try {
      const institutionId = isStateDirectorate ? selectedInstitution : null;
      const uploadFn = uploadType === 'students'
        ? bulkService.uploadStudents
        : bulkService.uploadUsers;

      // Send the original file with institutionId for STATE_DIRECTORATE
      // useAsync = false for synchronous processing
      const result = await uploadFn(originalFile, null, false, institutionId);

      // Store the result for display
      setUploadResult(result);

      // Show appropriate message
      if (result.success === 0 && result.failed > 0) {
        toast.error(`All ${result.failed} records failed validation`);
      } else if (result.failed > 0) {
        toast.warning(`Uploaded ${result.success} ${uploadType}, ${result.failed} failed`);
      } else {
        toast.success(`Successfully uploaded all ${result.success} ${uploadType}`);
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
    setUploadResult(null);
  };

  const validColumns = [
    { title: 'Row', dataIndex: 'rowNumber', key: 'rowNumber', width: 70 },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    ...(uploadType === 'students'
      ? [{ title: 'Roll Number', dataIndex: 'rollNumber', key: 'rollNumber' }]
      : [
          { title: 'Role', dataIndex: 'role', key: 'role' },
          { title: 'Department', dataIndex: 'department', key: 'department' },
        ]),
  ];

  const invalidColumns = [
    { title: 'Row', dataIndex: 'rowNumber', key: 'rowNumber', width: 70 },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    {
      title: 'Errors',
      dataIndex: 'errors',
      key: 'errors',
      render: (errors) => (
        <ul className="text-red-500 text-xs">
          {errors.map((error, idx) => (
            <li key={idx}>{error}</li>
          ))}
        </ul>
      ),
    },
  ];

  return (
    <div className="p-6">
      <Card title="Bulk Upload" variant="borderless">
        <Steps current={currentStep} className="mb-6">
          <Step title="Upload File" description="Select and upload Excel file" />
          <Step title="Validate Data" description="Review and validate records" />
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
              <Select
                value={uploadType}
                onChange={(value) => {
                  setUploadType(value);
                  resetUpload();
                }}
                style={{ width: 200 }}
                options={[
                  { value: 'students', label: 'Upload Students' },
                  { value: 'staff', label: 'Upload Staff' },
                ]}
              />
              <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
                Download Template
              </Button>
            </Space>

            {/* Warning for STATE_DIRECTORATE if no institution selected */}
            {isStateDirectorate && !selectedInstitution && (
              <Alert
                title="Select an Institution"
                description="As a State Directorate user, you must select an institution before uploading data."
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
                  <li>Fill in the required information in the template</li>
                  <li>Ensure all required fields are filled correctly</li>
                  <li>Upload the completed Excel file below</li>
                  <li>Supported formats: .xlsx, .xls</li>
                </ul>
              }
              type="info"
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
                  : 'Click or drag file to this area to upload'}
              </p>
              <p className="ant-upload-hint">
                Support for a single Excel file upload. File size should not exceed 10MB.
              </p>
            </Dragger>
          </div>
        )}

        {currentStep === 1 && (
          <div>
            <Alert
              title={`Total Records: ${fileData.length}`}
              description={
                <div>
                  <div className="flex items-center gap-4">
                    <span className="text-green-600">
                      <CheckCircleOutlined /> Valid: {validationResults.valid.length}
                    </span>
                    <span className="text-red-600">
                      <CloseCircleOutlined /> Invalid: {validationResults.invalid.length}
                    </span>
                  </div>
                </div>
              }
              type={validationResults.invalid.length > 0 ? 'warning' : 'success'}
              className="mb-4"
            />

            {validationResults.valid.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2 text-green-600">Valid Records</h3>
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
                <h3 className="text-lg font-semibold mb-2 text-red-600">Invalid Records</h3>
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

        {currentStep === 2 && uploadResult && (
          <div className="py-4">
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
                    { title: 'Name', dataIndex: 'name', key: 'name' },
                    { title: 'Email', dataIndex: 'email', key: 'email' },
                    uploadType === 'students'
                      ? { title: 'Enrollment No.', dataIndex: 'enrollmentNumber', key: 'enrollmentNumber' }
                      : { title: 'Role', dataIndex: 'role', key: 'role' },
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
                    { title: 'Name', dataIndex: 'name', key: 'name', render: (text) => text || '-' },
                    { title: 'Email', dataIndex: 'email', key: 'email', render: (text) => text || '-' },
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

export default BulkUpload;