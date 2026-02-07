// Floating Action Menu Component
import React, { useState } from 'react';
import { FloatButton, Tooltip } from 'antd';
import {
  ShopOutlined,
  FileAddOutlined,
  ContactsOutlined,
  StarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  TrophyOutlined,
  UserOutlined,
  BankOutlined,
  SettingOutlined,
  GlobalOutlined,
  BarChartOutlined,
  ArrowRightOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";

const FloatingQuickActions = ({ profile, dashboardData }) => {
  return (
    <FloatButton.Group
      trigger="click"
      type="primary"
      style={{ right: 24, bottom: 24, zIndex: 1000 }}
      icon={<ThunderboltOutlined />}
      tooltip="Quick Actions"
      className="shadow-glow"
    >
      <FloatButton
        icon={<FileAddOutlined />}
        tooltip="Post Internship"
        onClick={() => window.location.href = '/industry/post-internship'}
        disabled={!profile?.isApproved}
      />
      <FloatButton
        icon={<SettingOutlined />}
        tooltip="Manage Internships"
        onClick={() => window.location.href = '/industry/manage-internships'}
        badge={{ count: dashboardData?.stats?.activeInternships }}
      />
      <FloatButton
        icon={<ContactsOutlined />}
        tooltip="View Applicants"
        onClick={() => window.location.href = '/industry/applicants'}
        badge={{ count: dashboardData?.stats?.totalApplications }}
      />
      <FloatButton
        icon={<StarOutlined />}
        tooltip="Monthly Feedback"
        onClick={() => window.location.href = '/industry/monthly/feedback'}
      />
      <FloatButton
        icon={<CheckCircleOutlined />}
        tooltip="Completion Feedback"
        onClick={() => window.location.href = '/industry/completion/feedback'}
      />
    </FloatButton.Group>
  );
};

export default FloatingQuickActions;