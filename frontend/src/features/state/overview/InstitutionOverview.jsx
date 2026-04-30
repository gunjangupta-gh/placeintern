import React, {
  useEffect,
  useState,
  useMemo,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import {
  Button,
  Typography,
  Card,
  Empty,
  Spin,
  theme,
  Row,
  Col,
  Input,
  Select,
  List,
  Tag,
  Grid
} from "antd";
import {
  BankOutlined,
  ReloadOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  StopOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import {
  fetchInstitutions,
  selectInstitutions,
  selectSelectedInstitute,
  selectInstitutionsLoading,
  setSelectedInstitute,
  selectInstitutionsTotalStudents,
} from "../store/stateSlice";
import { InstituteDetailView } from "../dashboard/components";

const { Text, Title } = Typography;
const { Option } = Select;
const { useBreakpoint } = Grid;

/**
 * InstitutionOverview - A page with sidebar showing institutions list
 * and main content area showing selected institution details
 * UI designed to match AllStudents page pattern
 */
const InstitutionOverview = () => {
  const dispatch = useDispatch();
  const { token } = theme.useToken();
  const screens = useBreakpoint();
  const [searchParams, setSearchParams] = useSearchParams();
  const institutions = useSelector(selectInstitutions);
  const selectedInstitute = useSelector(selectSelectedInstitute);
  const loading = useSelector(selectInstitutionsLoading);
  const apiTotalStudents = useSelector(selectInstitutionsTotalStudents);
  const [initialTab, setInitialTab] = useState(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [listCollapsed, setListCollapsed] = useState(false);

  // Get URL params
  const urlInstitutionId = searchParams.get("id");
  const urlTab = searchParams.get("tab");

  // Fetch institutions on mount
  useEffect(() => {
    if (institutions.length === 0 && !loading) {
      dispatch(fetchInstitutions({ limit: 100 }));
    }
  }, [dispatch, institutions.length, loading]);

  // Auto-select institution from URL param
  useEffect(() => {
    if (
      urlInstitutionId &&
      institutions.length > 0 &&
      urlInstitutionId !== selectedInstitute?.id
    ) {
      const institution = institutions.find(
        (inst) => inst.id === urlInstitutionId,
      );
      if (institution) {
        dispatch(setSelectedInstitute(institution.id));
        if (urlTab) {
          setInitialTab(urlTab);
        }
        setSearchParams({}, { replace: true });
      }
    }
  }, [
    urlInstitutionId,
    urlTab,
    institutions,
    selectedInstitute?.id,
    dispatch,
    setSearchParams,
  ]);

  const handleRefresh = () => {
    dispatch(fetchInstitutions({ limit: 100, force: true }));
  };

  // Calculate total students
  const totalStudents = useMemo(
    () =>
      apiTotalStudents ??
      institutions.reduce((sum, inst) => sum + (inst._count?.Student || 0), 0),
    [apiTotalStudents, institutions],
  );

  const displayInstitution = institutions.find(
    (i) => i.id === selectedInstitute?.id,
  );

  // Filtering Institutions
  const filteredInstitutions = useMemo(() => {
    return institutions.filter((inst) => {
      // Name or Code match
      const lowerSearch = searchQuery.toLowerCase();
      const matchesSearch =
        (inst.name && inst.name.toLowerCase().includes(lowerSearch)) ||
        (inst.code && inst.code.toLowerCase().includes(lowerSearch)) ||
        (inst.shortName && inst.shortName.toLowerCase().includes(lowerSearch));

      // Status match
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && inst.isActive) ||
        (statusFilter === "inactive" && !inst.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [institutions, searchQuery, statusFilter]);

  const handleSelectInstitution = (inst) => {
    dispatch(setSelectedInstitute(inst.id));
    setSearchParams({ id: inst.id }, { replace: true });
  };

  return (
    <div style={{ padding: 12, backgroundColor: token.colorBgLayout, minHeight: "100vh" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16, gap: 12 }}>
        <Button
          type="text"
          icon={listCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={() => setListCollapsed(!listCollapsed)}
          style={{ fontSize: 16 }}
        />
        <Title level={4} style={{ color: token.colorTextHeading, margin: 0, flex: 1 }}>
          Institution Overview
        </Title>
        <Button
          icon={<ReloadOutlined />}
          onClick={handleRefresh}
          loading={loading}
          size="small"
        >
          Refresh
        </Button>
      </div>

      <div style={{ display: "flex", gap: 12, height: screens.md ? "calc(100vh - 100px)" : "auto" }}>
        {/* Left Panel - List */}
        <div style={{
          width: listCollapsed ? 0 : (screens.lg ? 280 : 240),
          minWidth: listCollapsed ? 0 : (screens.lg ? 280 : 240),
          overflow: "hidden",
          transition: "all 0.3s ease",
          opacity: listCollapsed ? 0 : 1,
        }}>
          <div style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            backgroundColor: token.colorBgContainer,
            borderRadius: token.borderRadius,
          }}>
            {/* Header */}
            <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Text strong style={{ fontSize: 13 }}>Directory</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>{filteredInstitutions.length}/{institutions.length}</Text>
            </div>

            {/* Filters */}
            <div style={{ padding: "0 12px 10px" }}>
              <Input
                placeholder="Search..."
                size="small"
                style={{ marginBottom: 8 }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                prefix={<SearchOutlined style={{ color: token.colorTextDisabled, fontSize: 12 }} />}
                allowClear
              />
              <Select
                size="small"
                style={{ width: "100%" }}
                value={statusFilter}
                onChange={setStatusFilter}
              >
                <Option value="all">All Status</Option>
                <Option value="active">Active Only</Option>
                <Option value="inactive">Inactive Only</Option>
              </Select>
            </div>

            {/* List */}
            <div style={{ overflowY: "auto", padding: "0 8px 8px", flex: 1 }}>
              {loading && institutions.length === 0 ? (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 100 }}>
                  <Spin size="small" />
                </div>
              ) : (
                <List
                  itemLayout="horizontal"
                  dataSource={filteredInstitutions}
                  locale={{ emptyText: "No institutions found" }}
                  renderItem={(inst) => (
                    <List.Item
                      onClick={() => handleSelectInstitution(inst)}
                      style={{
                        cursor: "pointer",
                        margin: "2px 0",
                        padding: "6px 10px",
                        borderRadius: token.borderRadius,
                        backgroundColor: selectedInstitute?.id === inst.id ? token.colorPrimaryBg : "transparent",
                        borderLeft: `3px solid ${selectedInstitute?.id === inst.id ? token.colorPrimary : "transparent"}`,
                      }}
                    >
                      <List.Item.Meta
                        title={
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <Text style={{ fontWeight: 500, fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {inst.shortName || inst.name}
                            </Text>
                            <Tag color={inst.isActive ? "success" : "default"} bordered={false} style={{ fontSize: 9, lineHeight: "14px", height: 16, margin: 0, padding: "0 4px" }}>
                              {inst.isActive ? "Active" : "Inactive"}
                            </Tag>
                          </div>
                        }
                        description={
                          <div style={{ fontSize: 10, color: token.colorTextDescription, display: "flex", gap: 8 }}>
                            {inst.code && <span style={{ fontFamily: "monospace" }}>{inst.code}</span>}
                            {inst._count?.Student > 0 && <span>{inst._count.Student} students</span>}
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Details */}
        <div style={{ flex: 1, minWidth: 0, backgroundColor: token.colorBgContainer, borderRadius: token.borderRadius, overflow: "hidden" }}>
          {loading && !selectedInstitute ? (
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100%" }}>
              <Spin tip="Loading..." />
            </div>
          ) : selectedInstitute ? (
            <InstituteDetailView defaultTab={initialTab} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100%" }}>
              <BankOutlined style={{ fontSize: 40, color: token.colorTextDisabled, marginBottom: 12 }} />
              <Title level={5} style={{ color: token.colorTextSecondary, margin: 0 }}>Select an Institution</Title>
              <Text type="secondary" style={{ fontSize: 12 }}>Choose from the directory</Text>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstitutionOverview;
