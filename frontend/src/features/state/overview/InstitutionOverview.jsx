import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import {
  Button,
  Typography,
  Input,
  Card,
  Avatar,
  Empty,
  Spin,
  Grid,
  theme,
  Tag,
  Tooltip,
} from "antd";
import {
  BankOutlined,
  SearchOutlined,
  ReloadOutlined,
  TeamOutlined,
  EnvironmentOutlined,
  CheckCircleFilled,
} from "@ant-design/icons";
import {
  fetchInstitutions,
  selectInstitutions,
  selectSelectedInstitute,
  selectInstitutionsLoading,
  clearSelectedInstitute,
  setSelectedInstitute,
  selectInstitutionsTotalStudents,
} from "../store/stateSlice";
import { InstituteDetailView } from "../dashboard/components";

const { Text, Title } = Typography;
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

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [initialTab, setInitialTab] = useState(null);
  const listRef = useRef(null);

  // Get URL params
  const urlInstitutionId = searchParams.get("id");
  const urlTab = searchParams.get("tab");

  // Fetch institutions on mount
  useEffect(() => {
    if (institutions.length === 0 && !loading) {
      dispatch(fetchInstitutions({ limit: 100 }));
    }
  }, [dispatch, institutions.length, loading]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Filter institutions
  const filteredInstitutions = useMemo(() => {
    if (!debouncedSearch) return institutions;
    const search = debouncedSearch.toLowerCase();
    return institutions.filter(
      (inst) =>
        inst.shortName?.toLowerCase().includes(search) ||
        inst.name?.toLowerCase().includes(search) ||
        inst.code?.toLowerCase().includes(search) ||
        inst.city?.toLowerCase().includes(search),
    );
  }, [institutions, debouncedSearch]);

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

  // Auto-select first institution on desktop if none selected
  useEffect(() => {
    if (screens.md && filteredInstitutions.length > 0 && !selectedInstitute) {
      handleInstitutionSelect(filteredInstitutions[0]);
    }
  }, [filteredInstitutions, screens.md]);

  const handleInstitutionSelect = useCallback(
    (institution) => {
      dispatch(setSelectedInstitute(institution.id));
    },
    [dispatch],
  );

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

  return (
    <div style={{ padding: 24 }}>
      {/* Header - Compact */}
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          backgroundColor: token.colorBgContainer,
          borderRadius: token.borderRadiusLG,
          border: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <BankOutlined style={{ fontSize: 20, color: token.colorPrimary }} />
          <div>
            <Title level={4} style={{ margin: 0, lineHeight: 1.2 }}>
              Institutions
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {filteredInstitutions.length}{" "}
              {debouncedSearch ? "filtered" : "total"} •{" "}
              {totalStudents.toLocaleString()} students
            </Text>
          </div>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={handleRefresh}
          loading={loading}
          size="small"
        />
      </div>

      {/* Main Container */}
      <div style={{ display: "flex", gap: 16, height: "calc(100vh - 180px)" }}>
        {/* Institutions List - Left Side */}
        <Card
          style={{
            width: screens.md ? 280 : "100%",
            display: !screens.md && selectedInstitute ? "none" : "block",
            height: "100%",
            overflow: "hidden",
          }}
          bodyStyle={{
            padding: 0,
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Search Bar */}
          <div
            style={{
              padding: 16,
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <Input
              placeholder="Search by name, code, or city..."
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
            />
            <div
              style={{
                marginTop: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text type="secondary" style={{ fontSize: 12 }}>
                <TeamOutlined /> Total Students:{" "}
                <strong>{totalStudents.toLocaleString()}</strong>
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {filteredInstitutions.length} institutions
              </Text>
            </div>
          </div>

          {/* Institutions List */}
          <div
            ref={listRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 12,
            }}
          >
            {loading && institutions.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48 }}>
                <Spin tip="Loading institutions..." />
              </div>
            ) : filteredInstitutions.length === 0 ? (
              <Empty
                description={
                  debouncedSearch
                    ? `No institutions found matching "${debouncedSearch}"`
                    : "No institutions found"
                }
                style={{ marginTop: 48 }}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filteredInstitutions.map((institution) => {
                  const isSelected = selectedInstitute?.id === institution.id;
                  const studentCount = institution._count?.Student || 0;

                  return (
                    <Card
                      key={institution.id}
                      hoverable
                      onClick={() => handleInstitutionSelect(institution)}
                      style={{
                        cursor: "pointer",
                        borderLeft: isSelected
                          ? `4px solid ${token.colorPrimary}`
                          : "4px solid transparent",
                        backgroundColor: isSelected
                          ? token.colorPrimaryBg
                          : token.colorBgContainer,
                        transition: "all 0.3s",
                      }}
                      bodyStyle={{ padding: 12 }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 12,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "start",
                              marginBottom: 4,
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <Text
                                strong
                                style={{
                                  fontSize: 14,
                                  display: "block",
                                  color: isSelected
                                    ? token.colorPrimary
                                    : token.colorText,
                                }}
                                ellipsis
                              >
                                {institution.shortName || institution.name}
                              </Text>
                              {institution.code && (
                                <Text
                                  type="secondary"
                                  style={{ fontSize: 12, display: "block" }}
                                >
                                  {institution.code}
                                </Text>
                              )}
                            </div>
                            {institution.isActive && (
                              <CheckCircleFilled
                                style={{
                                  color: token.colorSuccess,
                                  fontSize: 16,
                                }}
                              />
                            )}
                          </div>

                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 8,
                              marginTop: 8,
                            }}
                          >
                            <Tooltip title="Total Students">
                              <Tag
                                icon={<TeamOutlined />}
                                color="blue"
                                style={{ fontSize: 11, margin: 0 }}
                              >
                                {studentCount}
                              </Tag>
                            </Tooltip>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        {/* Institution Details - Right Side */}
        <Card
          style={{
            flex: 1,
            display: !screens.md && !selectedInstitute ? "none" : "block",
            height: "100%",
            overflow: "hidden",
          }}
          bodyStyle={{ padding: 0, height: "100%", overflow: "auto" }}
        >
          {selectedInstitute ? (
            <InstituteDetailView defaultTab={initialTab} />
          ) : (
            <Empty
              description="Select an institution to view details"
              style={{ marginTop: "20%" }}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </Card>
      </div>
    </div>
  );
};

export default InstitutionOverview;
