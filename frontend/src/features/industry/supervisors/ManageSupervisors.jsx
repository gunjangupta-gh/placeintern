import React, { useState, useEffect } from "react";
import {
  Card,
  Table,
  Button,
  Form,
  Input,
  Modal,
  Space,
  Tag,
  Typography,
  message,
  Popconfirm,
  Divider,
  Alert,
  Spin,
  Tooltip,
  Badge,
} from "antd";
import {
  UserAddOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  MailOutlined,
  PhoneOutlined,
  IdcardOutlined,
  LockOutlined,
  UserOutlined,
  TeamOutlined,
  SafetyOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import Layouts from "../../../components/Layout";
import API from "../../../services/api";
import { toast } from "react-hot-toast";
import { useSmartIndustry } from "../../../hooks";
import moment from "moment";

const { Title, Text, Paragraph } = Typography;

const ManageSupervisors = () => {
  const { data: profile, loading: profileLoading, error: profileError } = useSmartIndustry();
  
  const [supervisors, setSupervisors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (profile?.id) {
      fetchSupervisors();
    }
  }, [profile]);

  const fetchSupervisors = async () => {
    try {
      setLoading(true);
      // Fetch all users and filter for INDUSTRY_SUPERVISOR role in same institution
      const response = await API.get(`/users`);
      const allUsers = response.data || [];
      
      // Filter supervisors for this institution
      const industrySupervisors = allUsers.filter(
        (user) => 
          user.role === "INDUSTRY_SUPERVISOR" && 
          user.institutionId === profile.institutionId
      );
      
      setSupervisors(industrySupervisors);
    } catch (error) {
      console.error("Error fetching supervisors:", error);
      toast.error("Failed to load supervisors");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingRecord(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({
      name: record.name,
      email: record.email,
      phone: record.phone,
      designation: record.designation,
      department: record.department,
    });
    setModalVisible(true);
  };

  const handleView = (record) => {
    setSelectedRecord(record);
    setViewModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      // Since there's no delete endpoint, we'll deactivate the user
      // You can implement a proper delete endpoint in the backend if needed
      toast.info("Delete functionality needs backend implementation. Please contact administrator.");
      // Alternatively, you could change the role back to a default role
      // await API.put(`/auth/change-role/${id}`, { role: "USER" });
      // toast.success("Supervisor role removed successfully");
      // fetchSupervisors();
    } catch (error) {
      console.error("Error deleting supervisor:", error);
      toast.error(error.response?.data?.message || "Failed to delete supervisor");
    }
  };

  const handleSubmit = async (values) => {
    try {
      setLoading(true);

      if (editingRecord) {
        // Update existing supervisor
        await API.patch(`/users/${editingRecord.id}`, {
          name: values.name,
          email: values.email,
        });
        toast.success("Supervisor updated successfully");
      } else {
        // Create new supervisor user with INDUSTRY_SUPERVISOR role
        const payload = {
          name: values.name,
          email: values.email,
          password: values.password,
          institutionId: profile.institutionId, // Link to same institution
        };

        // Create user account
        const userResponse = await API.post("/auth/signup", payload);
        const userId = userResponse.data?.user?.id;

        if (!userId) {
          throw new Error("Failed to create user account");
        }

        // Change role to INDUSTRY_SUPERVISOR
        await API.put(`/auth/change-role/${userId}`, { role: "INDUSTRY_SUPERVISOR" });

        toast.success("Supervisor created successfully! Login credentials: " + values.email + " / " + values.password);
      }

      setModalVisible(false);
      form.resetFields();
      fetchSupervisors();
    } catch (error) {
      console.error("Error saving supervisor:", error);
      toast.error(error.response?.data?.message || "Failed to save supervisor");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: "Supervisor Details",
      key: "details",
      render: (_, record) => (
        <Space orientation="vertical" size="small">
          <Space>
            <UserOutlined className="text-blue-500" />
            <Text strong>{record.name}</Text>
          </Space>
          <Space>
            <MailOutlined className="text-gray-400" />
            <Text type="secondary">{record.email}</Text>
          </Space>
          {record.phone && (
            <Space>
              <PhoneOutlined className="text-gray-400" />
              <Text type="secondary">{record.phone}</Text>
            </Space>
          )}
        </Space>
      ),
    },
    {
      title: "Designation",
      dataIndex: "designation",
      key: "designation",
      render: (text) => text || <Text type="secondary">Not specified</Text>,
    },
    {
      title: "Department",
      dataIndex: "department",
      key: "department",
      render: (text) => text || <Text type="secondary">Not specified</Text>,
    },
    {
      title: "Status",
      dataIndex: "active",
      key: "status",
      render: (active) => (
        <Tag color={active ? "success" : "error"}>
          {active ? "Active" : "Inactive"}
        </Tag>
      ),
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      render: (role) => (
        <Tag color="blue" icon={<SafetyOutlined />}>
          {role}
        </Tag>
      ),
    },
    {
      title: "Created On",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (date) => moment(date).format("DD MMM YYYY"),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete Supervisor"
            description="Are you sure you want to delete this supervisor? This action cannot be undone."
            onConfirm={() => handleDelete(record.id)}
            okText="Yes, Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (profileLoading) {
    return (
      <Layouts>
        <div className="flex justify-center items-center min-h-screen">
          <Spin size="small" tip="Loading..." />
        </div>
      </Layouts>
    );
  }

  if (profileError || !profile) {
    return (
      <Layouts>
        <div className="p-6">
          <Alert
            title="Error"
            description={profileError || "Failed to load industry profile"}
            type="error"
            showIcon
          />
        </div>
      </Layouts>
    );
  }

  return (
    <Layouts>
      <div >
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <Title level={2} className="!mb-2">
                <TeamOutlined className="mr-2" />
                Manage Supervisors
              </Title>
              <Text type="secondary">
                Create and manage industry supervisors for {profile.companyName}
              </Text>
            </div>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchSupervisors}
                loading={loading}
              >
                Refresh
              </Button>
              <Button
                type="primary"
                icon={<UserAddOutlined />}
                onClick={handleCreate}
                size="large"
              >
                Add Supervisor
              </Button>
            </Space>
          </div>
        </div>

        {/* Info Alert */}
        <Alert
          title="About Industry Supervisors"
          description={
            <div>
              <Paragraph className="!mb-2">
                Industry supervisors can monitor students under internship, submit monthly feedback, 
                and track student progress. They have access to the Supervisor Dashboard.
              </Paragraph>
              <Paragraph className="!mb-0">
                <strong>Total Supervisors:</strong>{" "}
                <Badge count={supervisors.length} showZero color="blue" />
              </Paragraph>
            </div>
          }
          type="info"
          showIcon
          className="mb-6"
        />

        {/* Supervisors Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={supervisors}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 5,
              showTotal: (total) => `Total ${total} supervisors`,
            }}
            locale={{
              emptyText: (
                <div className="py-8">
                  <TeamOutlined style={{ fontSize: 48 }} />
                  <Paragraph type="secondary" className="mt-4">
                    No supervisors found. Click "Add Supervisor" to create one.
                  </Paragraph>
                </div>
              ),
            }}
          />
        </Card>

        {/* Create/Edit Modal */}
        <Modal
          title={
            <Space>
              <UserAddOutlined />
              {editingRecord ? "Edit Supervisor" : "Add New Supervisor"}
            </Space>
          }
          open={modalVisible}
          onCancel={() => {
            setModalVisible(false);
            setEditingRecord(null);
            form.resetFields();
          }}
          footer={null}
          width={600}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            className="mt-4"
          >
            <Form.Item
              name="name"
              label="Full Name"
              rules={[
                { required: true, message: "Please enter supervisor name" },
                { min: 3, message: "Name must be at least 3 characters" },
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="e.g., John Doe"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="email"
              label="Email Address"
              rules={[
                { required: true, message: "Please enter email address" },
                { type: "email", message: "Please enter valid email" },
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="supervisor@company.com"
                size="large"
                disabled={!!editingRecord} // Can't change email when editing
              />
            </Form.Item>

            {!editingRecord && (
              <Form.Item
                name="password"
                label="Password"
                rules={[
                  { required: true, message: "Please enter password" },
                  { min: 6, message: "Password must be at least 6 characters" },
                ]}
                extra="Supervisor will use this password to login. They can change it later."
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="Enter secure password"
                  size="large"
                />
              </Form.Item>
            )}

            <Divider />

            <Form.Item className="mb-0">
              <Space className="w-full justify-end">
                <Button
                  onClick={() => {
                    setModalVisible(false);
                    setEditingRecord(null);
                    form.resetFields();
                  }}
                >
                  Cancel
                </Button>
                <Button type="primary" htmlType="submit" loading={loading}>
                  {editingRecord ? "Update Supervisor" : "Create Supervisor"}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* View Details Modal */}
        <Modal
          title={
            <Space>
              <EyeOutlined />
              Supervisor Details
            </Space>
          }
          open={viewModalVisible}
          onCancel={() => setViewModalVisible(false)}
          footer={[
            <Button key="close" onClick={() => setViewModalVisible(false)}>
              Close
            </Button>,
          ]}
          width={600}
        >
          {selectedRecord && (
            <div className="py-4">
              <Space orientation="vertical" size="large" className="w-full">
                <div>
                  <Text type="secondary">Full Name</Text>
                  <div>
                    <Text strong className="text-lg">
                      {selectedRecord.name}
                    </Text>
                  </div>
                </div>

                <div>
                  <Text type="secondary">Email Address</Text>
                  <div>
                    <Space>
                      <MailOutlined />
                      <Text>{selectedRecord.email}</Text>
                    </Space>
                  </div>
                </div>

                <div>
                  <Text type="secondary">Role</Text>
                  <div>
                    <Tag color="blue" icon={<SafetyOutlined />}>
                      {selectedRecord.role}
                    </Tag>
                  </div>
                </div>

                <div>
                  <Text type="secondary">Status</Text>
                  <div>
                    <Tag color={selectedRecord.active ? "success" : "error"}>
                      {selectedRecord.active ? "Active" : "Inactive"}
                    </Tag>
                  </div>
                </div>

                <div>
                  <Text type="secondary">Account Created</Text>
                  <div>
                    <Text>
                      {moment(selectedRecord.createdAt).format("DD MMMM YYYY, hh:mm A")}
                    </Text>
                  </div>
                </div>

                {selectedRecord.lastLogin && (
                  <div>
                    <Text type="secondary">Last Login</Text>
                    <div>
                      <Text>
                        {moment(selectedRecord.lastLogin).format("DD MMMM YYYY, hh:mm A")}
                      </Text>
                    </div>
                  </div>
                )}
              </Space>
            </div>
          )}
        </Modal>
      </div>
    </Layouts>
  );
};

export default ManageSupervisors;