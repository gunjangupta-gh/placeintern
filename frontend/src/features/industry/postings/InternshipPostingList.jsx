import React, { useEffect, useState } from 'react';
import { Button, Space, Tag, Card, Input, Select, Modal, Form, DatePicker, InputNumber, Switch } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMyPostings, togglePostingStatus, optimisticallyTogglePostingStatus, rollbackPostingStatus } from '../store/industrySlice';
import DataTable from '../../../components/tables/DataTable';
import { EyeOutlined, EditOutlined, PlusOutlined, SearchOutlined, DeleteOutlined } from '@ant-design/icons';
import toast from 'react-hot-toast';
import industryService from '../../../services/industry.service';
import { snapshotManager, optimisticToast, generateTxnId } from '../../../store/optimisticMiddleware';

const { Search } = Input;
const { Option } = Select;
const { TextArea } = Input;

const InternshipPostingList = () => {
  const dispatch = useDispatch();
  const { list, loading } = useSelector((state) => state.industry.postings);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    page: 1,
    limit: 10,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPosting, setEditingPosting] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    dispatch(fetchMyPostings(filters));
  }, [dispatch, filters]);

  const handleCreatePosting = () => {
    setEditingPosting(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEditPosting = (record) => {
    setEditingPosting(record);
    form.setFieldsValue(record);
    setIsModalOpen(true);
  };

  const handleDeletePosting = async (id) => {
    Modal.confirm({
      title: 'Delete Posting',
      content: 'Are you sure you want to delete this internship posting?',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await industryService.deletePosting(id);
          toast.success('Posting deleted successfully');
          dispatch(fetchMyPostings(filters));
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to delete posting');
        }
      },
    });
  };

  const handleSubmit = async (values) => {
    try {
      if (editingPosting) {
        await industryService.updatePosting(editingPosting.id, values);
        toast.success('Posting updated successfully');
      } else {
        await industryService.createPosting(values);
        toast.success('Posting created successfully');
      }
      setIsModalOpen(false);
      dispatch(fetchMyPostings(filters));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Operation failed');
    }
  };

  const handleSearch = (value) => {
    setFilters({ ...filters, search: value, page: 1 });
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value, page: 1 });
  };

  const handlePageChange = (page, pageSize) => {
    setFilters({ ...filters, page, limit: pageSize });
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const txnId = generateTxnId();
    const newStatus = !currentStatus;

    // Save snapshot for rollback
    snapshotManager.save(txnId, 'industry', { postings: { list } });

    // Show loading toast
    optimisticToast.loading(txnId, `${newStatus ? 'Activating' : 'Deactivating'} posting...`);

    // Optimistic update - instant UI feedback
    dispatch(optimisticallyTogglePostingStatus({ id, isActive: newStatus }));

    try {
      // Call server in background
      await dispatch(togglePostingStatus({ id, isActive: newStatus })).unwrap();

      // Success - update toast
      optimisticToast.success(txnId, `Posting ${newStatus ? 'activated' : 'deactivated'} successfully`);
      snapshotManager.delete(txnId);
    } catch (error) {
      // Error - rollback optimistic update
      const snapshot = snapshotManager.get(txnId);
      if (snapshot) {
        dispatch(rollbackPostingStatus(snapshot.state.postings));
      }

      // Show error toast
      optimisticToast.error(txnId, error || 'Failed to update posting status');
      snapshotManager.delete(txnId);
    }
  };

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: 250,
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      key: 'duration',
      render: (duration) => `${duration} months`,
    },
    {
      title: 'Stipend',
      dataIndex: 'stipend',
      key: 'stipend',
      render: (stipend) => stipend ? `₹${stipend.toLocaleString()}` : 'Unpaid',
    },
    {
      title: 'Openings',
      dataIndex: 'openings',
      key: 'openings',
    },
    {
      title: 'Applications',
      dataIndex: 'applicationsCount',
      key: 'applicationsCount',
      render: (count) => count || 0,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive, record) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={isActive}
            onChange={() => handleToggleStatus(record.id, isActive)}
            checkedChildren="Active"
            unCheckedChildren="Inactive"
            className={record._isOptimistic ? 'opacity-70' : ''}
          />
          {record._isOptimistic && (
            <span className="text-xs text-gray-400">Updating...</span>
          )}
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />}>
            View
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditPosting(record)}>
            Edit
          </Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDeletePosting(record.id)}>
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-text-primary">Internship Postings</h1>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={handleCreatePosting}
          className="rounded-lg shadow-md shadow-primary/20"
        >
          Create Posting
        </Button>
      </div>

      <Card className="rounded-xl border-border shadow-sm">
        <div className="flex gap-4 flex-wrap">
          <Search
            placeholder="Search by title or department"
            allowClear
            onSearch={handleSearch}
            className="w-full md:w-[300px]"
            prefix={<SearchOutlined className="text-text-tertiary" />}
          />
          <Select
            placeholder="Status"
            allowClear
            className="w-full md:w-[150px]"
            onChange={(value) => handleFilterChange('status', value)}
          >
            <Option value="active">Active</Option>
            <Option value="inactive">Inactive</Option>
          </Select>
        </div>
      </Card>

      <div className="bg-background rounded-xl border border-border shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          dataSource={list}
          loading={loading}
          rowKey="id"
          pagination={{
            current: filters.page,
            pageSize: filters.limit,
            total: list?.length || 0,
            onChange: handlePageChange,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} postings`,
          }}
        />
      </div>

      <Modal
        title={editingPosting ? 'Edit Posting' : 'Create Posting'}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={700}
        className="rounded-xl overflow-hidden"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          className="mt-4"
        >
          <Form.Item
            name="title"
            label="Job Title"
            rules={[{ required: true, message: 'Please enter job title' }]}
          >
            <Input placeholder="e.g., Software Development Intern" className="rounded-lg" />
          </Form.Item>

          <Form.Item
            name="department"
            label="Department"
            rules={[{ required: true, message: 'Please enter department' }]}
          >
            <Input placeholder="e.g., Software Engineering" className="rounded-lg" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please enter description' }]}
          >
            <TextArea rows={4} placeholder="Describe the internship role and responsibilities" className="rounded-lg" />
          </Form.Item>

          <Form.Item
            name="requirements"
            label="Requirements"
          >
            <TextArea rows={3} placeholder="List required skills and qualifications" className="rounded-lg" />
          </Form.Item>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item
              name="duration"
              label="Duration (months)"
              rules={[{ required: true, message: 'Please enter duration' }]}
            >
              <InputNumber min={1} max={12} className="w-full rounded-lg" />
            </Form.Item>

            <Form.Item
              name="openings"
              label="Number of Openings"
              rules={[{ required: true, message: 'Please enter openings' }]}
            >
              <InputNumber min={1} className="w-full rounded-lg" />
            </Form.Item>

            <Form.Item
              name="stipend"
              label="Stipend (₹/month)"
            >
              <InputNumber min={0} className="w-full rounded-lg" />
            </Form.Item>

            <Form.Item
              name="location"
              label="Location"
            >
              <Input placeholder="e.g., Bangalore, Remote" className="rounded-lg" />
            </Form.Item>
          </div>

          <Form.Item
            name="applicationDeadline"
            label="Application Deadline"
          >
            <DatePicker className="w-full rounded-lg" />
          </Form.Item>

          <Form.Item className="!mb-0">
            <div className="flex justify-end gap-3">
              <Button onClick={() => setIsModalOpen(false)} className="rounded-lg">
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" className="rounded-lg px-8">
                {editingPosting ? 'Update' : 'Create'}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InternshipPostingList;