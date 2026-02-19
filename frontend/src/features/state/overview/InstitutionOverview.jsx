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
} from "antd";
import {
  BankOutlined,
  ReloadOutlined,
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

/**
 * InstitutionOverview - A page with sidebar showing institutions list
 * and main content area showing selected institution details
 * UI designed to match AllStudents page pattern
 */
const InstitutionOverview = () => {
  const dispatch = useDispatch();
  const { token } = theme.useToken();
  const [searchParams, setSearchParams] = useSearchParams();
  const institutions = useSelector(selectInstitutions);
  const selectedInstitute = useSelector(selectSelectedInstitute);
  const loading = useSelector(selectInstitutionsLoading);
  const apiTotalStudents = useSelector(selectInstitutionsTotalStudents);
  const [initialTab, setInitialTab] = useState(null);

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

  return (
    <div style={{ padding: 24 }}>
      {/* Header - Compact */}
      {/* <div
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
              {institutions.length} total •{" "}
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
      </div> */}

      <Card
        style={{ height: "calc(100vh - 100px)", overflow: "hidden" }}
        bodyStyle={{
          padding: 0,
          height: "100%",
          overflowY: "auto",
          overflowX: "hidden",
          scrollbarGutter: "stable",
        }}
      >
        {loading && !selectedInstitute ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Spin tip="Loading institution..." />
          </div>
        ) : selectedInstitute ? (
          <InstituteDetailView defaultTab={initialTab} />
        ) : (
          <Empty
            description="Select an institution from Institution Management to view details"
            style={{ marginTop: "20%" }}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Card>
    </div>
  );
};

export default InstitutionOverview;
