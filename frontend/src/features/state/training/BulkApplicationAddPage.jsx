import React, { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  DownloadOutlined,
  ExclamationCircleOutlined,
  FileExcelOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import trainingAdminService from '../../../services/training-admin.service';

const { Dragger } = Upload;
const { Text } = Typography;

const BulkApplicationAddPage = () => {
  const [uploading, setUploading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [result, setResult] = useState(null);

  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true);
      const blob = await trainingAdminService.downloadBulkApplicationTemplate();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'training-bulk-nomination-template.xlsx';
      anchor.click();
      window.URL.revokeObjectURL(url);
      message.success('Template downloaded');
    } catch (error) {
      message.error(error?.response?.data?.message || 'Failed to download template');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleUpload = async () => {
    const file = fileList[0]?.originFileObj;
    if (!file) {
      message.warning('Please select an Excel file');
      return;
    }

    try {
      setUploading(true);
      const response = await trainingAdminService.bulkUploadApplications(file);
      setResult(response);
      message.success(response?.message || 'Bulk upload completed');
    } catch (error) {
      setResult(null);
      message.error(error?.response?.data?.message || 'Bulk upload failed');
    } finally {
      setUploading(false);
    }
  };

  const summary = result?.summary || null;

  const failedRows = useMemo(() => {
    if (!Array.isArray(result?.failedRows)) {
      return [];
    }
    return result.failedRows.map((row, index) => ({ key: `${row.rowNumber}-${index}`, ...row }));
  }, [result]);

  const failedReasonSummary = useMemo(() => {
    if (!failedRows.length) {
      return '';
    }

    const counts = failedRows.reduce((acc, row) => {
      const key = row.reason || 'Unknown error';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([reason, count]) => `${count}x ${reason}`)
      .join(' | ');
  }, [failedRows]);

  const processedRows = useMemo(() => {
    if (!Array.isArray(result?.processedRows)) {
      return [];
    }
    return result.processedRows.map((row, index) => ({ key: `${row.rowNumber}-${index}`, ...row }));
  }, [result]);

  return (
    <div className="p-4 training-ui" role="main" aria-label="Bulk add training nominations">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-800 mb-0.5">Bulk Add Training Nominations</h1>
        <Text type="secondary" className="text-xs">
          Upload nominations in one go with exact faculty and training matching.
        </Text>
      </div>

      <Card className="rounded-xl border-border shadow-none mb-4" styles={{ body: { padding: '16px' } }}>
        <Space wrap>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleDownloadTemplate}
            loading={downloadingTemplate}
          >
            Download Template
          </Button>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={handleUpload}
            loading={uploading}
            disabled={!fileList.length}
          >
            Upload Nominations
          </Button>
        </Space>

        <Divider className="my-4" />

        <Alert
          type="info"
          showIcon
          message="Template includes training names by default"
          description="Fill faculty details carefully. Matching uses faculty name, email, and phone only."
          className="mb-3"
        />

        <Dragger
          accept=".xlsx,.xls"
          maxCount={1}
          fileList={fileList}
          beforeUpload={() => false}
          onChange={({ fileList: nextFileList }) => {
            setFileList(nextFileList);
            setResult(null);
          }}
          disabled={uploading}
        >
          <p className="ant-upload-drag-icon">
            <FileExcelOutlined className="text-3xl text-emerald-600" />
          </p>
          <p className="ant-upload-text">Click or drag Excel file here</p>
          <p className="ant-upload-hint">Supported format: .xlsx or .xls (max 5MB)</p>
        </Dragger>
      </Card>

      {summary && (
        <Card className="rounded-xl border-border shadow-none mb-4" styles={{ body: { padding: '16px' } }}>
          <Row gutter={[16, 16]}>
            <Col xs={12} md={6}>
              <Statistic title="Total Rows" value={summary.totalRows || 0} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="Created" value={summary.created || 0} valueStyle={{ color: '#166534' }} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="Reactivated" value={summary.reactivated || 0} valueStyle={{ color: '#0f766e' }} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="Failed" value={summary.failed || 0} valueStyle={{ color: '#b91c1c' }} />
            </Col>
          </Row>
        </Card>
      )}

      {processedRows.length > 0 && (
        <Card
          className="rounded-xl border-border shadow-none mb-4"
          title={<span className="text-sm font-semibold">Processed Rows</span>}
          styles={{ body: { padding: '12px' } }}
        >
          <Table
            size="small"
            rowKey="key"
            dataSource={processedRows}
            pagination={{ pageSize: 10, size: 'small' }}
            columns={[
              {
                title: 'Row',
                dataIndex: 'rowNumber',
                width: 80,
              },
              {
                title: 'Training',
                dataIndex: 'trainingName',
                render: (value) => <span className="text-xs font-medium text-slate-700">{value}</span>,
              },
              {
                title: 'Faculty',
                dataIndex: 'facultyName',
                render: (value) => <span className="text-xs">{value}</span>,
              },
              {
                title: 'Action',
                dataIndex: 'action',
                width: 130,
                render: (action) => {
                  const color = action === 'CREATED' ? 'green' : action === 'REACTIVATED' ? 'cyan' : 'gold';
                  return <Tag color={color}>{action}</Tag>;
                },
              },
            ]}
          />
        </Card>
      )}

      {failedRows.length > 0 && (
        <Card
          className="rounded-xl border-border shadow-none"
          title={<span className="text-sm font-semibold text-red-700">Failed Rows</span>}
          styles={{ body: { padding: '12px' } }}
        >
          <Alert
            type="warning"
            showIcon
            icon={<ExclamationCircleOutlined />}
            message="Fix these rows and re-upload"
            description={
              failedReasonSummary ||
              'Rows failed due to unmatched/ambiguous faculty or training details.'
            }
            className="mb-3"
          />
          <Table
            size="small"
            rowKey="key"
            dataSource={failedRows}
            pagination={{ pageSize: 10, size: 'small' }}
            columns={[
              {
                title: 'Row',
                dataIndex: 'rowNumber',
                width: 80,
              },
              {
                title: 'Training',
                dataIndex: 'trainingName',
                width: 240,
                render: (value, record) => (
                  <Space direction="vertical" size={0}>
                    <Text className="text-xs">{value || '-'}</Text>
                    {record.trainingStartDate ? (
                      <Text type="secondary" className="text-[11px]">Start: {record.trainingStartDate}</Text>
                    ) : null}
                  </Space>
                ),
              },
              {
                title: 'Faculty Input',
                width: 280,
                render: (_, record) => (
                  <Space direction="vertical" size={0}>
                    <Text className="text-xs">Name: {record.facultyName || '-'}</Text>
                    <Text className="text-xs">Email: {record.facultyEmail || '-'}</Text>
                    <Text className="text-xs">Phone: {record.facultyPhone || '-'}</Text>
                  </Space>
                ),
              },
              {
                title: 'Reason',
                dataIndex: 'reason',
                render: (value) => <Text className="text-xs text-red-700">{value}</Text>,
              },
            ]}
          />
        </Card>
      )}
    </div>
  );
};

export default BulkApplicationAddPage;
