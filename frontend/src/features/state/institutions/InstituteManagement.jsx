import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  Typography,
  Tag,
  Space,
  Modal,
  Tooltip,
  Alert,
} from 'antd';
import { toast } from 'react-hot-toast';
import {
  BankOutlined,
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  GlobalOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  FilterOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import { useDebounce } from 'use-debounce';

import InstitutionModal from './InstitutionModal';
import {
  fetchInstitutions,
  deleteInstitution,
  selectInstitutions,
  selectInstitutionsLoading,
  selectInstitutionsPagination,
  fetchDashboardStats,
  selectDashboardStats
} from '../store/stateSlice';

const { Text } = Typography;

const InstituteManagement = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Redux State
  const institutions = useSelector(selectInstitutions);
  const loading = useSelector(selectInstitutionsLoading);
  const pagination = useSelector(selectInstitutionsPagination);
  const dashboardStats = useSelector(selectDashboardStats);

  // Local State
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showFilters, setShowFilters] = useState(false);

  // Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [editingInstituteId, setEditingInstituteId] = useState(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [instituteToDelete, setInstituteToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [debouncedSearch] = useDebounce(searchText, 500);

  // Fetch institutions when filters change
  useEffect(() => {
    dispatch(fetchInstitutions({
      page: currentPage,
      limit: pageSize,
      search: debouncedSearch,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }));
  }, [dispatch, currentPage, pageSize, debouncedSearch, statusFilter]);

  // Fetch dashboard stats on mount
  useEffect(() => {
    dispatch(fetchDashboardStats());
  }, [dispatch]);

  const handleRefresh = () => {
    dispatch(fetchInstitutions({
      page: currentPage,
      limit: pageSize,
      search: debouncedSearch,
      status: statusFilter === 'all' ? undefined : statusFilter,
      forceRefresh: true,
    }));
    dispatch(fetchDashboardStats());
  };

  const openCreateModal = () => {
    setEditingInstituteId(null);
    setModalVisible(true);
  };

  const openEditModal = (id) => {
    setEditingInstituteId(id);
    setModalVisible(true);
  };

  const handleViewInstitution = (record) => {
    navigate(`/app/institutions-overview?id=${record.id}`);
  };

  const handleDeleteClick = (record) => {
    setInstituteToDelete(record);
    setDeleteConfirmText('');
    setDeleteModalVisible(true);
  };

  const handleDeleteConfirm = async () => {
    if (!instituteToDelete || deleteConfirmText !== instituteToDelete.name) return;

    setDeleting(true);
    try {
      await dispatch(deleteInstitution(instituteToDelete.id)).unwrap();
      toast.success('Institution deleted successfully');
      setDeleteModalVisible(false);
      setInstituteToDelete(null);
      handleRefresh();
    } catch (error) {
      toast.error(error?.message || 'Failed to delete institution');
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setSearchText('');
    setStatusFilter('all');
    setCurrentPage(1);
  };

  const handleSearch = (value) => {
    setSearchText(value);
    setCurrentPage(1);
  };

  // Table Columns
  const columns = [
    {
      title: 'Institution',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <BankOutlined />
          </div>
          <div className="min-w-0">
            <Tooltip title={text}>
              <div className="font-medium truncate max-w-[180px]">{text}</div>
            </Tooltip>
            <div className="text-gray-500 text-xs truncate max-w-[180px]">{record.code} • {record.address}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type) => (
        <Tag color="blue">
          {type?.replace('_', ' ') || 'N/A'}
        </Tag>
      ),
    },
    {
      title: 'Contact',
      key: 'contact',
      width: 220,
      render: (_, record) => (
        <div className="text-sm">
          {record.contactEmail && <div className="text-gray-600 truncate max-w-[180px]">{record.contactEmail}</div>}
          {record.contactPhone && <div className="text-gray-500 text-xs">{record.contactPhone}</div>}
        </div>
      ),
    },
    {
      title: 'Land Info',
      key: 'landInfo',
      width: 180,
      render: (_, record) => (
        <div className="text-xs text-gray-500">
          <div>Land: {record.totalLandAcres != null ? `${record.totalLandAcres} acres` : 'N/A'}</div>
          <div>Owner: {record.landOwnership ? record.landOwnership.replace(/_/g, ' ') : 'N/A'}</div>
        </div>
      ),
    },
    {
      title: 'Stats',
      key: 'stats',
      width: 120,
      render: (_, record) => (
        <Space size={12}>
          <Tooltip title="Students">
            <span className="text-gray-500">
              <TeamOutlined /> {record._count?.Student ?? record.studentCount ?? 0}
            </span>
          </Tooltip>
          <Tooltip title="Staff">
            <span className="text-gray-500">
              <SafetyCertificateOutlined /> {record._count?.users ?? record.facultyCount ?? 0}
            </span>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button type="text" icon={<EyeOutlined />} onClick={() => handleViewInstitution(record)} />
          <Button type="text" icon={<EditOutlined />} onClick={() => openEditModal(record.id)} />
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDeleteClick(record)} />
        </Space>
      ),
    },
  ];

  const hasActiveFilters = searchText || statusFilter !== 'all';

  return (
    <div className="">
      <Card
        title="Institution Management"
        extra={
          <Space>
            <Button icon={<FilterOutlined />} onClick={() => setShowFilters(!showFilters)}>
              Filters
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
              Refresh
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              Add Institute
            </Button>
          </Space>
        }
        variant="borderless"
      >
        <div className="mb-4">
          <Input.Search
            placeholder="Search by name, code, or city..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={handleSearch}
            style={{ width: 350 }}
            allowClear
            enterButton
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mb-4 p-4 bg-gray-50 rounded">
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} sm={12} md={6}>
                <Select
                  value={statusFilter}
                  onChange={(value) => {
                    setStatusFilter(value);
                    setCurrentPage(1);
                  }}
                  style={{ width: '100%' }}
                  options={[
                    { value: 'all', label: 'All Status' },
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' },
                  ]}
                />
              </Col>
              <Col>
                {hasActiveFilters && (
                  <Button icon={<ClearOutlined />} onClick={clearFilters}>
                    Clear
                  </Button>
                )}
              </Col>
            </Row>
          </div>
        )}

        <div className="custom-table">
          <Table
            columns={columns}
            dataSource={institutions}
            rowKey="id"
            loading={loading}
            scroll={{ x: 'max-content' }}
            size="small"
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: pagination?.total || 0,
              onChange: (page, size) => {
                setCurrentPage(page);
                setPageSize(size);
              },
              showSizeChanger: true,
              showQuickJumper: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} institutes`,
            }}
          />
        </div>
      </Card>

      {/* Create/Edit Modal */}
      <InstitutionModal
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        institutionId={editingInstituteId}
        onSuccess={() => handleRefresh()}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        title={
          <Space className="text-red-600">
            <DeleteOutlined />
            <span>Delete Institute</span>
          </Space>
        }
        open={deleteModalVisible}
        onCancel={() => {
          setDeleteModalVisible(false);
          setInstituteToDelete(null);
        }}
        footer={[
          <Button key="cancel" onClick={() => setDeleteModalVisible(false)}>
            Cancel
          </Button>,
          <Button
            key="delete"
            type="primary"
            danger
            loading={deleting}
            disabled={deleteConfirmText !== instituteToDelete?.name}
            onClick={handleDeleteConfirm}
          >
            Delete
          </Button>,
        ]}
        centered
        destroyOnClose
      >
        {instituteToDelete && (
          <div className="space-y-4">
            <Alert
              message="Warning: Irreversible Action"
              description="This will permanently delete the institution and all associated data."
              type="error"
              showIcon
            />
            <div>
              <Text className="block mb-2">
                Type <Text code>{instituteToDelete.name}</Text> to confirm:
              </Text>
              <Input
                placeholder="Type institute name..."
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                status={deleteConfirmText && deleteConfirmText !== instituteToDelete?.name ? "error" : ""}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default InstituteManagement;
