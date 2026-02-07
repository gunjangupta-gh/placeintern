import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, Table, Button, Tag, Space, Input, Avatar, Dropdown, App } from 'antd';
import { toast } from 'react-hot-toast';
import { PlusOutlined, EditOutlined, StopOutlined, SearchOutlined, UserOutlined, ReloadOutlined, MoreOutlined, KeyOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { fetchPrincipals, togglePrincipalStatus, resetPrincipalPassword } from '../store/stateSlice';
import PrincipalModal from './PrincipalModal';
import { getImageUrl } from '../../../utils/imageUtils';

const PrincipalList = () => {
  const { modal } = App.useApp();
  const dispatch = useDispatch();
  const { list: principals, loading, pagination } = useSelector((state) => state.state.principals);
  const [searchText, setSearchText] = useState('');
  const [tableParams, setTableParams] = useState({
    page: 1,
    limit: 10,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPrincipalId, setEditingPrincipalId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [resettingId, setResettingId] = useState(null);

  const loadPrincipals = useCallback((params = {}) => {
    dispatch(fetchPrincipals({
      page: tableParams.page,
      limit: tableParams.limit,
      ...params,
    }));
  }, [dispatch, tableParams.page, tableParams.limit]);

  useEffect(() => {
    loadPrincipals();
  }, []);

  const handleOpenModal = (principalId = null) => {
    setEditingPrincipalId(principalId);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingPrincipalId(null);
  };

  const handleModalSuccess = () => {
    loadPrincipals({ forceRefresh: true });
  };

  const handleToggleStatus = (id, name, isCurrentlyActive) => {
    const action = isCurrentlyActive ? 'deactivate' : 'activate';
    const actionPast = isCurrentlyActive ? 'deactivated' : 'activated';

    modal.confirm({
      title: `${isCurrentlyActive ? 'Deactivate' : 'Activate'} Principal`,
      content: isCurrentlyActive
        ? `Are you sure you want to deactivate ${name}? They will no longer be able to access the system but their data will be preserved.`
        : `Are you sure you want to activate ${name}? They will regain access to the system.`,
      okText: isCurrentlyActive ? 'Deactivate' : 'Activate',
      okType: isCurrentlyActive ? 'danger' : 'primary',
      confirmLoading: togglingId === id,
      onOk: async () => {
        setTogglingId(id);
        try {
          const result = await dispatch(togglePrincipalStatus(id)).unwrap();
          toast.success(result.message || `Principal ${actionPast} successfully`);
          loadPrincipals({ forceRefresh: true });
        } catch (error) {
          toast.error(error?.message || `Failed to ${action} principal`);
          throw error;
        } finally {
          setTogglingId(null);
        }
      },
    });
  };

  const handleResetPassword = (id, name, email) => {
    modal.confirm({
      title: 'Reset Password',
      content: (
        <div>
          <p>Are you sure you want to reset password for <strong>{name}</strong>?</p>
          <p className="text-gray-500 text-sm">A new password will be generated.</p>
        </div>
      ),
      okText: 'Reset Password',
      okType: 'primary',
      confirmLoading: resettingId === id,
      onOk: async () => {
        setResettingId(id);
        try {
          const result = await dispatch(resetPrincipalPassword(id)).unwrap();
          toast.success('Password reset successfully');
          modal.success({
            title: 'Password Reset Successful',
            content: (
              <div>
                <p>New password has been generated:</p>
                <p className="font-mono bg-gray-100 p-2 rounded my-2 select-all">{result.newPassword}</p>
                <p className="text-sm text-gray-500">Please share this password securely with the principal.</p>
              </div>
            ),
            width: 500,
          });
        } catch (error) {
          console.error('Reset password error:', error);
          toast.error(error?.message || 'Failed to reset password');
          throw error;
        } finally {
          setResettingId(null);
        }
      },
    });
  };

  const principalsList = Array.isArray(principals) ? principals : [];

  // Handle search with debounce
  const handleSearch = (value) => {
    setSearchText(value);
    setTableParams(prev => ({ ...prev, page: 1 }));
    loadPrincipals({ search: value, page: 1 });
  };

  // Handle table change (pagination)
  const handleTableChange = (paginationConfig) => {
    const newParams = {
      page: paginationConfig.current,
      limit: paginationConfig.pageSize,
    };
    setTableParams(newParams);
    loadPrincipals({ ...newParams, search: searchText });
  };

  const columns = [
    {
      title: 'Principal',
      key: 'principal',
      render: (_, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} src={getImageUrl(record.profileImage)} />
          <div>
            <div className="font-medium">{record.name}</div>
            <div className="text-gray-500 text-xs">{record.email}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Phone',
      dataIndex: 'phoneNo',
      key: 'phoneNo',
      render: (text) => text || 'N/A',
    },
    {
      title: 'Institution',
      key: 'institution',
      render: (_, record) => record.Institution?.name || 'Not Assigned',
    },
    {
      title: 'Designation',
      dataIndex: 'designation',
      key: 'designation',
      render: (text) => text || 'Principal',
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => date ? new Date(date).toLocaleDateString('en-IN') : 'N/A',
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'status',
      render: (active) => (
        <Tag color={active !== false ? 'green' : 'red'}>
          {active !== false ? 'Active' : 'Inactive'}
        </Tag>
      ),
      filters: [
        { text: 'Active', value: true },
        { text: 'Inactive', value: false },
      ],
      onFilter: (value, record) => record.active === value,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      align: 'center',
      render: (_, record) => {
        const isActive = record.active !== false;

        const handleMenuClick = ({ key }) => {
          switch (key) {
            case 'edit':
              handleOpenModal(record.id);
              break;
            case 'reset-password':
              handleResetPassword(record.id, record.name, record.email);
              break;
            case 'toggle-status':
              handleToggleStatus(record.id, record.name, isActive);
              break;
            default:
          }
        };

        const isLoading = resettingId === record.id || togglingId === record.id;

        const menuItems = [
          {
            key: 'edit',
            icon: <EditOutlined />,
            label: 'Edit',
            disabled: isLoading,
          },
          {
            key: 'reset-password',
            icon: <KeyOutlined />,
            label: 'Reset Password',
            disabled: isLoading,
          },
          {
            type: 'divider',
          },
          {
            key: 'toggle-status',
            icon: isActive ? <StopOutlined /> : <CheckCircleOutlined />,
            label: isActive ? 'Deactivate' : 'Activate',
            danger: isActive,
            disabled: isLoading,
          },
        ];

        return (
          <Dropdown
            menu={{ items: menuItems, onClick: handleMenuClick }}
            trigger={['click']}
            placement="bottomRight"
            disabled={isLoading}
          >
            <Button
              type="text"
              icon={<MoreOutlined />}
              size="small"
              disabled={isLoading}
            />
          </Dropdown>
        );
      },
    },
  ];

  return (
    <div className="p-6">
      <Card
        title="Principals"
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadPrincipals({ forceRefresh: true })}
            >
              Refresh
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => handleOpenModal()}
            >
              Add Principal
            </Button>
          </Space>
        }
        variant="borderless"
      >
        <Input.Search
          placeholder="Search by name or email..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onSearch={handleSearch}
          style={{ width: 300, marginBottom: 16 }}
          allowClear
          enterButton
        />

        <Table
          columns={columns}
          dataSource={principalsList}
          loading={loading}
          rowKey="id"
          onChange={handleTableChange}
          pagination={{
            current: pagination?.page || tableParams.page,
            pageSize: pagination?.limit || tableParams.limit,
            total: pagination?.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} principals`,
          }}
        />
      </Card>

      <PrincipalModal
        open={modalOpen}
        onClose={handleCloseModal}
        principalId={editingPrincipalId}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
};

export default PrincipalList;