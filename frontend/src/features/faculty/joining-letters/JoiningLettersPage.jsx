import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Input,
  Typography,
  Avatar,
  Tooltip,
  Drawer,
  Descriptions,
  Upload,
  Select,
  theme,
} from 'antd';
import { toast } from 'react-hot-toast';
import {
  FileProtectOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  SearchOutlined,
  ReloadOutlined,
  UserOutlined,
  CalendarOutlined,
  BankOutlined,
  DownloadOutlined,
  DeleteOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  fetchJoiningLetters,
  deleteJoiningLetter,
  uploadJoiningLetter,
  fetchAssignedStudents,
  selectJoiningLetters,
  selectLastFetched,
} from '../store/facultySlice';
import { openFileWithPresignedUrl } from '../../../utils/imageUtils';

const { Title, Text } = Typography;

const JoiningLettersPage = () => {
  const { token } = theme.useToken();
  const dispatch = useDispatch();
  const { list: letters = [], loading, total = 0 } = useSelector(selectJoiningLetters);
  const lastFetched = useSelector(selectLastFetched);
  const joiningLettersLastFetched = lastFetched?.joiningLetters;

  const [searchText, setSearchText] = useState('');
  const [detailDrawer, setDetailDrawer] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState(null);
  const [uploadModal, setUploadModal] = useState({ visible: false, student: null });
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

  useEffect(() => {
    dispatch(fetchJoiningLetters({ page: pagination.current, limit: pagination.pageSize, forceRefresh: true }));
    // Fetch students for the upload dropdown
    dispatch(fetchAssignedStudents({ limit: 1000 })).then((result) => {
      if (result.payload && result.payload.students) {
        setStudents(result.payload.students);
      }
    });
  }, [dispatch, pagination.current, pagination.pageSize]);

  const handleRefresh = () => {
    dispatch(fetchJoiningLetters({ page: pagination.current, limit: pagination.pageSize, forceRefresh: true }));
  };

  const handleDelete = (letter) => {
    Modal.confirm({
      title: 'Delete Joining Report',
      content: 'Are you sure you want to delete this joining report? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      centered: true,
      onOk: async () => {
        try {
          await dispatch(deleteJoiningLetter(letter.id)).unwrap();
          toast.success('Joining report deleted successfully');
          handleRefresh();
        } catch (error) {
          toast.error(error || 'Failed to delete joining report');
        }
      },
    });
  };

  const handleView = async (letter) => {
    if (letter.joiningLetterUrl) {
      await openFileWithPresignedUrl(letter.joiningLetterUrl);
    } else {
      toast('No document available', { icon: 'ℹ️' });
    }
  };

  const handleViewDetails = (letter) => {
    setSelectedLetter(letter);
    setDetailDrawer(true);
  };

  const handleUploadClick = () => {
    setUploadModal({ visible: true, student: null });
    setSelectedFile(null);
  };

  const handleFileChange = (info) => {
    if (info.fileList.length > 0) {
      setSelectedFile(info.fileList[0].originFileObj);
    } else {
      setSelectedFile(null);
    }
  };

  const handleUpload = async () => {
    if (!uploadModal.student || !selectedFile) {
      toast('Please select a student and file', { icon: '⚠️' });
      return;
    }

    setUploadLoading(true);
    try {
      // Find the application for the selected student
      const studentData = students.find(s => s.student.id === uploadModal.student);
      if (!studentData || !studentData.student.internshipApplications || studentData.student.internshipApplications.length === 0) {
        toast.error('No active internship application found for this student');
        setUploadLoading(false);
        return;
      }

      // Get the most recent application
      const application = studentData.student.internshipApplications[0];

      await dispatch(uploadJoiningLetter({ applicationId: application.id, file: selectedFile })).unwrap();
      toast.success('Joining report uploaded successfully');
      setUploadModal({ visible: false, student: null });
      setSelectedFile(null);
      handleRefresh();
    } catch (error) {
      toast.error(error || 'Failed to upload joining report');
    } finally {
      setUploadLoading(false);
    }
  };

  // Filter letters based on search
  const getFilteredLetters = () => {
    let filtered = letters;

    if (searchText) {
      filtered = filtered.filter(l =>
        (l.student?.user?.name || l.student?.name)?.toLowerCase().includes(searchText.toLowerCase()) ||
        (l.student?.user?.rollNumber || l.student?.rollNumber)?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    return filtered;
  };

  const filteredLetters = useMemo(() => getFilteredLetters(), [letters, searchText]);

  const totalForPagination = searchText ? filteredLetters.length : total;

  const columns = [
    {
      title: 'Student',
      key: 'student',
      width: '22%',
      render: (_, record) => {
        const student = record.student;
        return (
          <div className="flex items-center gap-3">
            <Avatar icon={<UserOutlined />} style={{ backgroundColor: token.colorPrimary }} />
            <div>
              <div className="font-semibold" style={{ color: token.colorText }}>{student?.user?.name || student?.name || 'Unknown'}</div>
              <div className="text-xs" style={{ color: token.colorTextTertiary }}>{student?.user?.rollNumber || student?.rollNumber}</div>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Company',
      key: 'company',
      width: '20%',
      render: (_, record) => {
        const company = record.internship?.industry;
        const companyName = company?.companyName || record.companyName;
        return (
          <div className="flex items-center gap-2">
            <BankOutlined style={{ color: token.colorSuccess }} />
            <span style={{ color: token.colorText }}>{companyName || 'Self-Identified'}</span>
          </div>
        );
      },
    },
    {
      title: 'Uploaded',
      key: 'uploaded',
      width: '12%',
      render: (_, record) => {
        const date = record.joiningLetterUploadedAt || record.updatedAt || record.createdAt;
        return date ? dayjs(date).format('DD/MM/YYYY') : '-';
      },
      sorter: (a, b) => {
        const dateA = a.joiningLetterUploadedAt || a.updatedAt || a.createdAt;
        const dateB = b.joiningLetterUploadedAt || b.updatedAt || b.createdAt;
        return new Date(dateA) - new Date(dateB);
      },
    },
    {
      title: 'Status',
      key: 'status',
      width: '12%',
      render: () => (
        <Tag color="green" icon={<CheckCircleOutlined />}>
          Uploaded
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '20%',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetails(record)}
            />
          </Tooltip>
          {record.joiningLetterUrl && (
            <Tooltip title="View Document">
              <Button
                type="text"
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => handleView(record)}
              />
            </Tooltip>
          )}
          <Tooltip title="Delete">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];


  return (
    <div className="p-4 md:p-6 min-h-screen" style={{ backgroundColor: token.colorBgLayout }}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
            <div className="flex items-center gap-2">
              <div>
                <div className="flex items-center gap-2">
            <Title level={4} className="mb-0" style={{ color: token.colorText }}>
              Joining Reports
            </Title>
            {joiningLettersLastFetched && (
              <span className="text-xs" style={{ color: token.colorTextTertiary }}>
                Updated {new Date(joiningLettersLastFetched).toLocaleTimeString()}
              </span>
            )}
                </div>
                <Text className="text-xs" style={{ color: token.colorTextSecondary }}>
            View and manage student joining report documents
                </Text>
              </div>
            </div>

            <Space size="small" className="w-full lg:w-auto" wrap>
              <Button
                type="primary"
                icon={<UploadOutlined />}
                onClick={handleUploadClick}
                className="rounded-lg w-full lg:w-auto"
                size="small"
              >
                Upload Report
              </Button>
              <Button
                icon={<ReloadOutlined spin={loading} />}
                onClick={handleRefresh}
                loading={loading}
                className="rounded-lg w-full lg:w-auto"
                size="small"
              >
                Refresh
              </Button>
            </Space>
          </div>

          {/* Statistics Card */}
        {/* <Card size="small" className="rounded-xl shadow-sm max-w-xs" style={{ borderColor: token.colorBorder, backgroundColor: token.colorBgContainer }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: token.colorSuccessBg, color: token.colorSuccess }}>
              <FileProtectOutlined className="text-lg" />
            </div>
            <div>
              <div className="text-2xl font-bold" style={{ color: token.colorText }}>{letters.length}</div>
              <div className="text-[10px] uppercase font-bold" style={{ color: token.colorTextTertiary }}>Total Joining Letters</div>
            </div>
          </div>
        </Card> */}

        {/* Search and Table */}
        <Card className="rounded-2xl shadow-sm overflow-hidden" style={{ borderColor: token.colorBorder, backgroundColor: token.colorBgContainer }} styles={{ body: { padding: 0 } }}>
          <div className="p-4" style={{ borderBottom: `1px solid ${token.colorBorder}` }}>
            <Input
              placeholder="Search by student name or roll number..."
              prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full lg:max-w-md rounded-lg h-10"
              allowClear
            />
          </div>

          <Table
            columns={columns}
            dataSource={filteredLetters}
            loading={loading}
            rowKey="id"
            scroll={{ x: 'max-content' }}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: totalForPagination,
              onChange: (current, pageSize) => {
                setPagination({ current, pageSize });
              },
              showSizeChanger: true,
              showTotal: (value) => `Total ${value} letters`,
              className: 'px-4 py-3',
            }}
            size="middle"
            className="custom-table"
          />
        </Card>
      </div>

      {/* Upload Modal */}
      <Modal
        title={
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: token.colorPrimaryBg }}>
              <UploadOutlined style={{ color: token.colorPrimary }} />
            </div>
            <span className="font-bold" style={{ color: token.colorText }}>Upload Joining Report</span>
          </div>
        }
        open={uploadModal.visible}
        onCancel={() => {
          setUploadModal({ visible: false, student: null });
          setSelectedFile(null);
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setUploadModal({ visible: false, student: null });
              setSelectedFile(null);
            }}
            className="rounded-lg"
          >
            Cancel
          </Button>,
          <Button
            key="upload"
            type="primary"
            loading={uploadLoading}
            onClick={handleUpload}
            className="rounded-lg"
            disabled={!uploadModal.student || !selectedFile}
          >
            Upload
          </Button>,
        ]}
        className="rounded-2xl"
      >
        <div className="space-y-4">
          <div>
            <Text className="block mb-2 font-medium">
              Select Student <span className="text-red-500">*</span>
            </Text>
            <Select
              showSearch
              placeholder="Search by name or roll number..."
              style={{ width: '100%' }}
              value={uploadModal.student}
              onChange={(value) => setUploadModal({ ...uploadModal, student: value })}
              filterOption={(input, option) =>
                option.label.toLowerCase().includes(input.toLowerCase())
              }
              options={students.map((s) => ({
                label: `${s.student?.user?.name || s.student?.name} (${s.student?.user?.rollNumber || s.student?.rollNumber})`,
                value: s.student.id,
              }))}
              size="large"
              className="rounded-lg"
            />
          </div>

          <div>
            <Text className="block mb-2 font-medium">
              Upload File <span className="text-red-500">*</span>
            </Text>
            <Upload.Dragger
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              maxCount={1}
              beforeUpload={() => false}
              onChange={handleFileChange}
              className="rounded-lg"
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined className="text-4xl" style={{ color: token.colorPrimary }} />
              </p>
              <p className="ant-upload-text">Click or drag file to upload</p>
              <p className="ant-upload-hint">
                Support for PDF, DOC, DOCX, JPG, PNG files
              </p>
            </Upload.Dragger>
          </div>

          {uploadModal.student && students.find(s => s.student.id === uploadModal.student) && (
            <div className="p-4 rounded-xl border" style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder }}>
              <Text className="text-xs uppercase font-bold block mb-2" style={{ color: token.colorTextTertiary }}>
                Student Information
              </Text>
              {(() => {
                const studentData = students.find(s => s.student.id === uploadModal.student);
                const application = studentData?.student?.internshipApplications?.[0];
                return (
                  <div className="space-y-1">
                    <div>
                      <Text strong>{studentData?.student?.user?.name || studentData?.student?.name}</Text>
                    </div>
                    <div className="text-sm" style={{ color: token.colorTextSecondary }}>
                      {studentData?.student?.user?.rollNumber || studentData?.student?.rollNumber}
                    </div>
                    {application && (
                      <div className="text-sm mt-2" style={{ color: token.colorTextSecondary }}>
                        Company: {application.internship?.industry?.companyName || 'Self-Identified'}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center border" style={{ backgroundColor: token.colorPrimaryBg, borderColor: token.colorPrimaryBorder }}>
              <FileProtectOutlined style={{ color: token.colorPrimary }} />
            </div>
            <span className="font-bold" style={{ color: token.colorText }}>Joining Report Details</span>
          </div>
        }
        placement="right"
        size="default"
        onClose={() => {
          setDetailDrawer(false);
          setSelectedLetter(null);
        }}
        open={detailDrawer}
        styles={{ mask: { backdropFilter: 'blur(4px)' } }}
      >
        {selectedLetter && (
          <div className="space-y-6">
            {/* Status Banner */}
            <div className="p-4 rounded-xl border" style={{
              backgroundColor: token.colorSuccessBg,
              borderColor: token.colorSuccessBorder
            }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileProtectOutlined style={{ color: token.colorPrimary }} />
                  <span className="font-bold" style={{ color: token.colorText }}>Joining Report</span>
                </div>
                <Tag color="green" icon={<CheckCircleOutlined />}>
                  Uploaded
                </Tag>
              </div>
            </div>

            {/* Student Information */}
            <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: token.colorBorder, backgroundColor: `${token.colorTextTertiary}1A` }}>
                <Text className="text-xs uppercase font-bold flex items-center gap-2" style={{ color: token.colorTextTertiary }}>
                  <UserOutlined style={{ color: token.colorPrimary }} /> Student Information
                </Text>
              </div>
              <div className="p-4">
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Name">
                    <Text strong>{selectedLetter.student?.user?.name || selectedLetter.student?.name}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Roll Number">
                    {selectedLetter.student?.user?.rollNumber || selectedLetter.student?.rollNumber}
                  </Descriptions.Item>
                  <Descriptions.Item label="Email">
                    {selectedLetter.student?.user?.email || selectedLetter.student?.email || '-'}
                  </Descriptions.Item>
                </Descriptions>
              </div>
            </div>

            {/* Internship Information */}
            <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: token.colorBorder, backgroundColor: `${token.colorTextTertiary}1A` }}>
                <Text className="text-xs uppercase font-bold flex items-center gap-2" style={{ color: token.colorTextTertiary }}>
                  <BankOutlined style={{ color: token.colorSuccess }} /> Internship Details
                </Text>
              </div>
              <div className="p-4">
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Company">
                    {selectedLetter.internship?.industry?.companyName || selectedLetter.companyName || 'Self-Identified'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Internship Type">
                    <Tag color="purple">Self-Identified</Tag>
                  </Descriptions.Item>
                </Descriptions>
              </div>
            </div>

            {/* Document Details */}
            <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: token.colorBorder, backgroundColor: `${token.colorTextTertiary}1A` }}>
                <Text className="text-xs uppercase font-bold flex items-center gap-2" style={{ color: token.colorTextTertiary }}>
                  <CalendarOutlined style={{ color: token.colorInfo }} /> Document Details
                </Text>
              </div>
              <div className="p-4">
                <Text className="text-[10px] uppercase font-bold block mb-1" style={{ color: token.colorTextTertiary }}>Uploaded On</Text>
                <Text style={{ color: token.colorText }}>
                  {(() => {
                    const date = selectedLetter.joiningLetterUploadedAt || selectedLetter.updatedAt || selectedLetter.createdAt;
                    return date ? dayjs(date).format('DD MMM YYYY, HH:mm') : '-';
                  })()}
                </Text>
              </div>
            </div>

            {/* Document Preview */}
            {selectedLetter.joiningLetterUrl && (
              <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder }}>
                <div className="px-4 py-3 border-b" style={{ borderColor: token.colorBorder, backgroundColor: `${token.colorTextTertiary}1A` }}>
                  <Text className="text-xs uppercase font-bold flex items-center gap-2" style={{ color: token.colorTextTertiary }}>
                    <FileProtectOutlined style={{ color: token.colorPrimary }} /> Document
                  </Text>
                </div>
                <div className="p-4 flex justify-center">
                  <Button
                    type="primary"
                    icon={<EyeOutlined />}
                    onClick={() => handleView(selectedLetter)}
                    className="rounded-lg"
                  >
                    View Document
                  </Button>
                </div>
              </div>
            )}

          </div>
        )}
      </Drawer>
    </div>
  );
};

export default JoiningLettersPage;