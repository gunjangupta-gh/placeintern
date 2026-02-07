import { Button, Card, Form, Input, Typography } from "antd";
import { LockOutlined, SafetyOutlined } from "@ant-design/icons";
import API from "../../../services/api";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "react-hot-toast";
import PasswordRequirements, { validatePassword } from "../../../components/common/PasswordRequirements";

const { Text, Title } = Typography;

function ChangePassword() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [newPassword, setNewPassword] = useState('');

  const onFinish = async (values) => {
    setLoading(true);
    try {
      await API.put("/auth/change-password", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });

      toast.success("Password changed successfully!");

      const loginResponse = localStorage.getItem("loginResponse");
      if (loginResponse) {
        const parsedResponse = JSON.parse(loginResponse);
        parsedResponse.needsPasswordChange = false;
        localStorage.setItem("loginResponse", JSON.stringify(parsedResponse));
      }
      navigate("/app/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4">
      <Card
        bordered={false}
        className="w-full max-w-sm rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/20 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
        styles={{ body: { padding: '24px' } }}
      >
        {/* Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white text-xl mb-3 shadow-lg shadow-amber-500/25">
            <SafetyOutlined />
          </div>
          <Title level={4} className="!mb-1 !text-slate-800 dark:!text-white !font-semibold">
            Change Password
          </Title>
          <Text className="text-slate-500 dark:text-slate-400 text-sm">
            Create a new secure password
          </Text>
        </div>

        {/* Alert */}
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <Text className="text-amber-700 dark:text-amber-400 text-xs">
            You're using a default password. Please create a unique one.
          </Text>
        </div>

        {/* Form */}
        <Form form={form} onFinish={onFinish} layout="vertical" size="middle" requiredMark={false}>
          <Form.Item
            name="currentPassword"
            rules={[{ required: true, message: "Enter current password" }]}
          >
            <Input.Password
              placeholder="Current password"
              prefix={<LockOutlined className="text-slate-400" />}
              className="rounded-lg h-10"
            />
          </Form.Item>

          <Form.Item
            name="newPassword"
            rules={[
              { required: true, message: "Enter new password" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value) return Promise.resolve();
                  if (getFieldValue('currentPassword') === value) {
                    return Promise.reject(new Error('Must be different from current'));
                  }
                  const { isValid, errors } = validatePassword(value);
                  if (!isValid) {
                    return Promise.reject(new Error(errors[0]));
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <Input.Password
              placeholder="New password"
              prefix={<LockOutlined className="text-slate-400" />}
              className="rounded-lg h-10"
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </Form.Item>

          <PasswordRequirements password={newPassword} />

          <Form.Item
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: "Confirm password" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match'));
                },
              }),
            ]}
          >
            <Input.Password
              placeholder="Confirm new password"
              prefix={<LockOutlined className="text-slate-400" />}
              className="rounded-lg h-10"
            />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            block
            loading={loading}
            className="h-10 rounded-lg font-semibold shadow-md shadow-blue-500/20"
          >
            {loading ? "Changing..." : "Change Password"}
          </Button>
        </Form>
      </Card>
    </div>
  );
}

export default ChangePassword;
