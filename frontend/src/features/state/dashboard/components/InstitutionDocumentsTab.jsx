import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table,
  Input,
  Select,
  Tag,
  Typography,
  Spin,
  Empty,
  Button,
  Space,
  Tooltip,
  Card,
  Statistic,
  Row,
  Col,
} from 'antd';
import {
  SearchOutlined,
  DownloadOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  FileUnknownOutlined,
  ReloadOutlined,
  FolderOpenOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import API from '../../../../services/api';

const { Text } = Typography;

// Document type labels
const DOCUMENT_TYPE_LABELS = {
  MARKSHEET_10TH: '10th Marksheet',
  MARKSHEET_12TH: '12th Marksheet',
  CASTE_CERTIFICATE: 'Caste Certificate',
  PHOTO: 'Photo',
  OTHER: 'Other Document',
};

const DOCUMENT_TYPE_COLORS = {
  MARKSHEET_10TH: 'blue',
  MARKSHEET_12TH: 'cyan',
  CASTE_CERTIFICATE: 'purple',
  PHOTO: 'green',
  OTHER: 'default',
};

// Get document icon based on file type
const getDocumentIcon = (fileName) => {
  const ext = fileName?.split('.').pop()?.toLowerCase();
  if (['pdf'].includes(ext)) return <FilePdfOutlined className="text-red-500" />;
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return <FileImageOutlined className="text-blue-500" />;
  return <FileUnknownOutlined className="text-gray-500" />;
};

const InstitutionDocumentsTab = ({ institutionId, institutionName }) => {
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Fetch institution documents
  const fetchDocuments = useCallback(async () => {
    if (!institutionId) return;

    setLoading(true);
    setError(null);
    try {
      const response = await API.get(`/state/institutions/${institutionId}/documents`);
      setDocuments(response.data?.documents || []);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
      setError(err.response?.data?.message || 'Failed to load documents');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Filter documents
  const filteredDocuments = useMemo(() => {
    let result = documents;

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(
        (d) =>
          d.studentName?.toLowerCase().includes(search) ||
          d.rollNumber?.toLowerCase().includes(search) ||
          d.fileName?.toLowerCase().includes(search)
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter((d) => d.type === typeFilter);
    }

    return result;
  }, [documents, searchTerm, typeFilter]);

  // Document type summary
  const typeSummary = useMemo(() => {
    const counts = {};
    documents.forEach((d) => {
      counts[d.type] = (counts[d.type] || 0) + 1;
    });
    return counts;
  }, [documents]);

  // Handle document download
  const handleDownload = async (documentId, fileName) => {
    try {
      // Get presigned URL for the document
      const response = await API.get(`/state/documents/${documentId}/url`);
      if (response.data?.url) {
        window.open(response.data.url, '_blank');
      }
    } catch (err) {
      console.error('Failed to get document URL:', err);
    }
  };

  // Table columns
  const columns = [
    {
      title: 'Document',
      key: 'document',
      width: 280,
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-background-tertiary flex items-center justify-center">
            {getDocumentIcon(record.fileName)}
          </div>
          <div>
            <Text className="font-medium text-text-primary block truncate max-w-[200px]">
              {record.fileName}
            </Text>
            <Tag color={DOCUMENT_TYPE_COLORS[record.type]} className="text-[10px] m-0">
              {DOCUMENT_TYPE_LABELS[record.type] || record.type}
            </Tag>
          </div>
        </div>
      ),
    },
    {
      title: 'Student',
      key: 'student',
      width: 200,
      render: (_, record) => (
        <div>
          <Text className="text-text-primary block">{record.studentName || 'Unknown'}</Text>
          <Text className="text-xs text-text-tertiary">{record.rollNumber}</Text>
        </div>
      ),
    },
    {
      title: 'Uploaded',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date) => (
        <Text className="text-text-secondary text-sm">
          {date ? dayjs(date).format('DD MMM YYYY') : '-'}
        </Text>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 80,
      align: 'center',
      render: (_, record) => (
        record.downloadUrl ? (
          <Tooltip title="Download / View">
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => window.open(record.downloadUrl, '_blank')}
            />
          </Tooltip>
        ) : (
          <Tooltip title="File not available">
            <Button type="text" size="small" disabled icon={<DownloadOutlined />} />
          </Tooltip>
        )
      ),
    },
  ];

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-full gap-4">
        <FolderOpenOutlined className="text-4xl text-text-tertiary" />
        <Text className="text-error">{error}</Text>
        <Button type="primary" onClick={fetchDocuments}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Summary Cards */}
      <Row gutter={[12, 12]} className="mb-4">
        <Col span={6}>
          <Card size="small" className="shadow-sm">
            <Statistic
              title={<span className="text-xs">Total Documents</span>}
              value={documents.length}
              prefix={<FileTextOutlined className="text-primary" />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" className="shadow-sm">
            <Statistic
              title={<span className="text-xs">Marksheets</span>}
              value={(typeSummary.MARKSHEET_10TH || 0) + (typeSummary.MARKSHEET_12TH || 0)}
              prefix={<FilePdfOutlined className="text-blue-500" />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" className="shadow-sm">
            <Statistic
              title={<span className="text-xs">Certificates</span>}
              value={typeSummary.CASTE_CERTIFICATE || 0}
              prefix={<FilePdfOutlined className="text-purple-500" />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" className="shadow-sm">
            <Statistic
              title={<span className="text-xs">Photos</span>}
              value={typeSummary.PHOTO || 0}
              prefix={<FileImageOutlined className="text-green-500" />}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search by name, roll no, file..."
            prefix={<SearchOutlined className="text-text-tertiary" />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64"
            allowClear
            size="small"
          />
          <Select
            value={typeFilter}
            onChange={setTypeFilter}
            className="w-40"
            size="small"
          >
            <Select.Option value="all">All Types</Select.Option>
            <Select.Option value="MARKSHEET_10TH">10th Marksheet</Select.Option>
            <Select.Option value="MARKSHEET_12TH">12th Marksheet</Select.Option>
            <Select.Option value="CASTE_CERTIFICATE">Caste Certificate</Select.Option>
            <Select.Option value="PHOTO">Photo</Select.Option>
            <Select.Option value="OTHER">Other</Select.Option>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Text className="text-text-tertiary text-sm">
            Showing {filteredDocuments.length} of {documents.length}
          </Text>
          <Tooltip title="Refresh">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined spin={loading} />}
              onClick={fetchDocuments}
              disabled={loading}
            />
          </Tooltip>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0">
        <Table
          columns={columns}
          dataSource={filteredDocuments}
          rowKey="id"
          size="small"
          loading={loading}
          scroll={{ y: 400 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  searchTerm || typeFilter !== 'all'
                    ? 'No documents match the filters'
                    : 'No documents uploaded yet'
                }
              />
            ),
          }}
        />
      </div>
    </div>
  );
};

export default InstitutionDocumentsTab;
