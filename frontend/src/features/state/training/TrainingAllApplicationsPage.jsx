import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Button,
  Card,
  Input,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  DeleteOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import TrainingEmptyState from "../../../components/training/TrainingEmptyState";
import { TableRowSkeleton } from "../../../components/training/skeletons/TrainingSkeletons";
import {
  fetchStateApplications,
  permanentlyDeleteStateApplication,
} from "../store/stateTrainingSlice";

const { Text } = Typography;

const STATUS_OPTIONS = [
  { label: "All", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
];

const normalizeStatus = (status) => String(status || "").trim().toUpperCase();

const statusConfig = {
  APPROVED: { color: "green", label: "Approved" },
  REJECTED: { color: "red", label: "Rejected" },
  PENDING: { color: "orange", label: "Pending" },
  SUBMITTED: { color: "blue", label: "Submitted" },
};

const TrainingAllApplicationsPage = () => {
  const dispatch = useDispatch();
  const { applications } = useSelector((state) => state.stateTraining);

  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [institutionFilter, setInstitutionFilter] = useState("ALL");
  const [tablePagination, setTablePagination] = useState({ current: 1, pageSize: 10 });
  const [sortState, setSortState] = useState({ field: null, order: null });
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText.trim());
    }, 400);

    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    const params = {
      page: tablePagination.current,
      limit: tablePagination.pageSize,
      forceRefresh: true,
    };

    if (statusFilter !== "ALL") {
      params.status = statusFilter;
    }

    if (debouncedSearch) {
      params.search = debouncedSearch;
    }

    dispatch(fetchStateApplications(params));
  }, [dispatch, tablePagination.current, tablePagination.pageSize, debouncedSearch, statusFilter]);

  const isLoading = applications.loading && !(applications.list?.length > 0);

  const filteredApplications = useMemo(() => {
    const list = applications.list || [];
    const search = debouncedSearch.toLowerCase();

    return list.filter((item) => {
      const normalizedStatus = normalizeStatus(item.status);
      const matchesStatus =
        statusFilter === "ALL"
          ? true
          : statusFilter === "PENDING"
            ? ["PENDING", "SUBMITTED"].includes(normalizedStatus)
            : normalizedStatus === statusFilter;

      if (!matchesStatus) return false;

      const matchesInstitution =
        institutionFilter === "ALL"
          ? true
          : String(item.user?.Institution?.id || "") === String(institutionFilter);

      if (!matchesInstitution) return false;

      if (!search) return true;

      const userName = item.user?.name || "";
      const userEmail = item.user?.email || "";
      const trainingTitle = item.training?.title || "";

      return (
        userName.toLowerCase().includes(search) ||
        userEmail.toLowerCase().includes(search) ||
        trainingTitle.toLowerCase().includes(search)
      );
    });
  }, [applications.list, debouncedSearch, statusFilter, institutionFilter]);

  const institutionOptions = useMemo(() => {
    const list = applications.list || [];
    const map = new Map();
    list.forEach((item) => {
      const id = item.user?.Institution?.id;
      const label = item.user?.Institution?.shortName || item.user?.Institution?.name || "N/A";
      if (id && !map.has(id)) {
        map.set(id, { value: id, label });
      }
    });

    return [{ value: "ALL", label: "All Institutions" }, ...Array.from(map.values())];
  }, [applications.list]);

  const handlePermanentDelete = async (applicationId) => {
    setDeletingId(applicationId);
    try {
      await dispatch(permanentlyDeleteStateApplication(applicationId)).unwrap();
      message.success("Application permanently deleted");

      const params = {
        page: tablePagination.current,
        limit: tablePagination.pageSize,
        forceRefresh: true,
      };
      if (statusFilter !== "ALL") {
        params.status = statusFilter;
      }
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      dispatch(fetchStateApplications(params));
    } catch (error) {
      message.error(error || "Failed to permanently delete application");
    } finally {
      setDeletingId(null);
    }
  };

  const columns = [
    {
      title: "Training",
      dataIndex: ["training", "title"],
      key: "training",
      width: 250,
      sorter: (a, b) =>
        String(a.training?.title || "").localeCompare(String(b.training?.title || "")),
      sortOrder: sortState.field === "training" ? sortState.order : null,
      showSorterTooltip: false,
      render: (value) => (
        <Tooltip title={value || "Untitled Training"}>
          <Text className="text-xs font-semibold text-slate-800 block truncate max-w-[220px]">
            {value || "Untitled Training"}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: "Faculty",
      dataIndex: ["user", "name"],
      key: "user",
      width: 200,
      sorter: (a, b) => String(a.user?.name || "").localeCompare(String(b.user?.name || "")),
      sortOrder: sortState.field === "user" ? sortState.order : null,
      showSorterTooltip: false,
      render: (_, record) => (
        <div>
          <div className="font-medium text-sm text-slate-800">{record.user?.name || "Faculty"}</div>
          <Text type="secondary" className="text-xs">{record.user?.email || "-"}</Text>
        </div>
      ),
    },
    {
      title: "Institution",
      key: "institution",
      width: 200,
      sorter: (a, b) =>
        String(a.user?.Institution?.shortName || a.user?.Institution?.name || "").localeCompare(
          String(b.user?.Institution?.shortName || b.user?.Institution?.name || ""),
        ),
      sortOrder: sortState.field === "institution" ? sortState.order : null,
      showSorterTooltip: false,
      render: (_, record) => {
        const institutionName = record.user?.Institution?.shortName || record.user?.Institution?.name || "N/A";
        return (
          <Tooltip title={record.user?.Institution?.name || institutionName}>
            <Text className="text-xs text-slate-700 block truncate max-w-[180px]">
              {institutionName}
            </Text>
          </Tooltip>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      sorter: (a, b) => normalizeStatus(a.status).localeCompare(normalizeStatus(b.status)),
      sortOrder: sortState.field === "status" ? sortState.order : null,
      showSorterTooltip: false,
      render: (status) => {
        const normalized = normalizeStatus(status);
        const config = statusConfig[normalized] || { color: "default", label: normalized || "-" };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: "Applied On",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 130,
      sorter: (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
      sortOrder: sortState.field === "createdAt" ? sortState.order : null,
      showSorterTooltip: false,
      render: (value) => (
        <Text className="text-xs">
          {value
            ? new Date(value).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "-"}
        </Text>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Permanently delete this application">
            <Popconfirm
              title="Delete application permanently?"
              description="This action cannot be undone."
              okText="Delete"
              okButtonProps={{ danger: true, loading: deletingId === record.id }}
              onConfirm={() => handlePermanentDelete(record.id)}
            >
              <Button
                danger
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                loading={deletingId === record.id}
                aria-label={`Delete application from ${record.user?.name || "faculty"}`}
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-4 training-ui" role="main" aria-label="All training applications">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 mb-0.5">All Training Applications</h1>
          <Text type="secondary" className="text-xs">
            State-level view of applications across all trainings with permanent delete control.
          </Text>
        </div>
      </div>

      <Card className="rounded-xl border-border shadow-none mb-3!" styles={{ body: { padding: "12px" } }}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <Space wrap>
            <Input
              placeholder="Search by training, faculty name, or email..."
              prefix={<SearchOutlined className="text-slate-400" />}
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value);
                setTablePagination((prev) => ({ ...prev, current: 1 }));
              }}
              className="lg:w-96"
              size="middle"
              allowClear
            />

            <Select
              value={institutionFilter}
              onChange={(value) => {
                setInstitutionFilter(value);
                setTablePagination((prev) => ({ ...prev, current: 1 }));
              }}
              options={institutionOptions}
              className="w-52"
              size="middle"
            />
          </Space>

          <Segmented
            size="small"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
              setTablePagination((prev) => ({ ...prev, current: 1 }));
            }}
          />
        </div>
      </Card>

      <Card className="rounded-xl border-border shadow-none" styles={{ body: { padding: "12px" } }}>
        {isLoading ? (
          <TableRowSkeleton rows={5} columns={5} />
        ) : filteredApplications.length > 0 ? (
          <div className="custom-scrollbar overflow-x-auto">
            <Table
              className="custom-table"
              rowKey="id"
              columns={columns}
              dataSource={filteredApplications}
              loading={applications.loading}
              size="small"
              scroll={{ x: "max-content" }}
              pagination={{
                current: tablePagination.current,
                pageSize: tablePagination.pageSize,
                total: searchText
                  ? filteredApplications.length
                  : (applications.pagination?.total || applications.list?.length || 0),
                size: "small",
                showSizeChanger: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
              }}
              onChange={(pagination, _filters, sorter) => {
                const normalizedSorter = Array.isArray(sorter) ? sorter[0] : sorter;
                setTablePagination({
                  current: pagination.current,
                  pageSize: pagination.pageSize,
                });

                setSortState({
                  field: normalizedSorter?.field || normalizedSorter?.columnKey || null,
                  order: normalizedSorter?.order || null,
                });
              }}
            />
          </div>
        ) : (
          <TrainingEmptyState
            type={searchText ? "search" : "applications"}
            message={searchText ? "No applications found" : "No applications available"}
            description={searchText ? "Try adjusting your search terms." : "Applications will appear here."}
          />
        )}
      </Card>

    </div>
  );
};

export default TrainingAllApplicationsPage;
