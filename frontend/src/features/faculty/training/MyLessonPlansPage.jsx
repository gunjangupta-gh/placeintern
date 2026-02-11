import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Button,
  Card,
  Input,
  Popconfirm,
  Segmented,
  Space,
  Table,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  EditOutlined,
  PlusOutlined,
  SendOutlined,
  DeleteOutlined,
  BookOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import LessonPlanStatusBadge from "../../../components/training/LessonPlanStatusBadge";
import TrainingEmptyState from "../../../components/training/TrainingEmptyState";
import {
  fetchLessonPlans,
  deleteLessonPlan,
  submitLessonPlan,
} from "../store/facultyTrainingSlice";

const { Text } = Typography;

const MyLessonPlansPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { lessonPlans } = useSelector((state) => state.facultyTraining);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    dispatch(fetchLessonPlans());
  }, [dispatch]);

  const handleDelete = async (id) => {
    try {
      await dispatch(deleteLessonPlan(id)).unwrap();
      message.success("Lesson plan deleted");
    } catch (error) {
      message.error(error || "Failed to delete lesson plan");
    }
  };

  const handleSubmit = async (id) => {
    try {
      await dispatch(submitLessonPlan(id)).unwrap();
      message.success("Lesson plan submitted for review");
    } catch (error) {
      message.error(error || "Failed to submit lesson plan");
    }
  };

  const filteredPlans = useMemo(() => {
    let result = lessonPlans.list || [];
    if (statusFilter !== "ALL") {
      if (statusFilter === "SUBMITTED") {
        result = result.filter((item) =>
          ["SUBMITTED", "UNDER_REVIEW"].includes(item.status),
        );
      } else {
        result = result.filter((item) => item.status === statusFilter);
      }
    }
    if (searchText) {
      const search = searchText.toLowerCase();
      result = result.filter(
        (item) =>
          (item.title || "").toLowerCase().includes(search) ||
          (item.training?.title || item.trainingTitle || "")
            .toLowerCase()
            .includes(search),
      );
    }
    return result;
  }, [lessonPlans.list, searchText, statusFilter]);

  const columns = [
    {
      title: "Lesson Plan",
      dataIndex: "title",
      key: "title",
      render: (title, record) => (
        <div className="py-1">
          <div className="font-medium text-sm text-slate-800">
            {title || "Untitled"}
          </div>
          <Text type="secondary" className="text-xs">
            {record.courseOrSemester || "No course specified"}
          </Text>
        </div>
      ),
    },
    {
      title: "Training",
      dataIndex: ["training", "title"],
      key: "training",
      render: (_, record) => (
        <span className="text-sm text-slate-700">
          {record.training?.title || record.trainingTitle || "Training"}
        </span>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status) => <LessonPlanStatusBadge status={status} />,
    },
    {
      title: "Updated",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 100,
      sorter: (a, b) => new Date(a.updatedAt) - new Date(b.updatedAt),
      render: (value) => (
        <Text className="text-xs">
          {value
            ? new Date(value).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : "-"}
        </Text>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 150,
      render: (_, record) => (
        <Space>
          <Tooltip title="View/Edit">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() =>
                navigate(`/app/training/lesson-plans/${record.id}/edit`)
              }
            />
          </Tooltip>
          {record.status === "DRAFT" && (
            <Tooltip title="Submit for Review">
              <Button
                type="text"
                size="small"
                className="text-green-600 hover:text-green-700"
                icon={<SendOutlined />}
                onClick={() => handleSubmit(record.id)}
              />
            </Tooltip>
          )}
          {["DRAFT", "REJECTED"].includes(record.status) && (
            <Popconfirm
              title="Delete lesson plan?"
              description="This action cannot be undone."
              onConfirm={() => handleDelete(record.id)}
              okText="Delete"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Delete">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6 training-ui">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div>
            <h2 className="text-lg font-semibold mb-0">My Lesson Plans</h2>
          </div>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate("/app/training/lesson-plans/new")}
        >
          New Lesson Plan
        </Button>
      </div>

      <Card className="rounded-xl border-border shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-3">
          <Input
            placeholder="Search lesson plans..."
            prefix={<SearchOutlined className="text-slate-400" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="lg:flex-1"
            allowClear
          />
          <Segmented
            size="small"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { label: "All", value: "ALL" },
              { label: "Draft", value: "DRAFT" },
              { label: "In Review", value: "SUBMITTED" },
              { label: "Approved", value: "APPROVED" },
            ]}
          />
        </div>

        {filteredPlans.length > 0 && (
          <div className="mb-3 pb-3 border-b border-slate-200">
            <Text className="text-xs text-slate-600">
              Showing <Text strong>{filteredPlans.length}</Text> of{" "}
              <Text strong>{lessonPlans.list?.length || 0}</Text> lesson plans
            </Text>
          </div>
        )}

        {filteredPlans.length === 0 && !lessonPlans.loading ? (
          <TrainingEmptyState
            type="lesson-plans"
            message="No lesson plans yet"
            description="Create a lesson plan to document how you'll apply training insights in your classroom."
            actionText="Create Lesson Plan"
            onAction={() => navigate("/app/training/lesson-plans/new")}
          />
        ) : (
          <Table
            className="custom-table"
            rowKey="id"
            columns={columns}
            dataSource={filteredPlans}
            loading={lessonPlans.loading}
            size="small"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total, range) => (
                <Text className="text-xs text-slate-600">
                  {range[0]}-{range[1]} of {total}
                </Text>
              ),
              size: "small",
            }}
          />
        )}
      </Card>
    </div>
  );
};

export default MyLessonPlansPage;
