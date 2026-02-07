import { Button, Card, Form, Input, Typography, Segmented } from "antd";
import { MailOutlined, LockOutlined, LoginOutlined, IdcardOutlined } from "@ant-design/icons";
import API from "../../../services/api";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { toast } from "react-hot-toast";
import { tokenStorage } from "../../../utils/tokenManager";
import { setCredentials } from "../store/authSlice";

const { Text, Title } = Typography;

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [loginType, setLoginType] = useState("email");
  const [form] = Form.useForm();

  const navigateByRole = () => {
    navigate("/dashboard");
  };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const endpoint = loginType === "email" ? "/auth/login" : "/auth/student-login";
      const payload = loginType === "email"
        ? { email: values.email, password: values.password }
        : { rollNumber: values.rollNumber, password: values.password };

      const res = await API.post(endpoint, payload);
      const accessToken = res.data.access_token;
      const refreshToken = res.data.refresh_token || res.data.refreshToken;

      tokenStorage.setToken(accessToken);
      if (refreshToken) {
        tokenStorage.setRefreshToken(refreshToken);
      }

      localStorage.setItem("loginResponse", JSON.stringify(res.data));
      dispatch(setCredentials({ user: res.data.user, token: accessToken }));

      toast.success("Login successful!");

      if (res.data.needsPasswordChange) {
        navigate("/change-password");
      } else {
        navigateByRole();
      }
    } catch (error) {
      if (error.response?.status === 429) {
        toast.error("Too many attempts. Please wait a minute.");
      } else {
        toast.error(error.response?.data?.message || "Invalid credentials");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const accessToken = urlParams.get("token");
    const id = urlParams.get("id");
    const name = urlParams.get("name");
    const email = urlParams.get("email");
    const needsPasswordChange = urlParams.get("needsPasswordChange");

    if (accessToken && id && name && email) {
      const user = { id, name, email };
      const roleParam = urlParams.get("role");
      const institutionIdParam = urlParams.get("institutionId");
      if (roleParam) user.role = roleParam;
      if (institutionIdParam) user.institutionId = institutionIdParam;

      tokenStorage.setToken(accessToken);
      localStorage.setItem("loginResponse", JSON.stringify({ user, access_token: accessToken }));
      dispatch(setCredentials({ user, token: accessToken }));

      toast.success("Welcome back!");

      if (needsPasswordChange === "true") {
        navigate("/change-password");
      } else {
        navigateByRole();
      }
    } else if (urlParams.get("error")) {
      toast.error("Google login failed. Please try again.");
    }
  }, [location.search, navigate, dispatch]);

  const handleLoginTypeChange = (value) => {
    setLoginType(value);
    form.resetFields();
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
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xl mb-3 shadow-lg shadow-blue-500/25">
            <LoginOutlined />
          </div>
          <Title level={4} className="!mb-1 !text-slate-800 dark:!text-white !font-semibold">
            Welcome Back
          </Title>
          <Text className="text-slate-500 dark:text-slate-400 text-sm">
            Sign in to continue
          </Text>
        </div>

        {/* Login Type Toggle */}
        <Segmented
          value={loginType}
          onChange={handleLoginTypeChange}
          block
          className="mb-5 bg-slate-100 dark:bg-slate-800"
          options={[
            { label: <span className="flex items-center gap-1.5 text-xs font-medium"><MailOutlined />Email</span>, value: 'email' },
            { label: <span className="flex items-center gap-1.5 text-xs font-medium"><IdcardOutlined />Reg. No.</span>, value: 'rollNumber' },
          ]}
        />

        {/* Form */}
        <Form form={form} onFinish={onFinish} layout="vertical" size="middle" requiredMark={false}>
          {loginType === "email" ? (
            <Form.Item
              name="email"
              rules={[{ required: true, message: "Enter email" }, { type: "email", message: "Invalid email" }]}
            >
              <Input
                placeholder="Email address"
                prefix={<MailOutlined className="text-slate-400" />}
                className="rounded-lg h-10"
              />
            </Form.Item>
          ) : (
            <Form.Item
              name="rollNumber"
              rules={[{ required: true, message: "Enter registration number" }]}
            >
              <Input
                placeholder="Registration number"
                prefix={<IdcardOutlined className="text-slate-400" />}
                className="rounded-lg h-10"
              />
            </Form.Item>
          )}

          <Form.Item
            name="password"
            rules={[{ required: true, message: "Enter password" }]}
          >
            <Input.Password
              placeholder="Password"
              prefix={<LockOutlined className="text-slate-400" />}
              className="rounded-lg h-10"
            />
          </Form.Item>

          <div className="flex justify-end mb-4">
            <Link to="/forgot-password" className="text-blue-600 hover:text-blue-700 text-xs font-medium">
              Forgot password?
            </Link>
          </div>

          <Button
            type="primary"
            htmlType="submit"
            block
            loading={loading}
            className="h-10 rounded-lg font-semibold shadow-md shadow-blue-500/20"
          >
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </Form>

        {/* Built by Section */}
        <div className="text-center mt-4 px-2">
          <Text className="text-slate-400 dark:text-slate-500 text-xs leading-relaxed">
            Built by <span className="font-semibold text-slate-600 dark:text-slate-400">Nikhil Kumar</span> under the guidance of{' '}
            <span className="font-semibold text-slate-600 dark:text-slate-400">Sukeerat Pal Singh</span><br />
            from <span className="font-semibold text-slate-600 dark:text-slate-400">Govt. Polytechnic College Talwara</span>
          </Text>
        </div>

        {/* Footer */}
        <div className="text-center mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Text className="text-slate-400 dark:text-slate-500 text-xs">
            Need help? <Link to="/support" className="text-blue-600 hover:text-blue-700 font-medium">Contact Support</Link>
          </Text>
        </div>
      </Card>
    </div>
  );
}

export default Login;
