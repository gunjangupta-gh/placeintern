// src/pages/industry/IndustryDashboard.jsx
import React, { memo } from "react";
import {
  Card,
  Button,
  Typography,
  Alert,
  Result,
} from "antd";
import {
  InfoCircleOutlined,
  PhoneOutlined,
  MailOutlined,
  HomeOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

import Layouts from "../../../components/Layout";

const { Title, Text, Paragraph } = Typography;

const IndustryDashboard = () => {
  const navigate = useNavigate();

  return (
    <Layouts>
      <div className="p-4 md:p-8 bg-gray-50 dark:bg-slate-950 min-h-screen flex items-center justify-center">
        <div className="max-w-4xl w-full">
          <Card
            bordered={false}
            className="rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900"
          >
            <Result
              status="info"
              icon={<InfoCircleOutlined className="text-blue-500" />}
              title={
                <Title level={2} className="text-gray-900 dark:text-white mb-0">
                  Industry Portal No Longer Available
                </Title>
              }
              subTitle={
                <div className="mt-6 space-y-6 text-left">
                  <Alert
                    message="Important Update"
                    description="The industry portal for posting and managing internships through this platform has been discontinued."
                    type="warning"
                    showIcon
                    className="rounded-xl"
                  />

                  <div className="space-y-4 mt-8">
                    <Title level={4} className="text-gray-900 dark:text-white">
                      Self-Identified Internships
                    </Title>
                    <Paragraph className="text-gray-600 dark:text-slate-400 text-base">
                      Students can now complete their internship requirements through self-identified opportunities.
                      This allows students greater flexibility to:
                    </Paragraph>
                    <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-slate-400 ml-4">
                      <li>Find internships directly with companies of their choice</li>
                      <li>Pursue opportunities aligned with their career goals</li>
                      <li>Work with local or remote organizations</li>
                      <li>Submit internship documentation through the student portal</li>
                    </ul>
                  </div>

                  <div className="space-y-4 mt-8 bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border border-blue-100 dark:border-blue-800">
                    <Title level={4} className="text-gray-900 dark:text-white flex items-center gap-2">
                      <PhoneOutlined className="text-blue-600 dark:text-blue-400" />
                      Need Assistance?
                    </Title>
                    <Paragraph className="text-gray-600 dark:text-slate-400 text-base mb-4">
                      If you have questions about internship coordination or partnerships, please contact:
                    </Paragraph>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-gray-700 dark:text-slate-300">
                        <MailOutlined className="text-blue-600 dark:text-blue-400 text-lg" />
                        <Text className="text-base font-medium">Training & Placement Office</Text>
                      </div>
                      <div className="flex items-center gap-3 text-gray-700 dark:text-slate-300">
                        <PhoneOutlined className="text-blue-600 dark:text-blue-400 text-lg" />
                        <Text className="text-base font-medium">Contact your institution's placement coordinator</Text>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-gray-200 dark:border-slate-700">
                    <Paragraph className="text-gray-500 dark:text-slate-400 text-sm text-center">
                      Thank you for your interest in collaborating with our institution.
                      We appreciate your commitment to student development and professional growth.
                    </Paragraph>
                  </div>
                </div>
              }
              extra={[
                <Button
                  type="primary"
                  size="large"
                  icon={<HomeOutlined />}
                  onClick={() => navigate("/")}
                  key="home"
                  className="h-12 px-8 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 border-0 shadow-lg"
                >
                  Return to Home
                </Button>
              ]}
            />
          </Card>
        </div>
      </div>
    </Layouts>
  );
};

export default memo(IndustryDashboard);