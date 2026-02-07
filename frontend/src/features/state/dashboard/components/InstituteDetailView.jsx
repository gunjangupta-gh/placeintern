import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  memo,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Tabs,
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  Spin,
  Empty,
  Progress,
  Typography,
  Space,
  Avatar,
  Modal,
  Descriptions,
  Badge,
  Input,
  Select,
  Dropdown,
  Tooltip,
  Popover,
  Image,
  List,
  Alert,
  Result,
  Switch,
} from "antd";
import {
  TeamOutlined,
  BankOutlined,
  FileTextOutlined,
  CalendarOutlined,
  UserOutlined,
  EnvironmentOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FileProtectOutlined,
  PhoneOutlined,
  MailOutlined,
  IdcardOutlined,
  FilterOutlined,
  ReloadOutlined,
  DownloadOutlined,
  SafetyCertificateOutlined,
  AuditOutlined,
  ExclamationCircleOutlined,
  SearchOutlined,
  GlobalOutlined,
  SwapOutlined,
  FolderOpenOutlined,
} from "@ant-design/icons";
import { toast } from "react-hot-toast";
import {
  fetchInstituteOverview,
  fetchInstituteStudents,
  fetchInstituteCompanies,
  fetchInstituteFacultyPrincipal,
  fetchInstitutionMentors,
  fetchAllMentors,
  assignMentorToStudent,
  removeMentorFromStudent,
  deleteInstituteStudent,
  deleteInstituteFaculty,
  toggleStudentStatus,
  toggleFacultyStatus,
  selectInstituteOverview,
  selectInstituteStudents,
  selectInstituteCompanies,
  selectInstituteFacultyPrincipal,
  selectSelectedInstitute,
  selectAllMentors,
  selectAllMentorsLoading,
} from "../../store/stateSlice";
import { useDebounce } from "../../../../hooks/useDebounce";
import { getImageUrl } from "../../../../utils/imageUtils";
import { stateService } from "../../../../services/state.service";
import InstitutionDocumentsTab from "./InstitutionDocumentsTab";
import InstitutionJoiningLettersTab from "./InstitutionJoiningLettersTab";
import InstitutionFileExplorer from "./InstitutionFileExplorer";

const { Title, Text } = Typography;

// Status color helper
const STATUS_COLORS = {
  APPROVED: "green",
  PENDING: "orange",
  DRAFT: "default",
  COMPLETED: "green",
};

const getStatusColor = (status) => STATUS_COLORS[status] || "default";

// Memoized Mentor Overview Tab - Shows detailed mentor stats for selected institution
const MentorOverviewTab = memo(({ institutionId }) => {
  const [overviewData, setOverviewData] = useState(null);
  const [mentorDetails, setMentorDetails] = useState({
    internal: [],
    incoming: [],
    outgoing: [],
  });
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState("internal");
  const [studentBreakdown, setStudentBreakdown] = useState(null);

  useEffect(() => {
    if (!institutionId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch overview data
        const overviewResponse =
          await stateService.getInstitutionMentorOverview();
        const allData = overviewResponse?.data || [];
        const institutionData = allData.find(
          (inst) => inst.institutionId === institutionId,
        );
        setOverviewData(institutionData || null);

        // Fetch detailed mentor assignments
        setDetailsLoading(true);
        const [studentsResponse, mentorsResponse] = await Promise.all([
          stateService.getInstitutionStudents(institutionId, {
            page: 1,
            limit: 1000,
          }),
          stateService.getInstitutionMentors(institutionId),
        ]);

        const students = studentsResponse?.students || [];
        const mentors = mentorsResponse?.data || [];

        // Calculate student breakdown for discrepancy display
        // Use User SOT pattern: prefer user.active, fallback to isActive
        const totalStudents = students.length;
        const activeStudents = students.filter(
          (s) => (s.user?.active ?? s.isActive) === true,
        );
        const inactiveStudents = students.filter(
          (s) => (s.user?.active ?? s.isActive) !== true,
        );
        const studentsWithMentor = activeStudents.filter((s) =>
          s.mentorAssignments?.some((ma) => ma.isActive === true),
        );
        const studentsWithoutMentor = activeStudents.filter(
          (s) => !s.mentorAssignments?.some((ma) => ma.isActive === true),
        );

        setStudentBreakdown({
          total: totalStudents,
          active: activeStudents.length,
          inactive: inactiveStudents.length,
          withMentor: studentsWithMentor.length,
          withoutMentor: studentsWithoutMentor.length,
        });

        // Process internal mentors
        const internalMentors = mentors
          .map((mentor) => {
            const assignedStudents = activeStudents.filter((s) =>
              s.mentorAssignments?.some(
                (ma) => ma.isActive && ma.mentorId === mentor.id,
              ),
            );
            return {
              ...mentor,
              studentCount: assignedStudents.length,
              students: assignedStudents,
            };
          })
          .filter((m) => m.studentCount > 0);

        // Process external assignments (mock for now - would need specific endpoint)
        setMentorDetails({
          internal: internalMentors,
          incoming: [],
          outgoing: [],
        });
      } catch (err) {
        setError(err?.message || "Failed to load mentor overview");
      } finally {
        setLoading(false);
        setDetailsLoading(false);
      }
    };
    fetchData();
  }, [institutionId]);

  // Internal Mentors Table Columns
  const internalMentorColumns = [
    {
      title: "Mentor",
      key: "mentor",
      fixed: "left",
      width: 180,
      render: (_, record) => (
        <div className="min-w-0">
          <div className="font-medium text-text-primary text-xs truncate">
            {record.name}
          </div>
          <div className="text-[10px] text-text-tertiary">{record.email}</div>
        </div>
      ),
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      width: 120,
      render: (role) => (
        <Tag color="blue" className="text-[10px] m-0">
          {role?.replace(/_/g, " ")}
        </Tag>
      ),
    },
    {
      title: "Students",
      key: "students",
      width: 100,
      align: "center",
      render: (_, record) => (
        <Badge
          count={record.studentCount}
          showZero
          style={{ backgroundColor: "#16a34a" }}
        />
      ),
    },
    {
      title: "Contact",
      dataIndex: "phoneNo",
      key: "contact",
      width: 110,
      render: (phone) => (
        <span className="text-xs text-text-secondary">{phone || "-"}</span>
      ),
    },
  ];

  if (!institutionId)
    return <Empty description="No institution selected" className="py-20" />;
  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Spin size="large" tip="Loading mentor overview..." />
      </div>
    );
  if (error)
    return (
      <Alert
        type="error"
        message="Failed to load"
        description={error}
        showIcon
        className="m-4"
      />
    );
  if (!overviewData)
    return (
      <Empty
        description="No mentor data available for this institution"
        className="py-20"
      />
    );

  return (
    <div className="space-y-5">
      {/* Top Stats Row - Compact Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface rounded-xl border border-border p-3 text-center border-l-4 border-l-green-500">
          <div className="text-2xl font-bold text-green-700">
            {overviewData.internal.mentors}
          </div>
          <div className="text-[10px] text-text-tertiary mt-1">
            Internal Mentors
          </div>
        </div>
        <div className="bg-surface rounded-xl border border-border p-3 text-center border-l-4 border-l-green-600">
          <div className="text-2xl font-bold text-green-600">
            {overviewData.internal.students}
          </div>
          <div className="text-[10px] text-text-tertiary mt-1">
            Students Mentored
          </div>
        </div>
        <div className="bg-surface rounded-xl border border-border p-3 text-center border-l-4 border-l-blue-500">
          <div className="text-2xl font-bold text-blue-600">
            {overviewData.incomingExternal.students}
          </div>
          <div className="text-[10px] text-text-tertiary mt-1">
            Incoming Help
          </div>
        </div>
        <div className="bg-surface rounded-xl border border-border p-3 text-center border-l-4 border-l-orange-500">
          <div className="text-2xl font-bold text-orange-600">
            {overviewData.outgoingExternal.students}
          </div>
          <div className="text-[10px] text-text-tertiary mt-1">
            Outgoing Help
          </div>
        </div>
      </div>

      {/* Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          size="small"
          title={
            <span className="text-xs font-semibold">Internal Mentoring</span>
          }
          className="rounded-xl border-border"
        >
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-text-tertiary">Mentors:</span>
              <span className="font-semibold text-text-primary">
                {overviewData.internal.mentors}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-tertiary">Students:</span>
              <span className="font-semibold text-success">
                {overviewData.internal.students}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-tertiary">Assignments:</span>
              <span className="font-semibold text-text-primary">
                {overviewData.internal.assignments}
              </span>
            </div>
          </div>
        </Card>

        <Card
          size="small"
          title={
            <span className="text-xs font-semibold">Incoming External</span>
          }
          className="rounded-xl border-border"
        >
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-text-tertiary">External Mentors:</span>
              <span className="font-semibold text-primary">
                {overviewData.incomingExternal.mentors}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-tertiary">Your Students:</span>
              <span className="font-semibold text-primary">
                {overviewData.incomingExternal.students}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-tertiary">From Institutions:</span>
              <span className="font-semibold text-text-primary">
                {overviewData.incomingExternal.fromInstitutions}
              </span>
            </div>
          </div>
        </Card>

        <Card
          size="small"
          title={
            <span className="text-xs font-semibold">Outgoing External</span>
          }
          className="rounded-xl border-border"
        >
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-text-tertiary">Your Mentors:</span>
              <span className="font-semibold text-warning">
                {overviewData.outgoingExternal.mentors}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-tertiary">External Students:</span>
              <span className="font-semibold text-warning">
                {overviewData.outgoingExternal.students}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-tertiary">To Institutions:</span>
              <span className="font-semibold text-text-primary">
                {overviewData.outgoingExternal.toInstitutions}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Student Mentoring Status & Discrepancy Explanation */}
      {studentBreakdown && (
        <Card
          size="small"
          title={
            <div className="flex items-center gap-2">
              <TeamOutlined className="text-primary" />
              <span className="text-sm font-semibold">
                Student Mentoring Status
              </span>
            </div>
          }
          className="rounded-xl border-border bg-blue-50/30"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-text-tertiary font-medium">
                  Total Students:
                </span>
                <span className="font-bold text-text-primary text-base">
                  {studentBreakdown.total}
                </span>
              </div>
              <div className="pl-4 space-y-1.5">
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-text-tertiary flex items-center gap-1">
                    <CheckCircleOutlined className="text-success text-xs" />
                    Active Students:
                  </span>
                  <span className="font-semibold text-success text-sm">
                    {studentBreakdown.active}
                  </span>
                </div>
                <div className="pl-6 space-y-1">
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-text-tertiary">• With Mentor:</span>
                    <Tag color="green" className="m-0 font-semibold">
                      {studentBreakdown.withMentor}
                    </Tag>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-text-tertiary">
                      • Without Mentor:
                    </span>
                    <Tag
                      color={
                        studentBreakdown.withoutMentor > 0
                          ? "orange"
                          : "default"
                      }
                      className="m-0 font-semibold"
                    >
                      {studentBreakdown.withoutMentor}
                    </Tag>
                  </div>
                </div>
              </div>
              <div className="pl-4">
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-text-tertiary flex items-center gap-1">
                    <CloseCircleOutlined className="text-text-tertiary text-xs" />
                    Inactive Students:
                  </span>
                  <span className="font-semibold text-text-tertiary text-sm">
                    {studentBreakdown.inactive}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center">
              <Alert
                type="info"
                message={
                  <span className="text-xs font-semibold">
                    {studentBreakdown.inactive > 0
                      ? "Discrepancy Explained"
                      : "All Students Active"}
                  </span>
                }
                description={
                  <div className="text-[11px] mt-1 space-y-1">
                    {studentBreakdown.inactive > 0 ? (
                      <>
                        <p className="text-text-secondary leading-relaxed">
                          Only{" "}
                          <strong className="text-primary">
                            {studentBreakdown.active} active students
                          </strong>{" "}
                          are considered for mentoring.
                          <strong className="text-text-tertiary">
                            {" "}
                            {studentBreakdown.inactive} inactive students
                          </strong>{" "}
                          are excluded from all mentor assignment counts and
                          statistics.
                        </p>
                        {studentBreakdown.withoutMentor > 0 && (
                          <p className="text-warning font-medium mt-2">
                            ⚠ {studentBreakdown.withoutMentor} active{" "}
                            {studentBreakdown.withoutMentor === 1
                              ? "student needs"
                              : "students need"}{" "}
                            mentor assignment.
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-text-secondary leading-relaxed">
                        All {studentBreakdown.total} students are active.
                        {studentBreakdown.withMentor ===
                        studentBreakdown.active ? (
                          <span className="text-success font-medium">
                            {" "}
                            All students have been assigned mentors.
                          </span>
                        ) : (
                          <span className="text-warning font-medium">
                            {" "}
                            {studentBreakdown.withoutMentor}{" "}
                            {studentBreakdown.withoutMentor === 1
                              ? "student needs"
                              : "students need"}{" "}
                            mentor assignment.
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                }
                showIcon
                className="w-full"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Detailed Mentor List */}
      <Card
        size="small"
        title={
          <span className="text-sm font-semibold text-text-primary">
            Internal Mentors & Assignments
          </span>
        }
        extra={
          <Space size="small">
            <Tag color="green" className="text-[10px] m-0">
              {mentorDetails.internal.length} Active Mentors
            </Tag>
          </Space>
        }
        className="rounded-xl border-border"
      >
        {detailsLoading ? (
          <div className="flex justify-center py-8">
            <Spin />
          </div>
        ) : mentorDetails.internal.length > 0 ? (
          <Table
            columns={internalMentorColumns}
            dataSource={mentorDetails.internal}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 10, size: "small", showSizeChanger: false }}
            scroll={{ x: 600 }}
            className="custom-table"
          />
        ) : (
          <Empty description="No mentor assignments yet" className="py-8" />
        )}
      </Card>

      {/* Cross-Institutional Info */}
      {(overviewData.incomingExternal.students > 0 ||
        overviewData.outgoingExternal.students > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {overviewData.incomingExternal.students > 0 && (
            <Alert
              type="info"
              message={
                <span className="text-xs font-semibold">
                  Receiving External Support
                </span>
              }
              description={
                <div className="text-[11px] mt-1 text-text-secondary">
                  {overviewData.incomingExternal.mentors} faculty from{" "}
                  {overviewData.incomingExternal.fromInstitutions} other{" "}
                  {overviewData.incomingExternal.fromInstitutions === 1
                    ? "institution"
                    : "institutions"}{" "}
                  are helping mentor {overviewData.incomingExternal.students} of
                  your students.
                </div>
              }
              showIcon
              className="rounded-lg"
            />
          )}

          {overviewData.outgoingExternal.students > 0 && (
            <Alert
              type="warning"
              message={
                <span className="text-xs font-semibold">
                  Providing External Support
                </span>
              }
              description={
                <div className="text-[11px] mt-1 text-text-secondary">
                  {overviewData.outgoingExternal.mentors} of your faculty are
                  mentoring {overviewData.outgoingExternal.students} students
                  from {overviewData.outgoingExternal.toInstitutions} other{" "}
                  {overviewData.outgoingExternal.toInstitutions === 1
                    ? "institution"
                    : "institutions"}
                  .
                </div>
              }
              showIcon
              className="rounded-lg"
            />
          )}
        </div>
      )}
    </div>
  );
});

// Memoized Overview Tab Component
const OverviewTab = memo(({ data, loading, error }) => {
  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Spin size="large" />
      </div>
    );
  if (error)
    return (
      <Alert
        type="error"
        message="Failed to load overview"
        description={error}
        showIcon
        className="rounded-xl"
      />
    );
  if (!data) return <Empty description="No data available" className="py-12" />;

  return (
    <div className="space-y-3 max-w-6xl mx-auto">
      {/* Top Stats Row - Compact */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-surface rounded-lg border border-border p-2.5 text-center">
          <div className="text-2xl font-bold text-text-primary">
            {data.activeStudents || 0}
          </div>
          <div className="text-[10px] text-text-tertiary mt-0.5">
            Active Students
          </div>
        </div>
        <div className="bg-surface rounded-lg border border-border p-2.5 text-center">
          <div className="text-2xl font-bold text-text-primary">
            {data.companiesCount || 0}
          </div>
          <div className="text-[10px] text-text-tertiary mt-0.5">Companies</div>
        </div>
        <div className="bg-surface rounded-lg border border-border p-2.5 text-center">
          <div className="text-2xl font-bold text-text-primary">
            {data.facultyCount || 0}
          </div>
          <div className="text-[10px] text-text-tertiary mt-0.5">Faculty</div>
        </div>
        <div className="bg-surface rounded-lg border border-border p-2.5 text-center">
          <Progress
            type="circle"
            percent={data.complianceScore || 0}
            size={40}
            strokeWidth={6}
            strokeColor={
              data.complianceScore >= 80
                ? "rgb(var(--color-success))"
                : data.complianceScore >= 50
                  ? "rgb(var(--color-warning))"
                  : "rgb(var(--color-error))"
            }
          />
          <div className="text-[10px] text-text-tertiary mt-0.5">
            Compliance
          </div>
        </div>
      </div>

      {/* Two Column Layout for Main Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {/* Self-Identified Internships */}
        <Card
          size="small"
          title={
            <span className="text-xs font-semibold">
              Self-Identified Internships
            </span>
          }
          extra={
            <Tag color="blue" className="text-[10px] m-0">
              {data.selfIdentifiedInternships?.rate || 0}%
            </Tag>
          }
          className="rounded-lg border-border"
          bodyStyle={{ padding: "8px" }}
        >
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center">
              <div className="text-lg font-bold text-text-primary">
                {data.selfIdentifiedInternships?.total || 0}
              </div>
              <div className="text-[9px] text-text-tertiary">Total</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-success">
                {data.selfIdentifiedInternships?.approved || 0}
              </div>
              <div className="text-[9px] text-text-tertiary">Approved</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-warning">
                {data.selfIdentifiedInternships?.pending || 0}
              </div>
              <div className="text-[9px] text-text-tertiary">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-error">
                {data.selfIdentifiedInternships?.rejected || 0}
              </div>
              <div className="text-[9px] text-text-tertiary">Rejected</div>
            </div>
          </div>
        </Card>

        {/* Mentor Assignment */}
        <Card
          size="small"
          title={
            <span className="text-xs font-semibold">Mentor Assignment</span>
          }
          extra={
            <Tag
              color={data.mentorAssignment?.rate >= 80 ? "green" : "orange"}
              className="text-[10px] m-0"
            >
              {Math.round(data.mentorAssignment?.rate || 0)}%
            </Tag>
          }
          className="rounded-lg border-border"
          bodyStyle={{ padding: "8px" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="text-lg font-bold text-success">
                  {data.mentorAssignment?.assigned || 0}
                </div>
                <div className="text-[9px] text-text-tertiary">Assigned</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-error">
                  {data.mentorAssignment?.unassigned || 0}
                </div>
                <div className="text-[9px] text-text-tertiary">Unassigned</div>
              </div>
              <Tooltip
                title={`${data.mentorAssignment?.studentsWithExternalMentors || 0} students have mentors from other institutions`}
              >
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-500">
                    {data.mentorAssignment?.externalMentors || 0}
                  </div>
                  <div className="text-[9px] text-text-tertiary">External</div>
                </div>
              </Tooltip>
            </div>
          </div>
        </Card>

        {/* Joining Report */}
        <Card
          size="small"
          title={<span className="text-xs font-semibold">Joining Report</span>}
          extra={
            <Tag
              color={data.joiningLetterStatus?.rate >= 80 ? "green" : "orange"}
              className="text-[10px] m-0"
            >
              {data.joiningLetterStatus?.rate || 0}%
            </Tag>
          }
          className="rounded-lg border-border"
          bodyStyle={{ padding: "8px" }}
        >
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center">
              <div className="text-lg font-bold text-text-primary">
                {data.joiningLetterStatus?.submitted || 0}
              </div>
              <div className="text-[9px] text-text-tertiary">Submitted</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-warning">
                {data.joiningLetterStatus?.pending || 0}
              </div>
              <div className="text-[9px] text-text-tertiary">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-success">
                {data.joiningLetterStatus?.approved || 0}
              </div>
              <div className="text-[9px] text-text-tertiary">Approved</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-error">
                {data.joiningLetterStatus?.rejected || 0}
              </div>
              <div className="text-[9px] text-text-tertiary">Rejected</div>
            </div>
          </div>
        </Card>

        {/* Monthly Reports */}
        <Card
          size="small"
          title={<span className="text-xs font-semibold">Monthly Reports</span>}
          extra={
            <Tag
              color={data.monthlyReportStatus?.rate >= 80 ? "green" : "orange"}
              className="text-[10px] m-0"
            >
              {data.monthlyReportStatus?.rate || 0}%
            </Tag>
          }
          className="rounded-lg border-border"
          bodyStyle={{ padding: "8px" }}
        >
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center">
              <div className="text-lg font-bold text-text-primary">
                {data.monthlyReportStatus?.submitted || 0}
              </div>
              <div className="text-[9px] text-text-tertiary">Submitted</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-warning">
                {data.monthlyReportStatus?.pending || 0}
              </div>
              <div className="text-[9px] text-text-tertiary">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-success">
                {data.monthlyReportStatus?.approved || 0}
              </div>
              <div className="text-[9px] text-text-tertiary">Approved</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-error">
                {data.monthlyReportStatus?.notSubmitted || 0}
              </div>
              <div className="text-[9px] text-text-tertiary">Missing</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Faculty Visits - Full Width */}
      <Card
        size="small"
        title={
          <span className="text-xs font-semibold">
            Faculty Visits (This Month)
          </span>
        }
        extra={
          <Tag
            color={
              data.facultyVisits?.completionRate >= 80 ? "green" : "orange"
            }
            className="text-[10px] m-0"
          >
            {data.facultyVisits?.completionRate || 0}%
          </Tag>
        }
        className="rounded-lg border-border"
        bodyStyle={{ padding: "8px" }}
      >
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 bg-background-tertiary/30 rounded-lg">
            <div className="text-lg font-bold text-text-primary">
              {data.facultyVisits?.scheduled || 0}
            </div>
            <div className="text-[10px] text-text-tertiary">Scheduled</div>
          </div>
          <div className="text-center p-2 bg-success/5 rounded-lg">
            <div className="text-lg font-bold text-success">
              {data.facultyVisits?.completed || 0}
            </div>
            <div className="text-[10px] text-text-tertiary">Completed</div>
          </div>
          <div className="text-center p-2 bg-warning/5 rounded-lg">
            <div className="text-lg font-bold text-warning">
              {data.facultyVisits?.toBeDone || 0}
            </div>
            <div className="text-[10px] text-text-tertiary">Pending</div>
          </div>
        </div>
      </Card>

      {/* Branch Distribution */}
      {data.branchWiseData?.length > 0 && (
        <Card
          size="small"
          title={
            <span className="text-xs font-semibold">Branch Distribution</span>
          }
          className="rounded-lg border-border"
          bodyStyle={{ padding: "8px" }}
        >
          <div className="flex flex-wrap gap-1.5">
            {data.branchWiseData.map((branch, index) => (
              <div
                key={index}
                className="px-2 py-1 rounded-md bg-background-tertiary/50 border border-border flex items-center gap-1.5"
              >
                <span className="text-sm font-bold text-primary">
                  {branch.count}
                </span>
                <span className="text-[10px] text-text-secondary">
                  {branch.branch}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
});

OverviewTab.displayName = "OverviewTab";

// Memoized Faculty Tab Component
const FacultyTab = memo(
  ({ principal, faculty, summary, loading, error, onToggleFacultyStatus }) => {
    if (loading) {
      return (
        <div className="flex justify-center py-20">
          <Spin size="large" />
        </div>
      );
    }

    if (error) {
      return (
        <Alert
          type="error"
          message="Failed to load faculty data"
          description={error}
          showIcon
          className="rounded-xl"
        />
      );
    }

    if (!principal && (!faculty || faculty.length === 0)) {
      return (
        <Empty description="No faculty data available" className="py-20" />
      );
    }

    return (
      <div className="space-y-5 max-w-6xl mx-auto">
        {/* Stats Summary Row */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-surface rounded-xl border border-border p-4 text-center">
              <div className="text-2xl font-bold text-text-primary">
                {summary.totalFaculty || 0}
              </div>
              <div className="text-xs text-text-tertiary mt-1">
                Total Faculty
              </div>
            </div>
            <div className="bg-surface rounded-xl border border-border p-4 text-center">
              <div className="text-2xl font-bold text-primary">
                {summary.totalStudentsAssigned || 0}
              </div>
              <div className="text-xs text-text-tertiary mt-1">
                Students Assigned
              </div>
            </div>
            <div className="bg-surface rounded-xl border border-border p-4 text-center">
              <div className="text-2xl font-bold text-success">
                {summary.totalVisitsCompleted || 0}
              </div>
              <div className="text-xs text-text-tertiary mt-1">
                Visits Completed
              </div>
            </div>
            <div className="bg-surface rounded-xl border border-border p-4 text-center">
              <Progress
                type="circle"
                percent={summary.overallVisitCompletionRate || 0}
                size={40}
                strokeWidth={6}
              />
              <div className="text-xs text-text-tertiary mt-1">Visit Rate</div>
            </div>
          </div>
        )}

        {/* Principal Card */}
        {principal && (
          <Card size="small" className="rounded-xl border-border">
            <div className="flex items-center gap-4">
              <Avatar
                size={48}
                icon={<UserOutlined />}
                className="bg-indigo-500"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Text className="font-semibold text-text-primary">
                    {principal.name}
                  </Text>
                  <Tag color="purple" className="text-xs">
                    Principal
                  </Tag>
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-text-tertiary">
                  <span>
                    <MailOutlined className="mr-1" />
                    {principal.email}
                  </span>
                  {principal.phoneNo && (
                    <span>
                      <PhoneOutlined className="mr-1" />
                      {principal.phoneNo}
                    </span>
                  )}
                </div>
              </div>
              {principal.stats && (
                <div className="flex gap-4 text-center">
                  <div>
                    <div className="text-lg font-bold text-text-primary">
                      {principal.stats.totalStudents || 0}
                    </div>
                    <div className="text-[10px] text-text-tertiary">
                      Students
                    </div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-text-primary">
                      {principal.stats.totalFaculty || 0}
                    </div>
                    <div className="text-[10px] text-text-tertiary">
                      Faculty
                    </div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-warning">
                      {principal.stats.pendingApprovals || 0}
                    </div>
                    <div className="text-[10px] text-text-tertiary">
                      Pending
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Faculty List */}
        {faculty && faculty.length > 0 && (
          <Card
            size="small"
            title={
              <span className="text-sm font-semibold">
                Faculty Members ({faculty.length})
              </span>
            }
            className="rounded-xl border-border"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {faculty.map((member, index) => {
                const isActive = member.active !== false;
                return (
                  <div
                    key={member.id || index}
                    className={`flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-primary/30 transition-colors group ${isActive ? "bg-background-tertiary/30" : "bg-background-tertiary/10 opacity-75"}`}
                  >
                    <Avatar
                      size={36}
                      icon={<UserOutlined />}
                      className={
                        member.role === "HOD"
                          ? "bg-purple-500"
                          : isActive
                            ? "bg-primary"
                            : "bg-gray-400"
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Text
                          className={`font-medium text-sm truncate ${isActive ? "text-text-primary" : "text-text-tertiary"}`}
                        >
                          {member.name}
                        </Text>
                        <Tag
                          color={member.role === "HOD" ? "purple" : "blue"}
                          className="text-[10px]"
                        >
                          {member.role}
                        </Tag>
                        <Tag
                          color={isActive ? "success" : "default"}
                          className="text-[10px]"
                        >
                          {isActive ? "Active" : "Inactive"}
                        </Tag>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px] text-text-tertiary">
                        {member.branchName && <span>{member.branchName}</span>}
                        <span>
                          <TeamOutlined className="mr-1" />
                          {member.stats?.assignedStudents || 0}
                        </span>
                        <span>
                          <EnvironmentOutlined className="mr-1" />
                          {member.stats?.visitsCompleted || 0}/
                          {member.stats?.visitsScheduled || 0}
                        </span>
                      </div>
                    </div>
                    <Tooltip
                      title={
                        isActive ? "Deactivate Faculty" : "Activate Faculty"
                      }
                    >
                      <Button
                        type="text"
                        size="small"
                        danger={isActive}
                        icon={
                          isActive ? (
                            <DeleteOutlined />
                          ) : (
                            <CheckCircleOutlined />
                          )
                        }
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onToggleFacultyStatus?.(member)}
                      />
                    </Tooltip>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    );
  },
);

FacultyTab.displayName = "FacultyTab";

// Student Detail Modal Component
const StudentDetailModal = memo(
  ({ visible, student, onClose, institutionId }) => {
    if (!student) return null;

    // Get mentor from mentorAssignments array
    const activeAssignment = student.mentorAssignments?.find(
      (ma) => ma.isActive === true,
    );
    const mentor = activeAssignment?.mentor;
    const isMentorExternal =
      mentor?.institutionId && mentor.institutionId !== institutionId;
    const company =
      student.company ||
      student.internshipApplications?.find(
        (app) => app.status === "APPROVED" || app.status === "SELECTED",
      )?.internship?.industry;
    const selfId = student.selfIdentifiedData;

    return (
      <Modal
        title="Student Details"
        open={visible}
        onCancel={onClose}
        footer={null}
        width={800}
        destroyOnHidden
        className="rounded-2xl overflow-hidden"
      >
        <div className="space-y-4 pt-2">
          {/* Student Header with Profile Image */}
          <div className="flex items-center gap-4 pb-4 border-b border-border">
            {getImageUrl(student.profileImage) ? (
              <Image
                src={getImageUrl(student.profileImage)}
                alt={student?.user?.name}
                width={64}
                height={64}
                className="rounded-full object-cover"
                fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgesAADRfaVRYdFhNTDpjb20uYWRvYmUueG1wAAAAAAA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/Pgo8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJBZG9iZSBYTVAgQ29yZSA1LjYtYzE0MiA3OS4xNjA5MjQsIDIwMTcvMDcvMTMtMDE6MDY6MzkgICAgICAgICI+CiAgIDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+CiAgICAgIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiCiAgICAgICAgICAgIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIKICAgICAgICAgICAgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIgogICAgICAgICAgICB4bWxuczpwaG90b3Nob3A9Imh0dHA6Ly9ucy5hZG9iZS5jb20vcGhvdG9zaG9wLzEuMC8iCiAgICAgICAgICAgIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIgogICAgICAgICAgICB4bWxuczpzdEV2dD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlRXZlbnQjIgogICAgICAgICAgICB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyIKICAgICAgICAgICAgeG1sbnM6ZXhpZj0iaHR0cDovL25zLmFkb2JlLmNvbS9leGlmLzEuMC8iPgogICAgICAgICA8eG1wOkNyZWF0b3JUb29sPkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE4IChXaW5kb3dzKTwveG1wOkNyZWF0b3JUb29sPgogICAgICAgICA8eG1wOkNyZWF0ZURhdGU+MjAxOS0wMS0yN1QxNDoyODowMyswNTozMDwveG1wOkNyZWF0ZURhdGU+CiAgICAgICAgIDx4bXA6TW9kaWZ5RGF0ZT4yMDE5LTAxLTI3VDE0OjI4OjQ3KzA1OjMwPC94bXA6TW9kaWZ5RGF0ZT4KICAgICAgICAgPHhtcDpNZXRhZGF0YURhdGU+MjAxOS0wMS0yN1QxNDoyODo0NyswNTozMDwveG1wOk1ldGFkYXRhRGF0ZT4KICAgICAgPC9yZGY6RGVzY3JpcHRpb24+CiAgIDwvcmRmOlJERj4KPC94OnhtcG1ldGE+Cjw/eHBhY2tldCBlbmQ9InIiPz7jlUMHAAAC8klEQVR4nO3dwW7TQBRA0U7z/z9NF0gsQIIFLFpUqVJpMx5n/M5ZJnGcF+VqNM742/F4PAIXd/PZFwBrIAQSIZAIgUQIJEIgEQKJEEiEQCIEEiGQCIFECCRCIBECiRBIhEAiBBIhkAiBRAgkQiARAokQSIRAIgQSIZAIgUQIJEIgEQKJEEiEQCIEEiGQCIFECCRCIBECiRBIhEAiBBIhkAiBRAgkQiARAokQSIRAIgQSIZAIgUQIJEIgEQKJEEiEQCIEEiGQCIFECCRCIBECiRBIhEAiBBIhkAiBRAgkQiARAokQSIRAIgQSIZAIgUQIJEIgEQKJEEiEQCIEEiGQCIFECCRCIBECiRBIhEAiBBIhkAiBRAgkQiARAokQSIRAIgQSIZAIgUQIJEIgEQKJEEiEQCIEEiGQCIFECCRCIBECiRBIhEAiBBIhkAiBRAgkQiARAsnNZ18A/5v98fUjjk/fP+t6LmHTIRz3PuL2d/nHNx3Ccfc7bo6P+OP7vbnd3cZxd3fy53j6+e3dXRzfv1z0c//bPoTj2x/y/PaTy76+6xfx/M6TOL7/fJFLO7N9CNd++rlBbB/C8e2PuGx+xPH9LxNsH8K1n35uENuHsP5Tzw1i+xCu/fRzg9g+hPWfem4Q24dw7aefG8TuIVz96ecGsXsI6z/13CB2D+HaTz83iO1DuPbTzw1i9xDWf+q5Qewewt8/e3fu/tnevpxLuPbTzw1i+xDWf+q5QWwfwv6fOuI4bHxP9k8+9d2J7T+n7v/Ucc/x+/f++vvv+Txv09P9E7jG08fO+5n9j9j9l8nHPce3X3/c/Yl7urd76nPXcQ2n/z3X/tS7h/D7J3/5+L5/87f/9O+K+71+OU//fo/f/uzfvz7n53ra0/6Oz/87r/f+/d63W+r3/p7H3/ue69/76uNe3e81/N3vf/R6rnXfn+s5/rmu9e+91vc+fj3XcIbH/X7t0/+c0/8dtv+cz/Vsz3oJx3HO/e+9/zvuue71uMexgM/3HL77A4AP8he07A5JHwvl9wAAAABJRU5ErkJggg=="
                preview={{
                  mask: <div className="text-xs">Click to enlarge</div>,
                }}
              />
            ) : (
              <Avatar
                size={64}
                icon={<UserOutlined />}
                className="bg-primary/10 text-primary shrink-0"
              />
            )}
            <div>
              <Text className="text-xl font-bold text-text-primary block">
                {student?.user?.name}
              </Text>
              <Text className="text-text-tertiary font-mono">
                {student?.user?.rollNumber}
              </Text>
            </div>
          </div>
          <Descriptions
            bordered
            column={2}
            size="small"
            title={
              <Text className="text-xs uppercase font-bold text-text-tertiary">
                Basic Information
              </Text>
            }
            className="rounded-xl overflow-hidden bg-background-tertiary/20"
          >
            <Descriptions.Item label="Name">
              <Text strong>{student?.user?.name}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Roll Number">
              <Text code>{student?.user?.rollNumber}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              {student?.user?.email}
            </Descriptions.Item>
            <Descriptions.Item label="Branch">
              {student?.user?.branchName}
            </Descriptions.Item>
            <Descriptions.Item label="Mentor">
              {mentor && mentor.name ? (
                <Space size={4}>
                  <Text strong>{mentor.name}</Text>
                  <Tag
                    color={isMentorExternal ? "purple" : "green"}
                    className="border-0 rounded-md text-[10px]"
                  >
                    {isMentorExternal ? "External" : "Assigned"}
                  </Tag>
                  {isMentorExternal && mentor.Institution?.name && (
                    <Tooltip title={mentor.Institution.name}>
                      <Text type="secondary" className="text-xs">
                        ({mentor.Institution.name})
                      </Text>
                    </Tooltip>
                  )}
                </Space>
              ) : (
                <Tag color="red" className="border-0 rounded-md">
                  Unassigned
                </Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Company">
              {company ? company.companyName : "-"}
            </Descriptions.Item>
          </Descriptions>

          {student.hasSelfIdentifiedInternship && selfId && (
            <Descriptions
              bordered
              column={2}
              size="small"
              title={
                <Text className="text-xs uppercase font-bold text-text-tertiary">
                  Self-Identified Internship
                </Text>
              }
              className="rounded-xl overflow-hidden bg-background-tertiary/20"
            >
              <Descriptions.Item label="Company Name">
                {selfId.companyName || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag
                  color={getStatusColor(selfId.status)}
                  className="border-0 rounded-md"
                >
                  {selfId.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Company Address" span={2}>
                {selfId.companyAddress || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Contact">
                {selfId.companyContact || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {selfId.companyEmail || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="HR Name">
                {selfId.hrName || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Joining Report">
                {selfId.joiningLetterUrl ? (
                  <Space>
                    <Tag
                      color={getStatusColor(selfId.joiningLetterStatus)}
                      className="border-0 rounded-md"
                    >
                      {selfId.joiningLetterStatus || "Submitted"}
                    </Tag>
                    <Button
                      type="link"
                      size="small"
                      icon={<DownloadOutlined />}
                      href={selfId.joiningLetterUrl}
                      target="_blank"
                    >
                      View
                    </Button>
                  </Space>
                ) : (
                  <Tag color="orange" className="border-0 rounded-md">
                    Not Uploaded
                  </Tag>
                )}
              </Descriptions.Item>
            </Descriptions>
          )}

          <Descriptions
            bordered
            column={2}
            size="small"
            title={
              <Text className="text-xs uppercase font-bold text-text-tertiary">
                Current Status
              </Text>
            }
            className="rounded-xl overflow-hidden bg-background-tertiary/20"
          >
            <Descriptions.Item label="Report Status">
              {student.currentMonthReport ? (
                <Tag
                  color={getStatusColor(student.currentMonthReport.status)}
                  className="border-0 rounded-md"
                >
                  {student.currentMonthReport.status}
                </Tag>
              ) : (
                <Tag color="red" className="border-0 rounded-md">
                  Not Submitted
                </Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Submitted At">
              {student.currentMonthReport?.submittedAt
                ? new Date(
                    student.currentMonthReport.submittedAt,
                  ).toLocaleString()
                : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Last Faculty Visit">
              {student.lastFacultyVisit?.date
                ? new Date(student.lastFacultyVisit.date).toLocaleDateString()
                : "No visits yet"}
            </Descriptions.Item>
            <Descriptions.Item label="Visit Status">
              {student.lastFacultyVisit ? (
                <Tag
                  color={getStatusColor(student.lastFacultyVisit.status)}
                  className="border-0 rounded-md"
                >
                  {student.lastFacultyVisit.status}
                </Tag>
              ) : (
                "-"
              )}
            </Descriptions.Item>
          </Descriptions>
        </div>
      </Modal>
    );
  },
);

StudentDetailModal.displayName = "StudentDetailModal";

// Main Component
const InstituteDetailView = ({ defaultTab = null }) => {
  const dispatch = useDispatch();
  const selectedInstitute = useSelector(selectSelectedInstitute);
  const overview = useSelector(selectInstituteOverview);
  const students = useSelector(selectInstituteStudents);
  const companies = useSelector(selectInstituteCompanies);
  const facultyPrincipal = useSelector(selectInstituteFacultyPrincipal);
  const allMentorsFromStore = useSelector(selectAllMentors);
  const allMentorsLoading = useSelector(selectAllMentorsLoading);

  const [activeTab, setActiveTab] = useState("overview");

  // Handle defaultTab prop
  useEffect(() => {
    if (
      defaultTab &&
      ["overview", "students", "companies", "faculty"].includes(defaultTab)
    ) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  const [studentModalVisible, setStudentModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [companyModalVisible, setCompanyModalVisible] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [fileExplorerOpen, setFileExplorerOpen] = useState(false);

  // Search states
  const [studentSearchInput, setStudentSearchInput] = useState("");
  const [companySearchInput, setCompanySearchInput] = useState("");
  const debouncedStudentSearch = useDebounce(studentSearchInput, 400);
  const debouncedCompanySearch = useDebounce(companySearchInput, 400);

  // Filters
  const [studentFilter, setStudentFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selfIdentifiedFilter, setSelfIdentifiedFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  // Mentor management
  const [mentorModalVisible, setMentorModalVisible] = useState(false);
  const [mentorStudent, setMentorStudent] = useState(null);
  const [mentors, setMentors] = useState([]);
  const [mentorsLoading, setMentorsLoading] = useState(false);
  const [selectedMentorId, setSelectedMentorId] = useState(null);
  const [assigningMentor, setAssigningMentor] = useState(false);
  const [showAllInstitutions, setShowAllInstitutions] = useState(false);

  // Track if initial fetch done
  const fetchedTabsRef = useRef({
    students: false,
    companies: false,
    faculty: false,
  });
  // Track if search effects have skipped their first run (to prevent duplicate with tab fetch)
  const studentSearchInitializedRef = useRef(false);
  const companySearchInitializedRef = useRef(false);

  // Get available branches
  const availableBranches = useMemo(
    () => students.filters?.branches || [],
    [students.filters],
  );

  // Fetch overview when institute changes
  useEffect(() => {
    if (selectedInstitute?.id) {
      dispatch(fetchInstituteOverview(selectedInstitute.id));
      fetchedTabsRef.current = {
        students: false,
        companies: false,
        faculty: false,
      };
      // Reset search skip flags for new institute
      studentSearchInitializedRef.current = false;
      companySearchInitializedRef.current = false;
      // Reset all search and filter states for fresh start
      setStudentSearchInput("");
      setCompanySearchInput("");
      setStudentFilter("all");
      setBranchFilter("all");
      setStatusFilter("all");
      setSelfIdentifiedFilter("all");
      // Reset to overview tab
      setActiveTab("overview");
    }
  }, [dispatch, selectedInstitute?.id]);

  // Fetch tab data when tab changes
  useEffect(() => {
    if (!selectedInstitute?.id) return;

    if (activeTab === "students" && !fetchedTabsRef.current.students) {
      fetchedTabsRef.current.students = true;
      dispatch(
        fetchInstituteStudents({
          institutionId: selectedInstitute.id,
          limit: 20,
          filter: "all",
        }),
      );
    } else if (activeTab === "companies" && !fetchedTabsRef.current.companies) {
      fetchedTabsRef.current.companies = true;
      dispatch(
        fetchInstituteCompanies({ institutionId: selectedInstitute.id }),
      );
    } else if (activeTab === "faculty" && !fetchedTabsRef.current.faculty) {
      fetchedTabsRef.current.faculty = true;
      dispatch(fetchInstituteFacultyPrincipal(selectedInstitute.id));
    }
  }, [activeTab, selectedInstitute?.id, dispatch]);

  // Handle debounced student search - only trigger on actual search/filter changes
  // NOT on tab changes (tab changes are handled by the tab effect above)
  useEffect(() => {
    if (!selectedInstitute?.id || activeTab !== "students") return;

    // Skip the very first run ONLY if no filters/search are applied
    // This ensures filter changes work immediately on first load
    const hasFiltersOrSearch =
      debouncedStudentSearch ||
      studentFilter !== "all" ||
      branchFilter !== "all" ||
      statusFilter !== "all" ||
      selfIdentifiedFilter !== "all";

    if (!studentSearchInitializedRef.current && !hasFiltersOrSearch) {
      studentSearchInitializedRef.current = true;
      return;
    }

    studentSearchInitializedRef.current = true;

    dispatch(
      fetchInstituteStudents({
        institutionId: selectedInstitute.id,
        limit: 20,
        forceRefresh: true, // Always refresh when filters/search change
        search: debouncedStudentSearch || undefined,
        filter: studentFilter,
        branch: branchFilter !== "all" ? branchFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        selfIdentified:
          selfIdentifiedFilter !== "all" ? selfIdentifiedFilter : undefined,
      }),
    );
    // Note: activeTab is intentionally NOT in dependencies - tab switches are handled by fetchedTabsRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedStudentSearch,
    selectedInstitute?.id,
    dispatch,
    studentFilter,
    branchFilter,
    statusFilter,
    selfIdentifiedFilter,
  ]);

  // Handle debounced company search - only trigger on actual search changes
  // NOT on tab changes (tab changes are handled by the tab effect above)
  useEffect(() => {
    if (!selectedInstitute?.id || activeTab !== "companies") return;

    // Skip the very first run - the tab change effect handles initial fetch
    if (!companySearchInitializedRef.current) {
      companySearchInitializedRef.current = true;
      return;
    }

    dispatch(
      fetchInstituteCompanies({
        institutionId: selectedInstitute.id,
        search: debouncedCompanySearch || undefined,
        forceRefresh: true,
      }),
    );
    // Note: activeTab is intentionally NOT in dependencies - tab switches are handled by fetchedTabsRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedCompanySearch, selectedInstitute?.id, dispatch]);

  // Apply filters
  const applyFilters = useCallback(() => {
    if (!selectedInstitute?.id) return;
    dispatch(
      fetchInstituteStudents({
        institutionId: selectedInstitute.id,
        limit: 20,
        forceRefresh: true,
        search: studentSearchInput || undefined,
        filter: studentFilter,
        branch: branchFilter !== "all" ? branchFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        selfIdentified:
          selfIdentifiedFilter !== "all" ? selfIdentifiedFilter : undefined,
      }),
    );
  }, [
    dispatch,
    selectedInstitute?.id,
    studentSearchInput,
    studentFilter,
    branchFilter,
    statusFilter,
    selfIdentifiedFilter,
  ]);

  // Reset filters
  const resetFilters = useCallback(() => {
    setStudentFilter("all");
    setBranchFilter("all");
    setStatusFilter("all");
    setSelfIdentifiedFilter("all");
    setStudentSearchInput("");
    // Reset the ref to prevent the debounced search useEffect from triggering with stale values
    studentSearchInitializedRef.current = false;
    if (selectedInstitute?.id) {
      dispatch(
        fetchInstituteStudents({
          institutionId: selectedInstitute.id,
          limit: 20,
          filter: "all",
          forceRefresh: true,
        }),
      );
    }
  }, [dispatch, selectedInstitute?.id]);

  // Load more students
  const handleLoadMore = useCallback(() => {
    if (!students.hasMore || students.loadingMore || !selectedInstitute?.id)
      return;
    dispatch(
      fetchInstituteStudents({
        institutionId: selectedInstitute.id,
        cursor: students.cursor,
        limit: 20,
        search: studentSearchInput || undefined,
        filter: studentFilter,
        branch: branchFilter !== "all" ? branchFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        selfIdentified:
          selfIdentifiedFilter !== "all" ? selfIdentifiedFilter : undefined,
        loadMore: true,
      }),
    );
  }, [
    dispatch,
    selectedInstitute?.id,
    students.cursor,
    students.hasMore,
    students.loadingMore,
    studentSearchInput,
    studentFilter,
    branchFilter,
    statusFilter,
    selfIdentifiedFilter,
  ]);

  // Mentor handlers
  const handleEditMentor = useCallback(
    async (student) => {
      setMentorStudent(student);
      setSelectedMentorId(
        student.mentorAssignments?.find((ma) => ma.isActive)?.mentor?.id ||
          null,
      );
      setMentorModalVisible(true);
      setShowAllInstitutions(false); // Reset to institution-only mode

      if (selectedInstitute?.id) {
        setMentorsLoading(true);
        try {
          const result = await dispatch(
            fetchInstitutionMentors(selectedInstitute.id),
          ).unwrap();
          // API returns { success: true, data: mentors[] }
          setMentors(result?.data || result || []);
        } catch {
          toast.error("Failed to load mentors");
        } finally {
          setMentorsLoading(false);
        }
      }
    },
    [dispatch, selectedInstitute?.id],
  );

  // Handle toggling between institution and all mentors
  const handleToggleAllInstitutions = useCallback(
    async (checked) => {
      setShowAllInstitutions(checked);
      setSelectedMentorId(null); // Reset selection when switching modes

      if (checked) {
        // Fetch all mentors from all institutions
        try {
          await dispatch(fetchAllMentors()).unwrap();
        } catch {
          toast.error("Failed to load mentors from all institutions");
          setShowAllInstitutions(false);
        }
      } else if (selectedInstitute?.id) {
        // Revert to institution mentors
        setMentorsLoading(true);
        try {
          const result = await dispatch(
            fetchInstitutionMentors(selectedInstitute.id),
          ).unwrap();
          setMentors(result?.data || result || []);
        } catch {
          toast.error("Failed to load mentors");
        } finally {
          setMentorsLoading(false);
        }
      }
    },
    [dispatch, selectedInstitute?.id],
  );

  const handleAssignMentor = useCallback(async () => {
    if (!mentorStudent || !selectedMentorId) {
      toast("Please select a mentor", { icon: "⚠️" });
      return;
    }

    setAssigningMentor(true);
    try {
      await dispatch(
        assignMentorToStudent({
          studentId: mentorStudent.id,
          mentorId: selectedMentorId,
        }),
      ).unwrap();
      toast.success("Mentor assigned successfully");
      setMentorModalVisible(false);
      applyFilters();
    } catch (error) {
      toast.error(
        typeof error === "string" ? error : "Failed to assign mentor",
      );
    } finally {
      setAssigningMentor(false);
    }
  }, [dispatch, mentorStudent, selectedMentorId, applyFilters]);

  const handleRemoveMentor = useCallback(
    (student) => {
      Modal.confirm({
        title: "Remove Mentor",
        icon: <ExclamationCircleOutlined />,
        content: `Are you sure you want to remove the mentor from ${student.user?.name || student.name}?`,
        okText: "Remove",
        okType: "danger",
        onOk: async () => {
          try {
            await dispatch(removeMentorFromStudent(student.id)).unwrap();
            toast.success("Mentor removed successfully");
            applyFilters();
          } catch (error) {
            toast.error(
              typeof error === "string" ? error : "Failed to remove mentor",
            );
          }
        },
      });
    },
    [dispatch, applyFilters],
  );

  // Toggle student status handler (activate/deactivate)
  const handleToggleStudentStatus = useCallback(
    (student) => {
      const isActive = student.user?.active !== false;
      const action = isActive ? "Deactivate" : "Activate";
      const actionLower = isActive ? "deactivate" : "activate";

      Modal.confirm({
        title: `${action} Student`,
        icon: (
          <ExclamationCircleOutlined
            className={isActive ? "text-warning" : "text-success"}
          />
        ),
        content: (
          <div>
            <p>
              Are you sure you want to {actionLower}{" "}
              <strong>{student.user?.name || student.name}</strong>?
            </p>
            <p className="text-text-tertiary text-sm mt-2">
              {isActive
                ? "The student will no longer be able to access the system. Mentor assignments and internship applications will be deactivated but all data will be preserved."
                : "The student will be able to access the system again. Mentor assignments and internship applications will be reactivated."}
            </p>
          </div>
        ),
        okText: action,
        okType: isActive ? "danger" : "primary",
        onOk: async () => {
          try {
            await dispatch(
              toggleStudentStatus({
                studentId: student.id,
                institutionId: selectedInstitute?.id,
              }),
            ).unwrap();
            toast.success(`Student ${actionLower}d successfully`);
          } catch (error) {
            toast.error(
              typeof error === "string"
                ? error
                : `Failed to ${actionLower} student`,
            );
          }
        },
      });
    },
    [dispatch, selectedInstitute?.id],
  );

  // Toggle faculty status handler (activate/deactivate)
  const handleToggleFacultyStatus = useCallback(
    (faculty) => {
      const isActive = faculty.active !== false;
      const action = isActive ? "Deactivate" : "Activate";
      const actionLower = isActive ? "deactivate" : "activate";

      Modal.confirm({
        title: `${action} Faculty`,
        icon: (
          <ExclamationCircleOutlined
            className={isActive ? "text-warning" : "text-success"}
          />
        ),
        content: (
          <div>
            <p>
              Are you sure you want to {actionLower}{" "}
              <strong>{faculty.name}</strong>?
            </p>
            <p className="text-text-tertiary text-sm mt-2">
              {isActive
                ? "The faculty member will no longer be able to access the system. All student mentor assignments will be deactivated but data will be preserved."
                : "The faculty member will be able to access the system again. Student assignments will need to be reassigned."}
            </p>
          </div>
        ),
        okText: action,
        okType: isActive ? "danger" : "primary",
        onOk: async () => {
          try {
            await dispatch(
              toggleFacultyStatus({
                facultyId: faculty.id,
                institutionId: selectedInstitute?.id,
              }),
            ).unwrap();
            toast.success(`Faculty ${actionLower}d successfully`);
          } catch (error) {
            toast.error(
              typeof error === "string"
                ? error
                : `Failed to ${actionLower} faculty`,
            );
          }
        },
      });
    },
    [dispatch, selectedInstitute?.id],
  );

  // Handler for viewing student details
  const handleViewStudentDetails = useCallback((record) => {
    setSelectedStudent(record);
    setStudentModalVisible(true);
  }, []);

  // Student action menu
  const getStudentActionItems = useCallback(
    (record) => {
      const hasMentor = record.mentorAssignments?.some((ma) => ma.isActive);
      const isActive = record.user?.active !== false;
      return [
        {
          key: "view",
          icon: <EyeOutlined />,
          label: "View Details",
          onClick: () => handleViewStudentDetails(record),
        },
        { type: "divider" },
        ...(isActive
          ? [
              {
                key: "mentor",
                icon: <EditOutlined />,
                label: hasMentor ? "Change Mentor" : "Assign Mentor",
                onClick: () => handleEditMentor(record),
              },
              ...(hasMentor
                ? [
                    {
                      key: "remove-mentor",
                      icon: <DeleteOutlined />,
                      label: "Remove Mentor",
                      danger: true,
                      onClick: () => handleRemoveMentor(record),
                    },
                  ]
                : []),
              { type: "divider" },
            ]
          : []),
        {
          key: "toggle-status",
          icon: isActive ? <DeleteOutlined /> : <CheckCircleOutlined />,
          label: isActive ? "Deactivate Student" : "Activate Student",
          danger: isActive,
          onClick: () => handleToggleStudentStatus(record),
        },
      ];
    },
    [
      handleEditMentor,
      handleRemoveMentor,
      handleViewStudentDetails,
      handleToggleStudentStatus,
    ],
  );

  // Memoized student columns - Compact with all key info
  const studentColumns = useMemo(
    () => [
      {
        title: "Student",
        key: "student",
        fixed: "left",
        width: 160,
        render: (_, record) => (
          <div className="min-w-0">
            <div
              className="font-medium text-text-primary text-xs truncate"
              title={record.user?.name || record.name}
            >
              {record.user?.name || record.name}
            </div>
            <div className="text-[10px] text-text-tertiary font-mono">
              {record.user?.rollNumber || record.rollNumber}
            </div>
          </div>
        ),
      },
      {
        title: "Branch",
        key: "branchName",
        width: 80,
        render: (_, record) => (
          <span className="text-xs text-text-secondary">
            {record.user?.branchName || record.branchName || "-"}
          </span>
        ),
      },
      {
        title: "Company",
        key: "company",
        width: 140,
        ellipsis: true,
        render: (_, record) => {
          const company = record.company;
          const selfId = record.selfIdentifiedData;
          const name = company?.companyName || selfId?.companyName;
          const isSelf = company?.isSelfIdentified || selfId?.companyName;

          if (!name) {
            return <span className="text-text-tertiary text-xs">-</span>;
          }
          return (
            <Tooltip title={name}>
              <div className="flex items-center gap-1">
                <span className="text-xs text-text-primary truncate">
                  {name}
                </span>
                {isSelf && (
                  <Tag color="purple" className="m-0 text-[9px] px-1 shrink-0">
                    Self
                  </Tag>
                )}
              </div>
            </Tooltip>
          );
        },
      },
      {
        title: "Start",
        key: "startDate",
        width: 75,
        render: (_, record) => {
          // Get dates from internshipApplications (approved one) or selfIdentifiedData
          const approvedApp = record.internshipApplications?.find(
            (app) => app.status === "APPROVED",
          );
          const startDate =
            approvedApp?.startDate ||
            record.selfIdentifiedData?.startDate ||
            record.internshipStartDate;

          if (!startDate) {
            return <span className="text-text-tertiary text-xs">-</span>;
          }

          const start = new Date(startDate);
          return (
            <span className="text-xs text-text-primary">
              {start.toLocaleDateString("en-US", {
                day: "numeric",
                month: "short",
                year: "2-digit",
              })}
            </span>
          );
        },
      },
      {
        title: "End",
        key: "endDate",
        width: 75,
        render: (_, record) => {
          // Get dates from internshipApplications (approved one) or selfIdentifiedData
          const approvedApp = record.internshipApplications?.find(
            (app) => app.status === "APPROVED",
          );
          const endDate =
            approvedApp?.endDate ||
            record.selfIdentifiedData?.endDate ||
            record.internshipEndDate;

          if (!endDate) {
            return <span className="text-text-tertiary text-xs">-</span>;
          }

          const end = new Date(endDate);
          return (
            <span className="text-xs text-text-primary">
              {end.toLocaleDateString("en-US", {
                day: "numeric",
                month: "short",
                year: "2-digit",
              })}
            </span>
          );
        },
      },
      {
        title: "Mentor",
        key: "mentor",
        width: 180,
        render: (_, record) => {
          // Get mentor from mentorAssignments array - find the active one
          const activeAssignment = record.mentorAssignments?.find(
            (ma) => ma.isActive === true,
          );
          const mentor = activeAssignment?.mentor;

          if (!mentor || !mentor.name) {
            return (
              <Tag color="error" className="m-0 rounded text-[10px]">
                No Mentor
              </Tag>
            );
          }

          const isExternal =
            mentor.institutionId &&
            mentor.institutionId !== selectedInstitute?.id;
          const tooltipContent = isExternal
            ? `${mentor.name} (${mentor.Institution?.name || "External"})`
            : `${mentor.name}${mentor.email ? ` - ${mentor.email}` : ""}`;

          return (
            <Tooltip title={tooltipContent}>
              <div className="flex flex-col gap-0.5">
                <span
                  className="text-xs text-text-primary font-medium truncate max-w-[160px]"
                  title={mentor.name}
                >
                  {mentor.name}
                </span>
                <Tag
                  color={isExternal ? "purple" : "success"}
                  className="m-0 rounded text-[10px] w-fit"
                >
                  {isExternal ? "External" : "Assigned"}
                </Tag>
              </div>
            </Tooltip>
          );
        },
      },
      {
        title: "JL",
        key: "joiningLetter",
        width: 40,
        align: "center",
        render: (_, record) => {
          // Check if joining report is uploaded (auto-approved, no workflow)
          const approvedApp = record.internshipApplications?.find(
            (app) => app.status === "APPROVED",
          );
          const selfId = record.selfIdentifiedData;
          const hasJL =
            approvedApp?.joiningLetterUrl ||
            selfId?.joiningLetterUrl ||
            record.joiningLetterUrl;

          if (hasJL) {
            return (
              <Tooltip title="Uploaded">
                <Tag color="success" className="m-0 rounded text-[10px]">
                  Yes
                </Tag>
              </Tooltip>
            );
          }
          return (
            <Tooltip title="Not Uploaded">
              <span className="text-text-tertiary text-[10px]">No</span>
            </Tooltip>
          );
        },
      },
      {
        title: "Reports",
        key: "reports",
        width: 65,
        align: "center",
        render: (_, record) => {
          // Count from monthlyReports array or use provided counts
          const submitted =
            record.reportsSubmitted ??
            record.monthlyReportsCount ??
            record.monthlyReports?.length ??
            0;
          const expected =
            record.reportsExpected ?? record.expectedReportsCount ?? 0;
          const color =
            expected === 0
              ? "default"
              : submitted >= expected
                ? "success"
                : submitted > 0
                  ? "warning"
                  : "error";
          return (
            <Tooltip title={`${submitted} submitted of ${expected} expected`}>
              <span
                className={`text-[10px] font-mono ${expected === 0 ? "text-text-tertiary" : submitted >= expected ? "text-success" : submitted > 0 ? "text-warning" : "text-error"}`}
              >
                {submitted}/{expected}
              </span>
            </Tooltip>
          );
        },
      },
      {
        title: "Visits",
        key: "visits",
        width: 55,
        align: "center",
        render: (_, record) => {
          // Count from facultyVisitLogs in approved application or use provided counts
          const approvedApp = record.internshipApplications?.find(
            (app) => app.status === "APPROVED",
          );
          const completed =
            record.visitsCompleted ??
            record.facultyVisitsCount ??
            approvedApp?.facultyVisitLogs?.length ??
            0;
          const expected =
            record.visitsExpected ?? record.expectedVisitsCount ?? 0;
          const color =
            expected === 0
              ? "default"
              : completed >= expected
                ? "success"
                : completed > 0
                  ? "warning"
                  : "error";
          return (
            <Tooltip title={`${completed} completed of ${expected} expected`}>
              <span
                className={`text-[10px] font-mono ${expected === 0 ? "text-text-tertiary" : completed >= expected ? "text-success" : completed > 0 ? "text-warning" : "text-error"}`}
              >
                {completed}/{expected}
              </span>
            </Tooltip>
          );
        },
      },
      {
        title: "Status",
        key: "status",
        width: 70,
        align: "center",
        render: (_, record) => {
          const isActive = record.user?.active !== false;
          return (
            <Tag
              color={isActive ? "success" : "default"}
              className="m-0 rounded text-[10px]"
            >
              {isActive ? "Active" : "Inactive"}
            </Tag>
          );
        },
      },
      {
        title: "",
        key: "action",
        width: 40,
        fixed: "right",
        align: "center",
        render: (_, record) => (
          <Dropdown
            menu={{ items: getStudentActionItems(record) }}
            trigger={["click"]}
            placement="bottomRight"
          >
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined />}
              className="text-text-tertiary hover:text-primary"
            />
          </Dropdown>
        ),
      },
    ],
    [getStudentActionItems],
  );

  // Handler for viewing company details
  const handleViewCompanyDetails = useCallback((record) => {
    setSelectedCompany(record);
    setCompanyModalVisible(true);
  }, []);

  // Memoized company columns
  const companyColumns = useMemo(
    () => [
      {
        title: "Company",
        key: "company",
        width: 280,
        render: (_, record) => (
          <div className="flex items-center gap-3 py-0.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                record.isSelfIdentifiedCompany
                  ? "bg-purple-500/10 text-purple-600"
                  : "bg-primary/10 text-primary"
              }`}
            >
              <BankOutlined className="text-sm" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Text className="text-sm font-medium text-text-primary truncate max-w-[180px]">
                  {record.companyName || "Unknown"}
                </Text>
                {record.isSelfIdentifiedCompany && (
                  <Tag color="purple" className="text-[9px] m-0 px-1">
                    Self-ID
                  </Tag>
                )}
              </div>
              <Text className="text-[11px] text-text-tertiary truncate block">
                {record.isSelfIdentifiedCompany
                  ? record.companyAddress || "-"
                  : `${record.city || "-"}${record.state ? `, ${record.state}` : ""}`}
              </Text>
            </div>
          </div>
        ),
      },
      {
        title: "Industry",
        dataIndex: "industryType",
        key: "industry",
        width: 120,
        render: (text) => (
          <Text className="text-xs text-text-secondary">
            {text || "General"}
          </Text>
        ),
      },
      {
        title: "Contact",
        key: "contact",
        width: 180,
        render: (_, record) => (
          <div className="text-xs text-text-secondary">
            <div className="truncate">
              {record.email || record.companyEmail || "-"}
            </div>
            <div>{record.phoneNo || record.companyContact || "-"}</div>
          </div>
        ),
      },
      {
        title: "Students",
        key: "students",
        width: 80,
        align: "center",
        render: (_, record) => (
          <Text className="font-semibold text-primary">
            {record.studentCount || 0}
          </Text>
        ),
      },
      {
        title: "",
        key: "action",
        width: 70,
        align: "center",
        render: (_, record) => (
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewCompanyDetails(record)}
          >
            View
          </Button>
        ),
      },
    ],
    [handleViewCompanyDetails],
  );

  // No institute selected - Clean empty state
  if (!selectedInstitute?.id) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <BankOutlined className="text-4xl text-text-tertiary mb-4" />
          <Text className="block text-text-primary font-medium mb-1">
            Select an Institution
          </Text>
          <Text className="text-text-tertiary text-sm">
            Choose from the sidebar to view details
          </Text>
        </div>
      </div>
    );
  }

  // Show full-page loader when switching institutions (loading but no data yet)
  if (overview.loading && !overview.data) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <Spin size="large" />
          <Text className="block text-text-tertiary mt-4">
            Loading institution data...
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* Header - Minimal */}
      <div className="px-4 py-2 flex items-center justify-between shrink-0 border-b border-border bg-surface">
        <div className="flex items-center gap-2">
          <Text className="font-medium text-text-primary text-sm">
            {overview.data?.institution?.name || "Loading..."}
          </Text>
        </div>
        <Space size={4}>
          <Tooltip title="File Explorer">
            <Button
              icon={<FolderOpenOutlined />}
              onClick={() => setFileExplorerOpen(true)}
              size="small"
              type="text"
            />
          </Tooltip>
          <Button
            icon={<ReloadOutlined spin={overview.loading} />}
            onClick={() =>
              dispatch(fetchInstituteOverview(selectedInstitute.id))
            }
            loading={overview.loading}
            size="small"
            type="text"
          />
        </Space>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          className="h-full flex flex-col custom-tabs"
          items={[
            {
              key: "overview",
              label: (
                <span className="flex items-center gap-2">
                  <TeamOutlined /> Overview
                </span>
              ),
              children: (
                <div className="h-full overflow-y-auto hide-scrollbar p-4">
                  <OverviewTab
                    data={overview.data}
                    loading={overview.loading}
                    error={overview.error}
                  />
                </div>
              ),
            },
            {
              key: "students",
              label: (
                <span className="flex items-center gap-2">
                  <UserOutlined /> Students ({students.total})
                </span>
              ),
              children: (
                <div className="h-full flex flex-col p-4 gap-3 min-h-0">
                  {/* Search & Filters Row */}
                  <div className="flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Search students..."
                        prefix={
                          <SearchOutlined className="text-text-tertiary" />
                        }
                        value={studentSearchInput}
                        onChange={(e) => setStudentSearchInput(e.target.value)}
                        className="w-56 rounded-lg"
                        allowClear
                        size="small"
                      />
                      <Select
                        value={studentFilter}
                        onChange={setStudentFilter}
                        size="small"
                        className="w-28"
                      >
                        <Select.Option value="all">All Mentor</Select.Option>
                        <Select.Option value="assigned">Assigned</Select.Option>
                        <Select.Option value="unassigned">
                          Unassigned
                        </Select.Option>
                      </Select>
                      <Select
                        value={branchFilter}
                        onChange={setBranchFilter}
                        size="small"
                        className="w-32"
                      >
                        <Select.Option value="all">All Branches</Select.Option>
                        {availableBranches.map((b) => (
                          <Select.Option key={b} value={b}>
                            {b}
                          </Select.Option>
                        ))}
                      </Select>
                      <Select
                        value={statusFilter}
                        onChange={setStatusFilter}
                        size="small"
                        className="w-28"
                      >
                        <Select.Option value="all">All Status</Select.Option>
                        <Select.Option value="active">Active</Select.Option>
                        <Select.Option value="inactive">Inactive</Select.Option>
                      </Select>
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={resetFilters}
                        size="small"
                        type="text"
                      />
                    </div>
                    <Text className="text-xs text-text-tertiary">
                      Showing {students.list?.length || 0} of {students.total}
                    </Text>
                  </div>

                  {students.error && (
                    <Alert
                      type="error"
                      message={students.error}
                      className="rounded-lg"
                      showIcon
                      closable
                    />
                  )}

                  {/* Table */}
                  <div className="rounded-xl border border-border flex-1 min-h-0 overflow-hidden bg-surface flex flex-col">
                    <div className="flex-1 min-h-0 overflow-auto">
                      {students.loading && students.list.length === 0 ? (
                        <div className="flex items-center justify-center py-16">
                          <Spin size="large" />
                        </div>
                      ) : (
                        <Table
                          columns={studentColumns}
                          dataSource={students.list}
                          rowKey="id"
                          loading={students.loading && students.list.length > 0}
                          pagination={false}
                          scroll={{ x: 850 }}
                          size="small"
                          className="custom-table"
                        />
                      )}
                    </div>
                    {students.hasMore && !students.loading && (
                      <div className="text-center py-2 border-t border-border shrink-0">
                        <Button
                          onClick={handleLoadMore}
                          loading={students.loadingMore}
                          size="small"
                        >
                          Load More
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: "companies",
              label: (
                <span className="flex items-center gap-2">
                  <BankOutlined /> Companies ({companies.total})
                </span>
              ),
              children: (
                <div className="h-full flex flex-col p-4 gap-3 min-h-0">
                  {/* Search & Stats Row */}
                  <div className="flex items-center justify-between gap-3 shrink-0">
                    <Input
                      placeholder="Search companies..."
                      prefix={<SearchOutlined className="text-text-tertiary" />}
                      value={companySearchInput}
                      onChange={(e) => setCompanySearchInput(e.target.value)}
                      className="w-64 rounded-lg"
                      allowClear
                    />
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-text-tertiary">
                        <span className="font-semibold text-text-primary">
                          {companies.total || 0}
                        </span>{" "}
                        companies
                      </span>
                      <span className="text-text-tertiary">
                        <span className="font-semibold text-success">
                          {companies.summary?.totalStudents || 0}
                        </span>{" "}
                        students
                      </span>
                      <Tag color="purple" className="text-xs m-0">
                        {companies.summary?.totalSelfIdentified || 0} Self-ID
                      </Tag>
                    </div>
                  </div>

                  {companies.error && (
                    <Alert
                      type="error"
                      message={companies.error}
                      className="rounded-lg"
                      showIcon
                      closable
                    />
                  )}

                  {/* Table */}
                  <div className="rounded-xl border border-border flex-1 min-h-0 overflow-hidden bg-surface flex flex-col">
                    <div className="flex-1 min-h-0 overflow-auto">
                      {companies.loading && companies.list?.length === 0 ? (
                        <div className="flex items-center justify-center py-16">
                          <Spin size="large" />
                        </div>
                      ) : companies.list?.length > 0 ? (
                        <Table
                          columns={companyColumns}
                          dataSource={companies.list}
                          rowKey="id"
                          loading={
                            companies.loading && companies.list.length > 0
                          }
                          pagination={{
                            pageSize: 15,
                            size: "small",
                            showSizeChanger: false,
                          }}
                          size="small"
                          scroll={{ x: 900 }}
                          className="custom-table"
                        />
                      ) : (
                        <Empty
                          description="No companies found"
                          className="py-12"
                        />
                      )}
                    </div>
                  </div>
                </div>
              ),
            },
            {
              key: "faculty",
              label: (
                <span className="flex items-center gap-2">
                  <IdcardOutlined /> Faculty
                </span>
              ),
              children: (
                <div className="h-full overflow-y-auto hide-scrollbar p-4">
                  <FacultyTab
                    principal={facultyPrincipal.principal}
                    faculty={facultyPrincipal.faculty}
                    summary={facultyPrincipal.summary}
                    loading={facultyPrincipal.loading}
                    error={facultyPrincipal.error}
                    onToggleFacultyStatus={handleToggleFacultyStatus}
                  />
                </div>
              ),
            },
            {
              key: "mentor-overview",
              label: (
                <span className="flex items-center gap-2">
                  <GlobalOutlined /> Mentor Overview
                </span>
              ),
              children: (
                <div className="h-full overflow-y-auto hide-scrollbar p-4">
                  <MentorOverviewTab institutionId={selectedInstitute?.id} />
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Student Detail Modal */}
      <StudentDetailModal
        visible={studentModalVisible}
        student={selectedStudent}
        onClose={() => setStudentModalVisible(false)}
        institutionId={selectedInstitute?.id}
      />

      {/* Company Detail Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <BankOutlined className="text-primary" />
            <span className="font-medium">
              {selectedCompany?.companyName || "Company Details"}
            </span>
            {selectedCompany?.isSelfIdentifiedCompany && (
              <Tag color="purple" className="text-[10px] m-0">
                Self-ID
              </Tag>
            )}
            <Text className="text-text-tertiary text-xs ml-2">
              ({selectedCompany?.studentCount || 0} students)
            </Text>
          </div>
        }
        open={companyModalVisible}
        onCancel={() => setCompanyModalVisible(false)}
        footer={null}
        width={800}
        destroyOnHidden
      >
        {selectedCompany && (
          <div className="space-y-4 pt-2">
            {/* Company Info */}
            <div className="flex flex-wrap gap-4 text-sm text-text-secondary pb-3 border-b border-border">
              <span>
                <EnvironmentOutlined className="mr-1" />
                {selectedCompany.isSelfIdentifiedCompany
                  ? selectedCompany.companyAddress || "-"
                  : `${selectedCompany.city || "-"}${selectedCompany.state ? `, ${selectedCompany.state}` : ""}`}
              </span>
              <span>
                <MailOutlined className="mr-1" />
                {selectedCompany.email || selectedCompany.companyEmail || "-"}
              </span>
              <span>
                <PhoneOutlined className="mr-1" />
                {selectedCompany.phoneNo ||
                  selectedCompany.companyContact ||
                  "-"}
              </span>
              <span>Industry: {selectedCompany.industryType || "General"}</span>
            </div>

            {/* Branch Distribution */}
            {selectedCompany.branchWiseData?.length > 0 && (
              <div>
                <Text className="text-xs text-text-tertiary font-medium mb-2 block">
                  Branch Distribution
                </Text>
                <div className="flex flex-wrap gap-2">
                  {selectedCompany.branchWiseData.map((b, i) => (
                    <div
                      key={i}
                      className="px-3 py-1.5 rounded-lg bg-background-tertiary/50 border border-border text-center"
                    >
                      <span className="font-semibold text-primary mr-1">
                        {b.total}
                      </span>
                      <span className="text-xs text-text-secondary">
                        {b.branch}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Students Table */}
            <div>
              <Text className="text-xs text-text-tertiary font-medium mb-2 block">
                Students ({selectedCompany.students?.length || 0})
              </Text>
              <Table
                dataSource={selectedCompany.students || []}
                columns={[
                  {
                    title: "Student",
                    key: "student",
                    width: 200,
                    render: (_, record) => (
                      <div>
                        <div className="font-medium text-sm text-text-primary">
                          {record.user?.name || record.name}
                        </div>
                        <div className="text-xs text-text-tertiary">
                          {record.user?.rollNumber || record.rollNumber}
                        </div>
                      </div>
                    ),
                  },
                  {
                    title: "Branch",
                    key: "branch",
                    width: 100,
                    render: (_, record) => (
                      <Text className="text-xs">
                        {record.user?.branchName || record.branch || "-"}
                      </Text>
                    ),
                  },
                  ...(selectedCompany.isSelfIdentifiedCompany
                    ? [
                        {
                          title: "Job Profile",
                          dataIndex: "jobProfile",
                          key: "jobProfile",
                          width: 140,
                          render: (t) => (
                            <Text className="text-xs">{t || "-"}</Text>
                          ),
                        },
                        {
                          title: "Stipend",
                          dataIndex: "stipend",
                          key: "stipend",
                          width: 100,
                          render: (v) =>
                            v ? (
                              <Text className="text-xs text-success font-medium">
                                ₹{Number(v).toLocaleString()}
                              </Text>
                            ) : (
                              "-"
                            ),
                        },
                      ]
                    : []),
                  {
                    title: "Joining Report",
                    dataIndex: "joiningLetterStatus",
                    key: "joiningLetterStatus",
                    width: 120,
                    render: (status) =>
                      status ? (
                        <Tag
                          color={getStatusColor(status)}
                          className="text-[10px] m-0"
                        >
                          {status}
                        </Tag>
                      ) : (
                        <Text className="text-xs text-text-tertiary">-</Text>
                      ),
                  },
                ]}
                rowKey="id"
                pagination={{
                  pageSize: 5,
                  size: "small",
                  showSizeChanger: false,
                }}
                size="small"
                scroll={{ x: 600 }}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Mentor Assignment Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-primary">
            <TeamOutlined />
            <span className="font-bold text-lg">
              {mentorStudent?.mentorAssignments?.some((ma) => ma.isActive)
                ? "Change"
                : "Assign"}{" "}
              Mentor
            </span>
          </div>
        }
        open={mentorModalVisible}
        onCancel={() => {
          setMentorModalVisible(false);
          setMentorStudent(null);
          setSelectedMentorId(null);
          setShowAllInstitutions(false);
        }}
        onOk={handleAssignMentor}
        okText="Save Assignment"
        confirmLoading={assigningMentor}
        okButtonProps={{
          disabled: !selectedMentorId,
          className: "rounded-xl font-bold h-10 shadow-lg shadow-primary/20",
        }}
        cancelButtonProps={{
          className: "rounded-xl h-10 font-medium hover:bg-background-tertiary",
        }}
        destroyOnHidden
        className="rounded-2xl overflow-hidden"
        width={550}
      >
        <div className="py-6">
          <div className="bg-background-tertiary/30 p-4 rounded-xl border border-border mb-6">
            <Text className="text-text-secondary text-xs uppercase font-bold tracking-wide block mb-1">
              Student
            </Text>
            <div className="flex items-center gap-3">
              <Avatar
                icon={<UserOutlined />}
                className="bg-background border border-border text-text-secondary"
              />
              <div>
                <Text className="text-text-primary font-bold text-lg block leading-tight">
                  {mentorStudent?.user?.name ||
                    mentorStudent?.name ||
                    "Student"}
                </Text>
                <Text className="text-text-tertiary text-xs font-mono">
                  {mentorStudent?.user?.rollNumber || mentorStudent?.rollNumber}
                </Text>
              </div>
            </div>

            {mentorStudent?.mentorAssignments?.find((ma) => ma.isActive)
              ?.mentor && (
              <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2">
                <Text type="secondary" className="text-xs">
                  Current Mentor:
                </Text>
                <Tag
                  color="blue"
                  className="m-0 rounded-md border-0 font-medium"
                >
                  {
                    mentorStudent.mentorAssignments.find((ma) => ma.isActive)
                      .mentor.name
                  }
                </Tag>
              </div>
            )}
          </div>

          {/* Toggle for cross-institution mentors */}
          <div className="flex items-center justify-between mb-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
            <div>
              <Text className="font-medium text-text-primary block">
                Show mentors from all institutions
              </Text>
              <Text className="text-xs text-text-tertiary">
                Enable to assign mentors from other institutions
              </Text>
            </div>
            <Switch
              checked={showAllInstitutions}
              onChange={handleToggleAllInstitutions}
              loading={allMentorsLoading}
            />
          </div>

          <Text className="block mb-2 font-bold text-text-primary text-sm uppercase tracking-wide">
            {showAllInstitutions
              ? "Select Mentor from Any Institution"
              : "Select Mentor from This Institution"}
          </Text>
          <Select
            placeholder="Search for a mentor..."
            loading={showAllInstitutions ? allMentorsLoading : mentorsLoading}
            value={selectedMentorId}
            onChange={setSelectedMentorId}
            style={{ width: "100%" }}
            size="large"
            className="rounded-xl"
            showSearch
            optionFilterProp="label"
            filterOption={(input, option) => {
              const mentor = (
                showAllInstitutions ? allMentorsFromStore : mentors
              ).find((m) => m.id === option.value);
              if (!mentor) return false;
              const searchLower = input.toLowerCase();
              return (
                mentor.name?.toLowerCase().includes(searchLower) ||
                mentor.email?.toLowerCase().includes(searchLower) ||
                mentor.institutionName?.toLowerCase().includes(searchLower)
              );
            }}
            suffixIcon={<SearchOutlined className="text-text-tertiary" />}
            notFoundContent={
              (showAllInstitutions ? allMentorsLoading : mentorsLoading) ? (
                <Spin size="small" />
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No mentors found"
                />
              )
            }
          >
            {(showAllInstitutions ? allMentorsFromStore : mentors).map(
              (mentor) => {
                const isExternal =
                  showAllInstitutions &&
                  mentor.institutionId !== selectedInstitute?.id;
                return (
                  <Select.Option
                    key={mentor.id}
                    value={mentor.id}
                    label={mentor.name}
                  >
                    <div className="flex justify-between items-center py-1">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-text-primary">
                            {mentor.name}
                          </span>
                          {isExternal && (
                            <Tag
                              color="purple"
                              className="m-0 text-[10px] px-1.5 border-0"
                            >
                              External
                            </Tag>
                          )}
                        </div>
                        {showAllInstitutions && (
                          <div className="text-[11px] text-text-tertiary truncate">
                            <BankOutlined className="mr-1" />
                            {mentor.institutionName || "Unknown Institution"}
                            {mentor.institutionCode && (
                              <span className="ml-1">
                                ({mentor.institutionCode})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <Tag className="m-0 ml-2 rounded border-border bg-background text-[10px] text-text-secondary shrink-0">
                        {mentor.activeAssignments} students
                      </Tag>
                    </div>
                  </Select.Option>
                );
              },
            )}
          </Select>

          {showAllInstitutions &&
            selectedMentorId &&
            (() => {
              const selectedMentor = allMentorsFromStore.find(
                (m) => m.id === selectedMentorId,
              );
              const isExternal =
                selectedMentor?.institutionId !== selectedInstitute?.id;
              if (isExternal && selectedMentor) {
                return (
                  <Alert
                    type="info"
                    className="mt-3 rounded-lg"
                    message={
                      <span className="text-sm">
                        <strong>{selectedMentor.name}</strong> is from{" "}
                        <strong>{selectedMentor.institutionName}</strong>. This
                        is a cross-institution assignment.
                      </span>
                    }
                    showIcon
                  />
                );
              }
              return null;
            })()}
        </div>
      </Modal>

      {/* File Explorer Drawer */}
      <InstitutionFileExplorer
        open={fileExplorerOpen}
        onClose={() => setFileExplorerOpen(false)}
        institutionId={selectedInstitute?.id}
        institutionName={overview.data?.institution?.name}
      />
    </div>
  );
};

export default memo(InstituteDetailView);
