import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Input,
  Typography,
  Spin,
  Empty,
  Button,
  Tooltip,
  Tag,
  Table,
  Breadcrumb,
  message,
  Alert,
  Modal,
} from 'antd';
import {
  FolderOutlined,
  FolderOpenOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  FileUnknownOutlined,
  SearchOutlined,
  DownloadOutlined,
  SafetyCertificateOutlined,
  EyeOutlined,
  HomeOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  LinkOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { stateService } from '../../../services/state.service';

const { Text } = Typography;

// File type configurations
const FILE_TYPE_CONFIG = {
  'joining-letters': {
    name: 'Joining Report',
    icon: <SafetyCertificateOutlined />,
    color: '#52c41a',
    bgColor: 'bg-green-50',
    fileType: 'joining-letter',
  },
  'monthly-reports': {
    name: 'Monthly Reports',
    icon: <FileTextOutlined />,
    color: '#1890ff',
    bgColor: 'bg-blue-50',
    fileType: 'monthly-report',
  },
  'visit-logs': {
    name: 'Visit Logs',
    icon: <EyeOutlined />,
    color: '#10b981',
    bgColor: 'bg-emerald-50',
    fileType: 'visit-document',
  },
  'documents': {
    name: 'Documents',
    icon: <FolderOutlined />,
    color: '#722ed1',
    bgColor: 'bg-purple-50',
    fileType: 'document',
  },
};

// Get file icon based on type
const getFileIcon = (type, fileName) => {
  if (type === 'JOINING_LETTER') return <SafetyCertificateOutlined className="text-green-500" />;
  if (type === 'MONTHLY_REPORT') return <FileTextOutlined className="text-blue-500" />;
  if (type === 'VISIT_DOCUMENT') return <FileTextOutlined className="text-emerald-500" />;
  if (type === 'VISIT_PHOTO') return <FileImageOutlined className="text-emerald-500" />;
  const ext = fileName?.split('.').pop()?.toLowerCase();
  if (['pdf'].includes(ext)) return <FilePdfOutlined className="text-red-500" />;
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return <FileImageOutlined className="text-purple-500" />;
  return <FileUnknownOutlined className="text-gray-400" />;
};

const ComplianceFileExplorer = ({ institutionId, institutionName }) => {
  const [loading, setLoading] = useState(false);
  const [fileTree, setFileTree] = useState(null);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentFolder, setCurrentFolder] = useState(null); // null = root view
  const [refreshingFile, setRefreshingFile] = useState(null); // Track which file URL is being refreshed
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewFileName, setPreviewFileName] = useState('');

  // Fetch file explorer data
  const fetchFileExplorer = useCallback(async (showMessage = false) => {
    if (!institutionId) return;

    setLoading(true);
    setError(null);
    try {
      const response = await stateService.getInstitutionFileExplorer(institutionId);
      if (response.error) {
        throw new Error(response.error);
      }
      setFileTree(response);
      if (showMessage) {
        message.success('Files refreshed successfully');
      }
    } catch (err) {
      console.error('Failed to fetch files:', err);
      setError(err.message || 'Failed to load files');
      setFileTree(null);
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    if (institutionId) {
      fetchFileExplorer();
      setCurrentFolder(null);
      setSearchTerm('');
    }
  }, [institutionId, fetchFileExplorer]);

  const uniqueFolders = useMemo(() => {
    if (!fileTree?.folders) return [];

    // Define the expected folder types
    const expectedTypes = ['documents', 'visit-logs', 'monthly-reports', 'joining-letters'];

    const normalizeType = (folder) => {
      const rawType = (folder.type || '').toString().trim();
      const normalizedType = rawType.toLowerCase().replace(/_/g, '-');
      if (FILE_TYPE_CONFIG[normalizedType]) return normalizedType;
      if (FILE_TYPE_CONFIG[rawType]) return rawType;

      const name = (folder.name || '').toLowerCase();
      if (normalizedType.includes('joining') || name.includes('joining')) return 'joining-letters';
      if (normalizedType.includes('monthly') || name.includes('monthly')) return 'monthly-reports';
      if (normalizedType.includes('visit') || name.includes('visit')) return 'visit-logs';
      if (normalizedType.includes('document') || name.includes('document')) return 'documents';
      return 'documents'; // Default fallback
    };

    // Group files by expected folder types
    const folderGroups = new Map();

    // Initialize expected folders
    expectedTypes.forEach(type => {
      folderGroups.set(type, {
        type,
        name: FILE_TYPE_CONFIG[type].name,
        count: 0,
        files: [],
      });
    });

    // Process actual folders from backend
    fileTree.folders.forEach((folder) => {
      const normalizedType = normalizeType(folder);
      const existing = folderGroups.get(normalizedType);

      if (existing) {
        existing.count = (existing.count || 0) + (folder.count || 0);
        existing.files = [...(existing.files || []), ...(folder.files || [])];
      }
    });

    // Return all expected folders, even if they have no files
    return Array.from(folderGroups.values());
  }, [fileTree]);

  // Get current folder data
  const currentFolderData = useMemo(() => {
    if (!uniqueFolders.length) return null;
    if (!currentFolder) return null;
    return uniqueFolders.find(f => f.type === currentFolder) || null;
  }, [uniqueFolders, currentFolder]);

  // Filter files by search
  const filteredFiles = useMemo(() => {
    if (!currentFolderData?.files) return [];
    if (!searchTerm) return currentFolderData.files;

    const search = searchTerm.toLowerCase();
    return currentFolderData.files.filter(f =>
      f.name?.toLowerCase().includes(search) ||
      f.studentName?.toLowerCase().includes(search) ||
      f.rollNumber?.toLowerCase().includes(search) ||
      f.companyName?.toLowerCase().includes(search)
    );
  }, [currentFolderData, searchTerm]);

  // Handle file download/view with URL refresh support
  const handleFileAction = useCallback(async (file, action = 'view') => {
    // If URL is available, use it directly
    if (file.downloadUrl) {
      if (action === 'view') {
        // For PDFs and images, open in new tab for preview
        const ext = file.name?.split('.').pop()?.toLowerCase();
        if (['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
          setPreviewUrl(file.downloadUrl);
          setPreviewFileName(file.name);
        } else {
          window.open(file.downloadUrl, '_blank');
        }
      } else {
        window.open(file.downloadUrl, '_blank');
      }
      return;
    }

    // If URL is not available, try to refresh it
    if (file.urlError || !file.downloadUrl) {
      setRefreshingFile(file.id);
      try {
        const config = FILE_TYPE_CONFIG[currentFolder];
        if (!config) {
          message.error('Unknown file type');
          return;
        }

        const resolvedFileType = currentFolder === 'visit-logs'
          ? (file.type === 'VISIT_PHOTO' ? 'visit-photo' :
             file.type === 'VISIT_SIGNED_DOCUMENT' ? 'visit-signed-document' :
             'visit-document')
          : config.fileType;

        const result = await stateService.getFilePresignedUrl(resolvedFileType, file.id);
        if (result.downloadUrl) {
          // Update the file in state with new URL
          setFileTree(prev => {
            if (!prev) return prev;
            const newFolders = prev.folders.map(folder => {
              if (folder.type !== currentFolder) return folder;
              return {
                ...folder,
                files: folder.files.map(f =>
                  f.id === file.id
                    ? { ...f, downloadUrl: result.downloadUrl, urlError: null }
                    : f
                ),
              };
            });
            return { ...prev, folders: newFolders };
          });

          // Open the file
          if (action === 'view') {
            const ext = file.name?.split('.').pop()?.toLowerCase();
            if (['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
              setPreviewUrl(result.downloadUrl);
              setPreviewFileName(file.name);
            } else {
              window.open(result.downloadUrl, '_blank');
            }
          } else {
            window.open(result.downloadUrl, '_blank');
          }
        } else {
          message.error(result.error || 'Failed to generate download URL');
        }
      } catch (err) {
        console.error('Failed to refresh URL:', err);
        message.error('Failed to access file. Please try again.');
      } finally {
        setRefreshingFile(null);
      }
    }
  }, [currentFolder]);

  // Table columns for file list
  const columns = [
    {
      title: 'Name',
      key: 'name',
      render: (_, record) => (
        <div className="flex items-center gap-3">
          {getFileIcon(record.type, record.name)}
          <div className="min-w-0">
            <Text className="block text-sm font-medium text-gray-900 truncate max-w-[200px]">
              {record.name}
            </Text>
            <Text className="text-xs text-gray-500">
              {record.studentName} ({record.rollNumber})
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Details',
      key: 'details',
      width: 180,
      render: (_, record) => (
        <div className="text-sm text-gray-500">
          {record.companyName && <div className="truncate max-w-[160px]">{record.companyName}</div>}
          {record.month && record.year && (
            <div>{dayjs().month(record.month - 1).format('MMM')} {record.year}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'uploadedAt',
      key: 'date',
      width: 100,
      render: (date) => (
        <Text className="text-xs text-gray-500">
          {date ? dayjs(date).format('DD MMM YY') : '-'}
        </Text>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
      render: (_, record) => {
        if (record.urlError) {
          return (
            <Tooltip title={record.urlError}>
              <Tag color="warning" icon={<ExclamationCircleOutlined />}>
                Unavailable
              </Tag>
            </Tooltip>
          );
        }
        if (record.downloadUrl) {
          return (
            <Tag color="success" icon={<LinkOutlined />}>
              Ready
            </Tag>
          );
        }
        return <Tag color="default">-</Tag>;
      },
    },
    {
      title: '',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <div className="flex items-center gap-1">
          <Tooltip title={record.downloadUrl ? 'View' : 'Generate URL & View'}>
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              loading={refreshingFile === record.id}
              onClick={() => handleFileAction(record, 'view')}
              className="text-gray-400 hover:text-primary"
            />
          </Tooltip>
          <Tooltip title={record.downloadUrl ? 'Download' : 'Generate URL & Download'}>
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined />}
              loading={refreshingFile === record.id}
              onClick={() => handleFileAction(record, 'download')}
              className="text-gray-400 hover:text-primary"
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  // Render folder cards (root view)
  const renderFolderCards = () => {
    if (!uniqueFolders.length) return null;

    return (
      <div className="space-y-4">
        {/* URL Error Warning */}
        {fileTree.summary?.urlErrors > 0 && (
          <Alert
            type="warning"
            showIcon
            icon={<ClockCircleOutlined />}
            message={`${fileTree.summary.urlErrors} file(s) need URL refresh`}
            description="Some files may require re-generating download URLs. Click on them to refresh."
            className="mb-4"
          />
        )}

        <div className="grid grid-cols-3 gap-4">
          {uniqueFolders.map((folder) => {
            const config = FILE_TYPE_CONFIG[folder.type] || FILE_TYPE_CONFIG.documents;
            const hasErrors = folder.files?.some(f => f.urlError);
            return (
              <div
                key={folder.type}
                onClick={() => setCurrentFolder(folder.type)}
                className={`
                  p-4 rounded-xl border-2 cursor-pointer transition-all duration-200
                  hover:shadow-md hover:scale-[1.02]
                  ${config.bgColor} border-transparent hover:border-primary/30
                `}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm"
                    style={{ backgroundColor: config.color }}
                  >
                    {config.icon}
                  </div>
                  <div className="text-right">
                    <Text className="text-3xl font-bold block" style={{ color: config.color }}>
                      {folder.count}
                    </Text>
                    {hasErrors && (
                      <Tooltip title="Some files need URL refresh">
                        <ExclamationCircleOutlined className="text-warning text-sm" />
                      </Tooltip>
                    )}
                  </div>
                </div>
                <Text className="font-semibold text-gray-900 block text-base">{config.name}</Text>
                <Text className="text-xs text-gray-500">
                  {folder.count} file{folder.count !== 1 ? 's' : ''} available
                </Text>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        {fileTree.summary && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Total: {fileTree.summary.totalFiles} files</span>
              {fileTree.generatedAt && (
                <span className="flex items-center gap-1">
                  <ClockCircleOutlined className="text-xs" />
                  Cached {dayjs(fileTree.generatedAt).fromNow()}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render file list (folder view)
  const renderFileList = () => {
    if (!currentFolderData) return null;
    const config = FILE_TYPE_CONFIG[currentFolder] || FILE_TYPE_CONFIG.documents;

    return (
      <div className="h-full flex flex-col">
        {/* Folder header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm"
              style={{ backgroundColor: config.color }}
            >
              {config.icon}
            </div>
            <div>
              <Text className="font-semibold text-gray-900 text-base">{config.name}</Text>
              <Text className="text-xs text-gray-500 block">{filteredFiles.length} files</Text>
            </div>
          </div>
          <Input
            placeholder="Search files..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            allowClear
            className="w-56"
          />
        </div>

        {/* File table */}
        <div className="flex-1 overflow-auto">
          <Table
            columns={columns}
            dataSource={filteredFiles}
            rowKey="id"
            size="small"
            pagination={filteredFiles.length > 20 ? { pageSize: 20, showSizeChanger: false } : false}
            scroll={{ y: 'calc(100vh - 480px)' }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={searchTerm ? 'No files match your search' : 'No files in this folder'}
                />
              ),
            }}
            rowClassName="hover:bg-gray-50"
          />
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-3">
        <Spin size="large" />
        <Text className="text-gray-500 text-sm">Loading files...</Text>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-3">
        <ExclamationCircleOutlined className="text-4xl text-red-400" />
        <Text className="text-red-500 font-medium">{error}</Text>
        <Button type="primary" onClick={() => fetchFileExplorer()}>Retry</Button>
      </div>
    );
  }

  if (!institutionId) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-3">
        <FolderOutlined className="text-4xl text-gray-300" />
        <Text className="text-gray-500">Select an institution to view files</Text>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Breadcrumb navigation */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
        <Breadcrumb
          items={[
            {
              title: (
                <span
                  className="cursor-pointer hover:text-primary flex items-center gap-1"
                  onClick={() => {
                    setCurrentFolder(null);
                    setSearchTerm('');
                  }}
                >
                  <HomeOutlined /> Files
                </span>
              ),
            },
            ...(currentFolder ? [{
              title: FILE_TYPE_CONFIG[currentFolder]?.name || currentFolder,
            }] : []),
          ]}
        />
        <div className="flex items-center gap-2">
          {fileTree?.summary && (
            <Text className="text-xs text-gray-500">
              {fileTree.summary.totalFiles} total files
            </Text>
          )}
          <Tooltip title="Refresh files">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined spin={loading} />}
              onClick={() => fetchFileExplorer(true)}
            />
          </Tooltip>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {!currentFolder ? renderFolderCards() : renderFileList()}
      </div>

      {/* Preview Modal */}
      <Modal
        title={previewFileName}
        open={!!previewUrl}
        onCancel={() => {
          setPreviewUrl(null);
          setPreviewFileName('');
        }}
        footer={[
          <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={() => window.open(previewUrl, '_blank')}>
            Download
          </Button>,
        ]}
        width={800}
        bodyStyle={{ padding: 0, height: '70vh' }}
      >
        {previewUrl && (
          <iframe
            src={previewUrl}
            title={previewFileName}
            className="w-full h-full border-0"
          />
        )}
      </Modal>
    </div>
  );
};

export default ComplianceFileExplorer;
