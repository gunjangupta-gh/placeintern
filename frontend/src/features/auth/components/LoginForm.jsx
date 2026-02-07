import React, { useState } from "react";
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  ConfigProvider,
  theme,
} from "antd";
import {
  MailOutlined,
  LockOutlined,
  LoginOutlined,
  IdcardOutlined,
} from "@ant-design/icons";
import { useDispatch } from "react-redux";
import { useNavigate, Link } from "react-router-dom";
import API from "../../../services/api";
import { tokenStorage } from "../../../utils/tokenManager";
import { setCredentials } from "../store/authSlice";
import toast from "react-hot-toast";
import MfaVerify from "./MfaVerify";
import { useTheme } from "../../../contexts/ThemeContext";

const { Title, Text } = Typography;

const LoginForm = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loginType, setLoginType] = useState("email");
  const [form] = Form.useForm();
  const { darkMode } = useTheme();

  // MFA state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaUserId, setMfaUserId] = useState(null);
  const [pendingLoginData, setPendingLoginData] = useState(null);

  // Dark mode theme config for Ant Design
  const darkThemeConfig = {
    algorithm: theme.darkAlgorithm,
    token: {
      colorBgContainer: "#1e293b", // slate-800
      colorBgElevated: "#334155", // slate-700
      colorBorder: "#475569", // slate-600
      colorText: "#f1f5f9", // slate-100
      colorTextPlaceholder: "#94a3b8", // slate-400
      colorPrimary: "#3b82f6", // blue-500
    },
  };

  const lightThemeConfig = {
    algorithm: theme.defaultAlgorithm,
  };

  const completeLogin = (data) => {
    const accessToken = data.access_token;
    const refreshToken = data.refresh_token || data.refreshToken;

    tokenStorage.setToken(accessToken);
    if (refreshToken) {
      tokenStorage.setRefreshToken(refreshToken);
    }

    localStorage.setItem("loginResponse", JSON.stringify(data));
    dispatch(setCredentials({ user: data.user, token: accessToken }));

    toast.success("Login successful!");

    if (data.needsPasswordChange) {
      navigate("/app/change-password");
    } else {
      navigate("/app/dashboard");
    }
  };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const endpoint =
        loginType === "email" ? "/auth/login" : "/auth/student-login";
      const payload =
        loginType === "email"
          ? { email: values.email, password: values.password }
          : { rollNumber: values.rollNumber, password: values.password };

      const res = await API.post(endpoint, payload);

      // Check if MFA is required
      if (res.data.mfaRequired) {
        setMfaUserId(res.data.userId);
        setPendingLoginData(res.data);
        setMfaRequired(true);
        return;
      }

      completeLogin(res.data);
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.message || "Invalid credentials";

      if (status === 429) {
        toast.error("Too many attempts. Please wait a minute.", {
          duration: 5000,
        });
      } else if (status === 403 && message.toLowerCase().includes("locked")) {
        // Account locked
        toast.error(message, { duration: 8000, icon: "🔒" });
      } else if (message.includes("attempts remaining")) {
        // Show warning with remaining attempts
        toast.error(message, { icon: "⚠️" });
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSuccess = (response) => {
    // MFA verification successful, complete the login
    completeLogin(response);
  };

  const handleMfaBack = () => {
    setMfaRequired(false);
    setMfaUserId(null);
    setPendingLoginData(null);
  };

  const handleLoginTypeChange = (type) => {
    setLoginType(type);
    form.resetFields();
  };

  // Show MFA verification screen if required
  if (mfaRequired) {
    return (
      <MfaVerify
        userId={mfaUserId}
        onSuccess={handleMfaSuccess}
        onBack={handleMfaBack}
      />
    );
  }

  return (
    <ConfigProvider theme={darkMode ? darkThemeConfig : lightThemeConfig}>
      <div className="flex items-center justify-center h-screen overflow-hidden  p-4">
        <Card
          variant="borderless"
          className="w-full max-w-lg rounded-2xl shadow-2xl shadow-slate-300/50 dark:shadow-black/30 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-700/50"
          styles={{ body: { padding: "28px 32px" } }}
        >
          {/* Header */}
          <div className="text-center mb-5">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 text-white text-xl mb-3 shadow-lg shadow-blue-500/25">
              <LoginOutlined />
            </div>
            <Title
              level={4}
              className="!mb-1 !font-bold tracking-tight"
            >
              Welcome Back
            </Title>
            <Text className="text-slate-500 dark:text-slate-400 text-sm">
              Sign in to access your account
            </Text>
          </div>

          {/* Login Type Toggle - Elegant Tab Design */}
          <div className="mb-5">
            <div className="flex p-1  rounded-xl">
              <button
                type="button"
                onClick={() => handleLoginTypeChange("email")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  loginType === "email"
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-md"
                    : " hover:text-slate-700 dark:hover:text-slate-500"
                }`}
              >
                <MailOutlined className="text-base" />
                <span>Email</span>
              </button>
              <button
                type="button"
                onClick={() => handleLoginTypeChange("rollNumber")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  loginType === "rollNumber"
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-md"
                    : " hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <IdcardOutlined className="text-base" />
                <span>Registration No.</span>
              </button>
            </div>
          </div>

          {/* Form */}
          <Form
            form={form}
            onFinish={onFinish}
            layout="vertical"
            size="middle"
            requiredMark={false}
            className="space-y-0"
          >
            {loginType === "email" ? (
              <Form.Item
                name="email"
                label={
                  <span className="font-medium text-sm">
                    Email Address
                  </span>
                }
                rules={[
                  { required: true, message: "Please enter your email" },
                  { type: "email", message: "Please enter a valid email" },
                ]}
              >
                <Input
                  prefix={<MailOutlined className="text-slate-400 mr-2" />}
                  placeholder="Enter your email"
                  className="rounded-lg h-10 text-sm"
                />
              </Form.Item>
            ) : (
              <Form.Item
                name="rollNumber"
                label={
                  <span className="font-medium text-sm">
                    Registration Number
                  </span>
                }
                rules={[
                  {
                    required: true,
                    message: "Please enter your registration number",
                  },
                ]}
              >
                <Input
                  prefix={<IdcardOutlined className="text-slate-400 mr-2" />}
                  placeholder="Enter your registration number"
                  className="rounded-lg h-10 text-sm"
                />
              </Form.Item>
            )}

            <Form.Item
              name="password"
              label={
                <span className="font-medium text-sm">
                  Password
                </span>
              }
              rules={[
                { required: true, message: "Please enter your password" },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-slate-400 mr-2" />}
                placeholder="Enter your password"
                className="rounded-lg h-10 text-sm"
              />
            </Form.Item>

            <div className="flex justify-end pt-0 pb-3">
              <Link
                to="/forgot-password"
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-xs font-medium transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              className="h-10 rounded-lg font-semibold text-sm shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-shadow"
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </Form>

              {/* Built by Section */}
        {/* <div className="text-center mt-3">
          <Text className="text-slate-400 dark:text-slate-500 !text-[11px] leading-relaxed">
            Built by <span className="font-semibold text-slate-600 dark:text-slate-400">Nikhil Kumar</span> under the guidance of{' '}
            <span className="font-semibold text-slate-600 dark:text-slate-400">Sukeerat Pal Singh</span><br />
            from <span className="font-semibold text-slate-600 dark:text-slate-400">Govt. Polytechnic College Talwara</span>
          </Text>
        </div> */}

          {/* Footer */}
          {/* <div className="text-center mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Text className="text-slate-500 dark:text-slate-400 text-sm">
              Need assistance?{" "}
              <Link
                to="/support"
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold transition-colors"
              >
                Contact Support
              </Link>
            </Text>
          </div> */}
        </Card>
      </div>
    </ConfigProvider>
  );
};

export default LoginForm;
