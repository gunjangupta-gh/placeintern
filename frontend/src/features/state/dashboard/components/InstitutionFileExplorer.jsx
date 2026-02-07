import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  Tree,
  Input,
  Typography,
  Spin,
  Empty,
  Button,
  Tooltip,
  Card,
  Tag,
  List,
  Space,
  Divider,
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
  ReloadOutlined,
  CloseOutlined,
  SafetyCertificateOutlined,
  FileProtectOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import API from '../../../../services/api';

const { Text, Title } = Typography;
const { Search } = Input;

// Get icon based on file type
const getFileIcon = (type, fileName) => {
  if (type === 'JOINING_REPORT') {
    // Check file extension for joining reports (can be images or PDFs)
    const ext = fileName?.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
      return <FileImageOutlined className="text-cyan-500" />;
    }
    return <SafetyCertificateOutlined className="text-cyan-500" />;
  }
  if (type === 'MONTHLY_REPORT') return <FileProtectOutlined className="text-blue-500" />;
  if (type === 'PHOTO' || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(fileName?.split('.').pop()?.toLowerCase())) {
    return <FileImageOutlined className="text-purple-500" />;
  }
  if (['pdf'].includes(fileName?.split('.').pop()?.toLowerCase())) {
    return <FilePdfOutlined className="text-red-500" />;
  }
  return <FileUnknownOutlined className="text-gray-500" />;
};

// Get folder icon based on type
const getFolderIcon = (type, expanded) => {
  const Icon = expanded ? FolderOpenOutlined : FolderOutlined;
  const colors = {
    documents: 'text-purple-500',
    'joining-reports': 'text-cyan-500',
    'monthly-reports': 'text-blue-500',
  };
  return <Icon className={colors[type] || 'text-gray-500'} />;
};

const InstitutionFileExplorer = ({ open, onClose, institutionId, institutionName }) => {
  const [loading, setLoading] = useState(false);
  const [fileTree, setFileTree] = useState(null);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedKeys, setExpandedKeys] = useState(['documents', 'joining-reports', 'monthly-reports']);
  const [selectedFile, setSelectedFile] = useState(null);

  // Fetch file explorer data
  const fetchFileExplorer = useCallback(async () => {
    if (!institutionId) return;

    setLoading(true);
    setError(null);
    try {
      const response = await API.get(`/state/institutions/${institutionId}/file-explorer`);
      setFileTree(response.data);
    } catch (err) {
      console.error('Failed to fetch file explorer:', err);
      setError(err.response?.data?.message || 'Failed to load files');
      setFileTree(null);
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    if (open && institutionId) {
      fetchFileExplorer();
    }
  }, [open, institutionId, fetchFileExplorer]);

  // Build tree data structure
  const buildTreeData = useCallback(() => {
    if (!fileTree?.folders) return [];

    const searchLower = searchTerm.toLowerCase();

    return fileTree.folders.map((folder) => {
      // Filter files by search term
      const filteredFiles = searchTerm
        ? folder.files.filter(
            (f) =>
              f.name?.toLowerCase().includes(searchLower) ||
              f.studentName?.toLowerCase().includes(searchLower) ||
              f.rollNumber?.toLowerCase().includes(searchLower) ||
              f.companyName?.toLowerCase().includes(searchLower)
          )
        : folder.files;

      return {
        key: folder.type,
        title: (
          <span className="flex items-center gap-2">
            <span className="font-medium">{folder.name}</span>
            <Tag color="blue" className="text-xs m-0">
              {searchTerm ? filteredFiles.length : folder.count}
            </Tag>
          </span>
        ),
        icon: ({ expanded }) => getFolderIcon(folder.type, expanded),
        children: filteredFiles.map((file) => ({
          key: `${folder.type}-${file.id}`,
          title: (
            <div
              className="flex items-center justify-between w-full pr-2 cursor-pointer hover:bg-primary/5 rounded py-1"
              onClick={() => setSelectedFile({ ...file, folderType: folder.type })}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {getFileIcon(file.type, file.name)}
                <div className="flex flex-col min-w-0">
                  <Text className="text-sm truncate max-w-[180px]">{file.name}</Text>
                  <Text className="text-xs text-text-tertiary truncate max-w-[180px]">
                    {file.studentName} ({file.rollNumber})
                  </Text>
                </div>
              </div>
              {file.downloadUrl && (
                <Tooltip title="Download">
                  <Button
                    type="text"
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(file.downloadUrl, '_blank');
                    }}
                  />
                </Tooltip>
              )}
            </div>
          ),
          isLeaf: true,
        })),
      };
    });
  }, [fileTree, searchTerm]);

  // Handle tree expand
  const handleExpand = (keys) => {
    setExpandedKeys(keys);
  };

  return (
    <Drawer
      title={
        <div className="flex items-center gap-3">
          <FolderOpenOutlined className="text-primary text-lg" />
          <div>
            <Text className="font-semibold text-text-primary block">File Explorer</Text>
            <Text className="text-xs text-text-tertiary">{institutionName || 'Institution Files'}</Text>
          </div>
        </div>
      }
      placement="right"
      width={480}
      onClose={() => {
        onClose();
        setSelectedFile(null);
      }}
      open={open}
      extra={
        <Tooltip title="Refresh">
          <Button
            type="text"
            icon={<ReloadOutlined spin={loading} />}
            onClick={fetchFileExplorer}
            disabled={loading}
          />
        </Tooltip>
      }
      bodyStyle={{ padding: 0 }}
    >
      <div className="h-full flex flex-col">
        {/* Search */}
        <div className="p-3 border-b border-border">
          <Search
            placeholder="Search files by name, student..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            allowClear
            size="small"
          />
        </div>

        {/* Summary */}
        {fileTree?.summary && (
          <div className="p-3 border-b border-border bg-background-tertiary">
            <div className="flex items-center justify-between text-sm">
              <Text className="text-text-tertiary">
                Total Files: <span className="font-semibold text-text-primary">{fileTree.summary.totalFiles}</span>
              </Text>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-blue-500">
                  <FileTextOutlined className="mr-1" />
                  {fileTree.summary.documents}
                </span>
                <span className="text-green-500">
                  <SafetyCertificateOutlined className="mr-1" />
                  {fileTree.summary.joiningLetters}
                </span>
                <span className="text-orange-500">
                  <FileProtectOutlined className="mr-1" />
                  {fileTree.summary.monthlyReports}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* File Tree */}
        <div className="flex-1 overflow-auto p-2">
          {loading ? (
            <div className="flex flex-col justify-center items-center h-full gap-3">
              <Spin />
              <Text className="text-text-tertiary text-sm">Loading files...</Text>
            </div>
          ) : error ? (
            <div className="flex flex-col justify-center items-center h-full gap-3">
              <Text className="text-error">{error}</Text>
              <Button type="primary" size="small" onClick={fetchFileExplorer}>
                Retry
              </Button>
            </div>
          ) : !fileTree?.folders?.length ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No files found" />
          ) : (
            <Tree
              showIcon
              expandedKeys={expandedKeys}
              onExpand={handleExpand}
              treeData={buildTreeData()}
              className="file-explorer-tree"
              blockNode
            />
          )}
        </div>

        {/* Selected File Details */}
        {selectedFile && (
          <div className="border-t border-border p-3 bg-background-tertiary">
            <div className="flex items-center justify-between mb-2">
              <Text className="font-semibold text-text-primary text-sm">File Details</Text>
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={() => setSelectedFile(null)}
              />
            </div>
            <Card size="small" className="shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-background-tertiary flex items-center justify-center">
                  {getFileIcon(selectedFile.type, selectedFile.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <Text className="font-medium text-text-primary block truncate">
                    {selectedFile.name}
                  </Text>
                  <Text className="text-xs text-text-tertiary block">
                    {selectedFile.studentName} ({selectedFile.rollNumber})
                  </Text>
                  {selectedFile.companyName && (
                    <Text className="text-xs text-text-tertiary block">
                      Company: {selectedFile.companyName}
                    </Text>
                  )}
                  {selectedFile.month && selectedFile.year && (
                    <Text className="text-xs text-text-tertiary block">
                      Period: {dayjs().month(selectedFile.month - 1).format('MMMM')} {selectedFile.year}
                    </Text>
                  )}
                  <Text className="text-xs text-text-quaternary block mt-1">
                    Uploaded: {selectedFile.uploadedAt ? dayjs(selectedFile.uploadedAt).format('DD MMM YYYY, HH:mm') : 'N/A'}
                  </Text>
                </div>
              </div>
              {selectedFile.downloadUrl && (
                <Button
                  type="primary"
                  size="small"
                  icon={<DownloadOutlined />}
                  className="w-full mt-3"
                  onClick={() => window.open(selectedFile.downloadUrl, '_blank')}
                >
                  Download / View
                </Button>
              )}
            </Card>
          </div>
        )}
      </div>
    </Drawer>
  );
};

export default InstitutionFileExplorer;
