// components/faculty/StudentsList.jsx
import React from "react";
import {
  Table,
  Typography,
  Empty,
  Button,
  Space,
  Tag,
  Card,
  Tooltip,
  Dropdown,
  theme,
} from "antd";
import {
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  PlusOutlined,
  InfoCircleOutlined,
  DownOutlined,
  ClockCircleOutlined,
  BankOutlined,
  CalendarOutlined,
  FormOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const { Text } = Typography;

// Constant styles outside component
const SELF_IDENTIFIED_STYLE = { borderLeftColor: "#722ed1" };
const REGULAR_INTERNSHIP_STYLE = { borderLeftColor: "#1890ff" };
const TRUNCATE_STYLE = { maxWidth: "120px" };

const StudentsList = React.memo(({
  students,
  onLogVisit,
  onLogVisitForApplication,
  onAddFeedback,
}) => {
  const { token } = theme.useToken();
  
  // Table columns for assigned students
  const studentColumns = [
    {
      title: "Student Details",
      key: "studentDetails",
      width: "25%",
      render: (_, record) => (
        <div>
          <Text strong style={{ color: token.colorPrimary }}>
            {record.student?.user?.name || record.student?.name || "N/A"}
          </Text>
          <Text className="block text-sm" style={{ color: token.colorTextSecondary }}>
            Roll No: {record.student?.user?.rollNumber || record.student?.rollNumber || "N/A"}
          </Text>
          <Text className="block text-sm" style={{ color: token.colorTextSecondary }}>
            {record.student?.user?.branchName || record.student?.branchName || "N/A"}
          </Text>
          <div className="flex items-center mt-1">
            <Tag color="blue" size="small">
              AY: {record.academicYear}
            </Tag>
            {record.semester && (
              <Tag color="green" size="small">
                Sem: {record.semester}
              </Tag>
            )}
          </div>
        </div>
      ),
    },
    {
      title: "Contact Information",
      key: "contact",
      width: "20%",
      render: (_, record) => (
        <div>
          <div className="flex items-center mb-1">
            <PhoneOutlined className="mr-1" style={{ color: token.colorTextTertiary }} />
            <Text className="text-sm">{record.student?.user?.phoneNo || record.student?.contact || "N/A"}</Text>
          </div>
          <div className="flex items-center">
            <MailOutlined className="mr-1" style={{ color: token.colorTextTertiary }} />
            <Text className="text-sm" style={{ color: token.colorPrimary }}>
              {record.student?.user?.email || record.student?.email || "N/A"}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: "Internship Applications",
      key: "internshipApplications",
      width: "25%",
      render: (_, record) => {
        const applications = record.student?.internshipApplications || [];

        if (applications.length === 0) {
          return (
            <div className="text-center py-2">
              <Text className="text-sm" style={{ color: token.colorTextTertiary }}>No applications</Text>
            </div>
          );
        }

        return (
          <div className="space-y-2">
            {applications.slice(0, 2).map((app, index) => {
              // Check if it's a self-identified internship (no internship reference)
              const isSelfIdentified = !app.internshipId || !app.internship;

              return (
                <Card
                  key={app.id || index}
                  className="rounded border-l-4"
                  style={isSelfIdentified ? SELF_IDENTIFIED_STYLE : REGULAR_INTERNSHIP_STYLE}
                >
                  {/* Self-Identified Badge */}
                  {isSelfIdentified && (
                    <Tag
                      color="purple"
                      className="!mb-2"
                      icon={<BankOutlined />}
                    >
                      Self-Identified
                    </Tag>
                  )}

                  {/* Title/Company Name */}
                  <Text strong className="text-sm block">
                    {isSelfIdentified
                      ? app.companyName || "Self-Identified Internship"
                      : app.internship?.title || "N/A"}
                  </Text>

                  {/* Company/Industry Info for regular internships */}
                  {!isSelfIdentified &&
                    app.internship?.industry?.companyName && (
                      <Text className="text-xs block" style={{ color: token.colorTextSecondary }}>
                        {app.internship.industry.companyName}
                      </Text>
                    )}

                  {/* Status Tags */}
                  <div className="flex items-center gap-1 mt-2 flex-wrap">
                    <Tag
                      color={
                        app.status === "COMPLETED"
                          ? "green"
                          : app.status === "REJECTED"
                          ? "red"
                          : app.status === "UNDER_REVIEW"
                          ? "orange"
                          : app.internshipPhase === "ACTIVE"
                          ? "green"
                          : app.isSelected
                          ? "gold"
                          : "blue"
                      }
                      size="small"
                    >
                      {app.internshipPhase === "ACTIVE" ? "ACTIVE" : app.status}
                    </Tag>
                    {app.isSelected && app.internshipPhase !== "ACTIVE" && (
                      <Tag color="gold" size="small">
                        Selected
                      </Tag>
                    )}
                    {app.isApproved && (
                      <Tag color="green" size="small">
                        Approved
                      </Tag>
                    )}
                  </div>

                  {/* Additional Info */}
                  <div className="flex gap-3 mt-2 flex-wrap">
                    <Text className="text-xs" style={{ color: token.colorTextTertiary }}>
                      Applied: {dayjs(app.applicationDate).format("MMM DD")}
                    </Text>
                    {app.proposedFirstVisit && (
                      <Text className="text-xs" style={{ color: token.colorTextTertiary }}>
                        First Visit:{" "}
                        {dayjs(app.proposedFirstVisit).format("MMM DD")}
                      </Text>
                    )}
                  </div>
                </Card>
              );
            })}
            {applications.length > 2 && (
              <Text className="text-xs" style={{ color: token.colorPrimary }}>
                +{applications.length - 2} more applications
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: "Faculty Visits",
      key: "facultyVisits",
      width: "12%",
      render: (_, record) => {
        const applications = record.student?.internshipApplications || [];

        return (
          <div className="text-center">
            {applications.length > 0 ? (
              applications.map((app) => {
                // Use ONLY counter fields from API - no fallback logic
                const totalFacultyVisits = app.totalExpectedVisits || 0;
                const completedVisits = app.completedVisitsCount || 0;

                // Determine color based on visit progress
                const getVisitColor = (completed, total) => {
                  if (total === 0) return "gray";
                  const percentage = (completed / total) * 100;
                  if (percentage === 0) return "gray";
                  if (percentage < 50) return "orange";
                  if (percentage < 100) return "blue";
                  return "green";
                };

                const visitColor = getVisitColor(
                  completedVisits,
                  totalFacultyVisits
                );

                return (
                  <div key={app.id} className="mb-2">
                    <Tag color={visitColor} className="mb-1">
                      {completedVisits} / {totalFacultyVisits}
                    </Tag>

                    {/* Show the latest visit date if available */}
                    {app.facultyVisitLogs &&
                      app.facultyVisitLogs.length > 0 && (
                        <div className="text-xs mt-1" style={{ color: token.colorTextSecondary }}>
                          Last:{" "}
                          {dayjs(
                            app.facultyVisitLogs[
                              app.facultyVisitLogs.length - 1
                            ].visitDate
                          ).format("MMM DD")}
                        </div>
                      )}

                    {/* Show internship title for context */}
                    <div
                      className="text-xs truncate"
                      style={{ ...TRUNCATE_STYLE, color: token.colorTextTertiary }}
                    >
                      {app.internship?.title || app.companyName || "N/A"}
                    </div>
                  </div>
                );
              })
            ) : (
              <Text className="text-xs" style={{ color: token.colorTextTertiary }}>No Applications</Text>
            )}
          </div>
        );
      },
    },

    {
      title: "Status",
      key: "status",
      width: "10%",
      // Use User SOT pattern: prefer user.active, fallback to isActive
      render: (_, record) => {
        const activeStatus = record.user?.active ?? record.isActive;
        return (
          <div className="text-center">
            <Tag color={activeStatus ? "green" : "red"} className="mb-1">
              {activeStatus ? "Active" : "Inactive"}
            </Tag>
            {record.assignmentReason && (
              <Tooltip title={record.assignmentReason}>
                <InfoCircleOutlined className="text-xs" style={{ color: token.colorTextTertiary }} />
              </Tooltip>
            )}
          </div>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: "10%",
      render: (_, record) => {
        const applications = record.student?.internshipApplications || [];
        const activeApplications = applications.filter(
          (app) =>
            app.status === "ACTIVE" ||
            app.status === "ACCEPTED" ||
            app.internshipPhase === "ACTIVE"
        );

        const sortedApplications = [
          ...activeApplications,
          ...applications.filter((app) => !activeApplications.includes(app)),
        ];

        const handleLogVisitForApplication = (app) => {
          if (onLogVisitForApplication) {
            onLogVisitForApplication(record, app);
          } else if (onLogVisit) {
            onLogVisit({ ...record, selectedApplication: app });
          }
        };

        // If no applications, show disabled button
        if (applications.length === 0) {
          return (
            <Button
              icon={<PlusOutlined />}
              size="small"
              disabled
              title="No applications available"
            >
              No Applications
            </Button>
          );
        }

        // If only one application, open log visit directly for that application
        if (applications.length === 1) {
          const singleApplication = applications[0];
          return (
            <Button
              icon={<PlusOutlined />}
              size="small"
              type="primary"
              className="bg-green-600"
              onClick={() => handleLogVisitForApplication(singleApplication)}
            >
              Log Visit
            </Button>
          );
        }

        // If multiple applications, show dropdown to select specific internship
        if (applications.length > 1) {
          const menuItems = sortedApplications.map((app, index) => ({
            key: app.id || app.applicationNumber || `app-${index}`,
            label: (
              <div>
                <Text strong>
                  {app.internship?.title || app.companyName || "Untitled"}
                </Text>
                <br />
                <Text type="secondary" className="text-xs">
                  {app.internship?.industry?.companyName ||
                    app.companyName ||
                    "Unknown Company"}
                </Text>
                <br />
                <Tag
                  color={
                    app.internshipPhase === "ACTIVE"
                      ? "green"
                      : app.status === "COMPLETED"
                      ? "green"
                      : app.status === "REJECTED"
                      ? "red"
                      : app.status === "UNDER_REVIEW"
                      ? "orange"
                      : "blue"
                  }
                  size="small"
                >
                  {app.internshipPhase === "ACTIVE" ? "ACTIVE" : app.status || "N/A"}
                </Tag>
              </div>
            ),
            onClick: () => handleLogVisitForApplication(app),
          }));

          const hasActiveApplications = activeApplications.length > 0;

          return (
            <Dropdown
              menu={{ items: menuItems }}
              trigger={["click"]}
              placement="bottomRight"
            >
              <Button
                icon={<PlusOutlined />}
                size="small"
                type={hasActiveApplications ? "primary" : "default"}
                className={hasActiveApplications ? "bg-green-600" : ""}
              >
                Log Visit <DownOutlined />
              </Button>
            </Dropdown>
          );
        }

        // Fallback to original handler if data is in unexpected state
        return (
          <Button
            icon={<PlusOutlined />}
            size="small"
            type="primary"
            onClick={() =>
              onLogVisit &&
              onLogVisit({ ...record, selectedApplication: applications[0] })
            }
            className="bg-green-600"
          >
            Log Visit
          </Button>
        );
      },
    },
    // {
    //   title: "Feedback",
    //   key: "feedback",
    //   width: "10%",
    //   render: (_, record) => {
    //     const apps = record.student?.internshipApplications || [];
    //     const activeApp = apps.find((app) => app.hasJoined || app.status === "SELECTED");

    //     if (!activeApp) {
    //       return (
    //         <Text className="text-gray-400 text-xs">No active internship</Text>
    //       );
    //     }

    //     return (
    //       <Button
    //         type="primary"
    //         size="small"
    //         icon={<FormOutlined />}
    //         onClick={() => onAddFeedback && onAddFeedback(activeApp, record.student?.name)}
    //         className="w-full bg-blue-600"
    //       >
    //         Add Feedback
    //       </Button>
    //     );
    //   },
    // },
  ];

  return (
    <div>
      <div className="mb-4">
        <Text style={{ color: token.colorTextSecondary }}>
          Monitor your assigned students' internship progress and schedule
          industry visits.
        </Text>
      </div>

      {students.length > 0 ? (
        <Table
          columns={studentColumns}
          dataSource={students}
          rowKey="id"
          scroll={{ x: "max-content" }}
          pagination={{
            pageSize: 5,
            showSizeChanger: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} students`,
          }}
          className="w-full"
        />
      ) : (
        <Empty
          description="No students assigned yet"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
    </div>
  );
});

StudentsList.displayName = 'StudentsList';

export default StudentsList;