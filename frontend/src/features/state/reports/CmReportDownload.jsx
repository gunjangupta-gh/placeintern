// Year picker + download button for the CM Dashboard (state-wide) and the
// Complete Information (Courses) form (pass institutionId for one college).
import React, { useState } from "react";
import { Button, Select, Space, Tooltip } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { toast } from "react-hot-toast";
import { stateService } from "../../../services/state.service";
import { downloadBlob } from "../../../utils/downloadUtils";

const thisYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => thisYear + 1 - i).map((y) => ({
  value: y,
  label: `${y}-${String((y + 1) % 100).padStart(2, "0")}`,
}));

const CmReportDownload = ({ institutionId, size = "middle" }) => {
  const [year, setYear] = useState(thisYear);
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const blob = institutionId
        ? await stateService.downloadCollegeInfo(institutionId, year)
        : await stateService.downloadCmDashboard(year);
      downloadBlob(blob, institutionId ? `Course-Information-${year}.xlsx` : `CM-Dashboard-${year}.xlsx`);
    } catch (error) {
      console.error("Report download error:", error);
      toast.error(error?.message || "Failed to download report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space.Compact size={size}>
      <Tooltip title="Report year (enrolment year; result, dropout and placement are for the batch passing out that year)">
        <Select value={year} onChange={setYear} options={YEAR_OPTIONS} style={{ width: 100 }} />
      </Tooltip>
      <Button type="primary" icon={<DownloadOutlined />} loading={loading} onClick={handleDownload}>
        {institutionId ? "Course Info" : "CM Dashboard"}
      </Button>
    </Space.Compact>
  );
};

export default CmReportDownload;
