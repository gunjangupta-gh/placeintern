import React, { memo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Typography, Button, Tag, Tooltip, Modal, Upload, Space, theme } from 'antd';
import { toast } from 'react-hot-toast';
import {
  FileTextOutlined,
  CheckCircleOutlined,
  UploadOutlined,
  EyeOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import { openFileWithPresignedUrl } from '../../../../utils/imageUtils';
import { uploadJoiningLetter, deleteJoiningLetter } from '../../store/studentSlice';

const { Text } = Typography;

const JoiningLetterCard = ({
  application,
  onRefresh,
  loading = false,
  compact = true,
}) => {
  const { token } = theme.useToken();
  const dispatch = useDispatch();
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Check if application has joining report
  const hasJoiningLetter = !!(application?.joiningLetter || application?.joiningLetterUrl);
  const joiningLetterUrl = application?.joiningLetter || application?.joiningLetterUrl;

  // Handle file selection
  const handleFileSelect = (file) => {
    const isPdf = file.type === 'application/pdf';
    const isLt5M = file.size / 1024 / 1024 < 5;

    if (!isPdf) {
      toast.error('Only PDF files are allowed');
      return false;
    }

    if (!isLt5M) {
      toast.error('File must be smaller than 5MB');
      return false;
    }

    setSelectedFile(file);
    return false; // Prevent auto-upload
  };

  // Handle upload
  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    try {
      setUploading(true);
      await dispatch(uploadJoiningLetter({ applicationId: application.id, file: selectedFile })).unwrap();
      setUploadModalVisible(false);
      setSelectedFile(null);
      toast.success('Joining Report uploaded successfully');

      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to upload joining report';
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    try {
      setUploading(true);
      await dispatch(deleteJoiningLetter(application.id)).unwrap();
      setDeleteConfirmVisible(false);
      toast.success('Joining Report deleted successfully');

      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to delete joining report';
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  // Handle view
  const handleView = async () => {
    if (joiningLetterUrl) {
      await openFileWithPresignedUrl(joiningLetterUrl);
    }
  };

  if (!application) {
    return null;
  }

  const statusStyle = hasJoiningLetter
    ? {
        bg: token.colorSuccessBg,
        border: token.colorSuccessBorder,
        text: token.colorSuccessText, // or token.colorSuccess
        iconBg: token.colorSuccessBgHover || '#dcfce7', // fallback if hover token missing
        iconColor: token.colorSuccess,
      }
    : {
        bg: token.colorWarningBg,
        border: token.colorWarningBorder,
        text: token.colorWarningText || token.colorWarning,
        iconBg: token.colorWarningBgHover || '#fef3c7',
        iconColor: token.colorWarning,
      };

  // Compact version for dashboard
  if (compact) {
    return (
      <>
        <div 
          className="p-3 rounded-xl border"
          style={{ 
            backgroundColor: statusStyle.bg, 
            borderColor: statusStyle.border 
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: statusStyle.iconBg }}
              >
                <FileTextOutlined style={{ color: statusStyle.iconColor }} />
              </div>
              <div>
                <Text strong className="text-sm block">Joining Report</Text>
                <Text className="text-xs" style={{ color: statusStyle.text }}>
                  {hasJoiningLetter ? 'Uploaded' : 'Required'}
                </Text>
              </div>
            </div>

            {hasJoiningLetter ? (
              <Space size="small">
                <Tooltip title="View">
                  <Button type="text" size="small" icon={<EyeOutlined />} onClick={handleView} />
                </Tooltip>
                <Tooltip title="Replace">
                  <Button type="text" size="small" icon={<UploadOutlined />} onClick={() => setUploadModalVisible(true)} />
                </Tooltip>
                <Tooltip title="Delete">
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => setDeleteConfirmVisible(true)} />
                </Tooltip>
              </Space>
            ) : (
              <Button
                type="primary"
                size="small"
                icon={<UploadOutlined />}
                onClick={() => setUploadModalVisible(true)}
              >
                Upload
              </Button>
            )}
          </div>
        </div>

        {/* Upload Modal */}
        <Modal
          title={
            <div className="flex items-center gap-2">
              <CloudUploadOutlined style={{ color: token.colorPrimary }} />
              <span>{hasJoiningLetter ? 'Replace' : 'Upload'} Joining Report</span>
            </div>
          }
          open={uploadModalVisible}
          onCancel={() => {
            setUploadModalVisible(false);
            setSelectedFile(null);
          }}
          footer={[
            <Button
              key="cancel"
              onClick={() => {
                setUploadModalVisible(false);
                setSelectedFile(null);
              }}
            >
              Cancel
            </Button>,
            <Button
              key="upload"
              type="primary"
              loading={uploading}
              disabled={!selectedFile}
              onClick={handleUpload}
              icon={uploading ? <LoadingOutlined /> : <UploadOutlined />}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>,
          ]}
        >
          <div className="space-y-4">
            <Upload.Dragger
              accept=".pdf"
              maxCount={1}
              beforeUpload={handleFileSelect}
              onRemove={() => setSelectedFile(null)}
              fileList={selectedFile ? [{ uid: '-1', name: selectedFile.name, status: 'done' }] : []}
            >
              <p className="ant-upload-drag-icon">
                <CloudUploadOutlined style={{ fontSize: '36px', color: token.colorPrimary }} />
              </p>
              <p className="ant-upload-text">Click or drag file to upload</p>
              <p className="ant-upload-hint">PDF only, max 5MB</p>
            </Upload.Dragger>

            {hasJoiningLetter && (
              <div 
                className="p-3 rounded-lg border"
                style={{ 
                  backgroundColor: token.colorWarningBg, 
                  borderColor: token.colorWarningBorder 
                }}
              >
                <Text className="text-sm" style={{ color: token.colorWarningText }}>
                  <ExclamationCircleOutlined className="mr-2" />
                  Uploading a new file will replace the existing joining report.
                </Text>
              </div>
            )}
          </div>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          title={
            <div className="flex items-center gap-2" style={{ color: token.colorError }}>
              <DeleteOutlined />
              <span>Delete Joining Report</span>
            </div>
          }
          open={deleteConfirmVisible}
          onCancel={() => setDeleteConfirmVisible(false)}
          footer={[
            <Button key="cancel" onClick={() => setDeleteConfirmVisible(false)}>
              Cancel
            </Button>,
            <Button key="delete" danger loading={uploading} onClick={handleDelete}>
              Delete
            </Button>,
          ]}
        >
          <p>Are you sure you want to delete the joining report?</p>
          <p className="text-sm" style={{ color: token.colorError }}>This action cannot be undone.</p>
        </Modal>
      </>
    );
  }

  // Full version (for other pages if needed)
  return (
    <>
      <div 
        className="p-4 rounded-xl border"
        style={{ 
          backgroundColor: statusStyle.bg, 
          borderColor: statusStyle.border 
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: statusStyle.iconBg }}
            >
              <FileTextOutlined className="text-2xl" style={{ color: statusStyle.iconColor }} />
            </div>
            <div>
              <Text strong className="text-base block">Joining Report</Text>
              <Text className="text-sm" style={{ color: statusStyle.text }}>
                {hasJoiningLetter ? 'Document uploaded' : 'Upload required'}
              </Text>
            </div>
          </div>

          {hasJoiningLetter && (
            <Tag color="success" icon={<CheckCircleOutlined />}>
              Uploaded
            </Tag>
          )}
        </div>

        <div className="mt-4">
          {hasJoiningLetter ? (
            <Space wrap>
              <Button icon={<EyeOutlined />} onClick={handleView}>
                View
              </Button>
              <Button icon={<UploadOutlined />} onClick={() => setUploadModalVisible(true)}>
                Replace
              </Button>
              <Button danger icon={<DeleteOutlined />} onClick={() => setDeleteConfirmVisible(true)}>
                Delete
              </Button>
            </Space>
          ) : (
            <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadModalVisible(true)} block>
              Upload Joining Report
            </Button>
          )}
        </div>
      </div>

      {/* Modals - same as compact version */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <CloudUploadOutlined style={{ color: token.colorPrimary }} />
            <span>{hasJoiningLetter ? 'Replace' : 'Upload'} Joining Report</span>
          </div>
        }
        open={uploadModalVisible}
        onCancel={() => {
          setUploadModalVisible(false);
          setSelectedFile(null);
        }}
        footer={[
          <Button key="cancel" onClick={() => { setUploadModalVisible(false); setSelectedFile(null); }}>
            Cancel
          </Button>,
          <Button key="upload" type="primary" loading={uploading} disabled={!selectedFile} onClick={handleUpload}>
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>,
        ]}
      >
        <Upload.Dragger
          accept=".pdf"
          maxCount={1}
          beforeUpload={handleFileSelect}
          onRemove={() => setSelectedFile(null)}
          fileList={selectedFile ? [{ uid: '-1', name: selectedFile.name, status: 'done' }] : []}
        >
          <p className="ant-upload-drag-icon">
            <CloudUploadOutlined style={{ fontSize: '36px', color: token.colorPrimary }} />
          </p>
          <p className="ant-upload-text">Click or drag file to upload</p>
          <p className="ant-upload-hint">PDF only, max 5MB</p>
        </Upload.Dragger>
      </Modal>

      <Modal
        title={<span style={{ color: token.colorError }}><DeleteOutlined /> Delete Joining Report</span>}
        open={deleteConfirmVisible}
        onCancel={() => setDeleteConfirmVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setDeleteConfirmVisible(false)}>Cancel</Button>,
          <Button key="delete" danger loading={uploading} onClick={handleDelete}>Delete</Button>,
        ]}
      >
        <p>Are you sure you want to delete the joining report?</p>
      </Modal>
    </>
  );
};

JoiningLetterCard.displayName = 'JoiningLetterCard';

export default memo(JoiningLetterCard);
