import React, { useEffect, useState } from "react";
import {
  Tabs,
  Card,
  Button,
  Badge,
  Statistic,
  Row,
  Col,
  Typography,
  theme,
} from "antd";
import {
  FileAddOutlined,
  SettingOutlined,
  ContactsOutlined,
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DashboardOutlined,
  RocketOutlined,
} from "@ant-design/icons";

// Import your existing components
import PostInternship from "./PostInternship";
import ManageInternships from "./ManageInternships";
import ViewApplicants from "./ViewApplicants";
import Layouts from "../../../components/Layout";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useThemeStyles } from "../../../hooks/useThemeStyles";
import ResponsiveContainer from "../../../components/ResponsiveContainer";
import PageHeader from "../../../components/PageHeader";

const { Title, Text } = Typography;

const InternshipHub = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("manage");
  const tabParam = searchParams.get("tab");
  const { token } = theme.useToken();
  const styles = useThemeStyles();

  // Mock data - replace with your actual data
  const stats = {
    activeInternships: 5,
    pendingApplications: 12,
    totalApplications: 45,
  };

  // Set active tab based on URL parameter
  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // Handle tab change and reset URL params
  const handleTabChange = (key) => {
    setActiveTab(key);
    
    // Option 1: Reset all params except 'tab'
    setSearchParams({ tab: key });
    
    // Option 2: Completely clear all params (uncomment if you prefer this)
    // setSearchParams({});
    
    // Option 3: Navigate to clean URL with only tab param
    // navigate(`?tab=${key}`, { replace: true });
  };

  const tabItems = [
    {
      key: "manage",
      label: (
        <span className="flex items-center gap-2">
          <SettingOutlined />
          Manage Internships
        </span>
      ),
      children: <ManageInternships />,
    },
    {
      key: "applicants",
      label: (
        <span className="flex items-center gap-2">
          <ContactsOutlined />
          View Applicants
        </span>
      ),
      children: <ViewApplicants />,
    },
  ];

  return (
    <Layouts>
      {/* Header */}
      <div className="flex flex-col !mb-5">
        <Title level={3} className="!mb-2 text-gray-900">
          Internship Management Hub
        </Title>
        <Text className="text-gray-600">
          Your comprehensive platform for managing internship programs and
          connecting with talent
        </Text>
      </div>

      {/* Main Tabbed Interface */}
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange} // Using the new handler
        size="large"
        items={tabItems}
        tabBarStyle={{
          borderBottom: `1px solid ${token.colorBorder}`,
          marginBottom: "24px",
        }}
      />
    </Layouts>
  );
};

export default InternshipHub;