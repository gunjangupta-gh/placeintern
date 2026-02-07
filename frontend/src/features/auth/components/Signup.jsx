import React, { useEffect, useState } from "react";
import {
  Form,
  Input,
  Button,
  Select,
  Typography,
  Card,
  Divider,
  theme,
  Row,
  Col,
} from "antd";
import {
  UserOutlined,
  MailOutlined,
  LockOutlined,
  BankOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import API from "../../../services/api";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

const { Title, Text } = Typography;
const { Option } = Select;

const Signup = () => {
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { token } = theme.useToken();

  useEffect(() => {
    API.get("/institutions")
      .then((res) => {
        setInstitutions(res.data);
      })
      .catch(() => toast.error("Failed to load institutions"));
  }, []);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const res = await API.post("/auth/signup", values);
      toast.success("Account created successfully! Please login to continue.");
      navigate("/login");
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Signup failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex items-center justify-center min-h-screen py-8 bg-background bg-gradient-to-br from-primary-50/30 to-background dark:from-primary-900/10 p-4"
    >
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-16 h-16 flex items-center justify-center rounded-2xl bg-primary-50 text-primary text-3xl shadow-md">
            <UserAddOutlined />
          </div>
          <Title level={2} className="text-text-primary mb-2">
            Create Account
          </Title>
          <Text className="text-text-secondary text-base">
            Join our platform and explore internship opportunities
          </Text>
        </div>

        {/* Form Card */}
        <Card className="rounded-xl shadow-soft-lg border border-border overflow-hidden bg-surface">
          <Form
            layout="vertical"
            onFinish={onFinish}
            size="large"
            requiredMark="optional"
            className="mt-2"
          >
            {/* Full Width Fields */}
            <Form.Item
              name="name"
              label={<span className="text-text-primary font-medium">Full Name</span>}
              rules={[
                { required: true, message: "Please enter your full name" },
                { min: 2, message: "Name must be at least 2 characters" },
              ]}
            >
              <Input
                placeholder="Enter your full name"
                prefix={<UserOutlined className="text-text-tertiary mr-2" />}
                className="rounded-lg h-12"
              />
            </Form.Item>

            <Form.Item
              name="email"
              label={
                <span className="text-text-primary font-medium">Email Address</span>
              }
              rules={[
                { required: true, message: "Please enter your email" },
                {
                  type: "email",
                  message: "Please enter a valid email address",
                },
              ]}
            >
              <Input
                placeholder="Enter your email address"
                prefix={<MailOutlined className="text-text-tertiary mr-2" />}
                className="rounded-lg h-12"
              />
            </Form.Item>

            {/* Password Fields in Grid */}
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="password"
                  label={<span className="text-text-primary font-medium">Password</span>}
                  rules={[
                    { required: true, message: "Please create a password" },
                    { min: 5, message: "Password must be at least 5 characters" },
                  ]}
                  hasFeedback
                >
                  <Input.Password
                    placeholder="Create password"
                    prefix={<LockOutlined className="text-text-tertiary mr-2" />}
                    className="rounded-lg h-12"
                  />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item
                  name="confirmPassword"
                  label={
                    <span className="text-text-primary font-medium">Confirm Password</span>
                  }
                  dependencies={["password"]}
                  rules={[
                    { required: true, message: "Please confirm your password" },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue("password") === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error("Passwords do not match"));
                      },
                    }),
                  ]}
                  hasFeedback
                >
                  <Input.Password
                    placeholder="Confirm password"
                    prefix={<LockOutlined className="text-text-tertiary mr-2" />}
                    className="rounded-lg h-12"
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* Institution Field - Full Width */}
            <Form.Item
              name="institutionId"
              label={
                <span className="text-text-primary font-medium">Institution</span>
              }
              rules={[
                { required: true, message: "Please select your institution" },
              ]}
            >
              <Select
                placeholder="Select your institution"
                showSearch
                optionFilterProp="children"
                filterOption={(input, option) =>
                  option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                }
                suffixIcon={
                  <BankOutlined className="text-text-tertiary" />
                }
                className="h-12"
              >
                {institutions.map((inst) => (
                  <Option key={inst.id} value={inst.id}>
                    {inst.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            {/* Submit Button */}
            <Form.Item className="mb-4">
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
                className="h-12 rounded-xl font-bold text-base shadow-lg shadow-primary/20"
              >
                {loading ? "Creating Account..." : "Create Account"}
              </Button>
            </Form.Item>
          </Form>

          <Divider className="my-6 border-border">
            <span className="text-text-tertiary text-xs uppercase tracking-wider font-bold">Already registered?</span>
          </Divider>

          <div className="text-center">
            <p className="text-text-secondary text-sm">
              Ready to get started?{" "}
              <Link
                to="/login"
                className="text-primary hover:text-primary-600 font-bold no-underline"
              >
                Login Here
              </Link>
            </p>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8">
          <Text className="text-text-tertiary text-sm">
            © 2025 College Management System
          </Text>
          <br />
          <Text className="text-text-tertiary text-xs">
            Building bridges between education and industry
          </Text>
        </div>
      </div>
    </div>
  );
};

export default Signup;