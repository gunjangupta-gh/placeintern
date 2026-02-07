import React, { useState } from 'react';
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
  Statistic,
} from 'antd';
import { toast } from 'react-hot-toast';
import {
  InboxOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  UploadOutlined,
  FileExcelOutlined
} from '@ant-design/icons';
import { bulkService } from '../../../services/bulk.service';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

const BulkUpload = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [file, setFile] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  const [loading, setLoading] = useState(false);

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

    setLoading(true);
    try {
      const result = await bulkService.validateInstitutions(file);
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
      const result = await bulkService.uploadInstitutions(file, (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(percentCompleted);
      });

      setUploadResult(result);
      setCurrentStep(3);
      toast.success('Upload completed');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Upload failed');
      setCurrentStep(1); // Go back to review step on error
    } finally {
      setLoading(false);
    }
  };

  // Download template
  const handleDownloadTemplate = async () => {
    try {
      const blob = await bulkService.downloadInstitutionTemplate();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'institution_template.xlsx');
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

        if (fieldError) {
          return (
            <Space orientation="vertical" size={0}>
              <Text type="danger" className="font-medium">{text}</Text>
              <Text type="danger" className="text-xs">
                {fieldError.message}
              </Text>
            </Space>
          );
        }

        return <Text className="text-text-secondary">{text}</Text>;
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
    <div className="p-4 md:p-6 bg-background-secondary min-h-screen">
      <Card className="max-w-[1200px] mx-auto rounded-3xl border-border shadow-soft" bordered={false}>
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-primary/10 p-2 rounded-lg text-primary">
              <FileExcelOutlined className="text-xl" />
            </div>
            <Title level={2} className="!mb-0 !text-2xl font-bold text-text-primary">
              Bulk Institution Upload
            </Title>
          </div>
          <Paragraph className="text-text-secondary">
            Upload multiple institutions at once using Excel or CSV files. Follow the steps below to validate and import your data.
          </Paragraph>
        </div>

        <div className="flex justify-end mb-8">
          <Button
            icon={<DownloadOutlined />}
            onClick={handleDownloadTemplate}
            className="rounded-lg h-9 border-border hover:border-primary hover:text-primary"
          >
            Download Template
          </Button>
        </div>

        <Steps 
          current={currentStep} 
          items={steps} 
          className="mb-10 max-w-4xl mx-auto" 
        />

        {/* Step 0: Upload File */}
        {currentStep === 0 && (
          <div className="max-w-2xl mx-auto animate-fade-in">
            <Dragger
              name="file"
              multiple={false}
              beforeUpload={beforeUpload}
              onChange={handleFileChange}
              accept=".csv,.xlsx,.xls"
              maxCount={1}
              className="bg-surface hover:bg-surface-hover border-2 border-dashed border-border rounded-2xl p-8"
            >
              <p className="ant-upload-drag-icon text-primary mb-4">
                <InboxOutlined className="text-5xl" />
              </p>
              <p className="ant-upload-text text-lg font-medium text-text-primary mb-2">
                Click or drag file to this area to upload
              </p>
              <p className="ant-upload-hint text-text-tertiary">
                Support for CSV and Excel files only. Maximum file size is 10MB.
              </p>
            </Dragger>

            {file && (
              <Alert
                title="File Selected"
                description={`${file.name} (${(file.size / 1024).toFixed(2)} KB)`}
                type="success"
                showIcon
                className="mt-6 rounded-xl border-success/20 bg-success/5"
              />
            )}

            <div className="mt-8 text-right">
              <Button 
                type="primary" 
                onClick={handleNext} 
                disabled={!file} 
                loading={loading}
                size="large"
                className="rounded-xl px-8 font-bold shadow-lg shadow-primary/20"
              >
                Validate File
              </Button>
            </div>
          </div>
        )}

        {/* Step 1: Validate Results */}
        {currentStep === 1 && validationResult && (
          <div className="animate-fade-in">
            <Row gutter={[16, 16]} className="mb-8">
              <Col xs={24} md={8}>
                <Card className="rounded-xl border-border bg-surface shadow-sm">
                  <Statistic
                    title={<span className="text-text-tertiary font-medium">Total Rows</span>}
                    value={validationResult.total || 0}
                    styles={{ content: { fontWeight: 'bold', color: 'var(--color-text-primary)' } }}
                  />
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card className="rounded-xl border-border bg-surface shadow-sm">
                  <Statistic
                    title={<span className="text-text-tertiary font-medium">Valid Rows</span>}
                    value={validationResult.valid || 0}
                    styles={{ content: { fontWeight: 'bold', color: 'var(--ant-success-color)' } }}
                    prefix={<CheckCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card className="rounded-xl border-border bg-surface shadow-sm">
                  <Statistic
                    title={<span className="text-text-tertiary font-medium">Error Rows</span>}
                    value={validationResult.errors?.length || 0}
                    styles={{ content: { fontWeight: 'bold', color: 'var(--ant-error-color)' } }}
                    prefix={<CloseCircleOutlined />}
                  />
                </Card>
              </Col>
            </Row>

            {validationResult.errors && validationResult.errors.length > 0 && (
              <Alert
                title="Validation Errors Found"
                description={`${validationResult.errors.length} error(s) found. Please fix these issues in your file and re-upload, or download the error report.`}
                type="error"
                showIcon
                action={
                  <Button size="small" danger ghost onClick={handleDownloadErrors} className="font-medium">
                    Download Errors
                  </Button>
                }
                className="mb-6 rounded-xl border-error/20 bg-error/5"
              />
            )}

            <div className="mb-4">
              <Title level={4} className="!text-lg text-text-primary">Data Preview</Title>
            </div>
            
            <div className="border border-border rounded-xl overflow-hidden mb-8">
              <Table
                columns={getPreviewColumns()}
                dataSource={getPreviewData()}
                scroll={{ x: true }}
                pagination={{ pageSize: 5 }}
                size="small"
              />
            </div>

            <div className="flex justify-between">
              <Button onClick={handleBack} className="rounded-xl h-10 px-6">Back</Button>
              <Button
                type="primary"
                onClick={handleNext}
                disabled={validationResult.errors && validationResult.errors.length > 0}
                className="rounded-xl h-10 px-6 font-bold shadow-lg shadow-primary/20"
              >
                Continue to Upload
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Upload Progress */}
        {currentStep === 2 && (
          <div className="text-center py-12 animate-fade-in max-w-xl mx-auto">
            <Title level={3} className="text-text-primary mb-8">Uploading Institutions...</Title>
            <Progress
              percent={uploadProgress}
              status={uploadProgress === 100 ? 'success' : 'active'}
              strokeColor={{ '0%': 'var(--color-primary)', '100%': 'var(--color-secondary)' }}
              strokeWidth={12}
            />
            <Paragraph className="text-text-secondary mt-6 text-lg">
              Please wait while we process your file. Do not close this window.
            </Paragraph>
          </div>
        )}

        {/* Step 3: Complete */}
        {currentStep === 3 && uploadResult && (
          <div className="animate-fade-in">
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success/10 text-success mb-6">
                <CheckCircleOutlined className="text-5xl" />
              </div>
              <Title level={2} className="!mb-2 text-text-primary">
                Upload Complete!
              </Title>
              <Paragraph className="text-text-secondary text-lg">
                Your data has been successfully processed.
              </Paragraph>
            </div>

            <Row gutter={[16, 16]} className="mt-6 mb-8 max-w-2xl mx-auto">
              <Col span={12}>
                <Card className="rounded-xl border-border bg-surface shadow-sm text-center">
                  <Statistic
                    title={<span className="text-text-tertiary">Successfully Created</span>}
                    value={uploadResult.success || 0}
                    styles={{ content: { color: 'var(--ant-success-color)', fontWeight: 'bold' } }}
                    prefix={<CheckCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card className="rounded-xl border-border bg-surface shadow-sm text-center">
                  <Statistic
                    title={<span className="text-text-tertiary">Failed</span>}
                    value={uploadResult.failed || 0}
                    styles={{ content: { color: 'var(--ant-error-color)', fontWeight: 'bold' } }}
                    prefix={<CloseCircleOutlined />}
                  />
                </Card>
              </Col>
            </Row>

            {uploadResult.errors && uploadResult.errors.length > 0 && (
              <Alert
                title="Some institutions failed to upload"
                description={
                  <div className="mt-2">
                    <ul className="list-disc pl-4 space-y-1 text-sm">
                      {uploadResult.errors.slice(0, 5).map((err, idx) => (
                        <li key={idx}>
                          Row {err.row}: {err.message}
                        </li>
                      ))}
                    </ul>
                    {uploadResult.errors.length > 5 && (
                      <Text className="text-text-tertiary text-xs mt-2 block">
                        ...and {uploadResult.errors.length - 5} more errors
                      </Text>
                    )}
                  </div>
                }
                type="warning"
                showIcon
                className="mb-8 rounded-xl border-warning/20 bg-warning/5 max-w-3xl mx-auto"
              />
            )}

            <div className="text-center">
              <Button 
                type="primary" 
                size="large" 
                onClick={handleReset}
                className="rounded-xl px-8 font-bold shadow-lg shadow-primary/20"
              >
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