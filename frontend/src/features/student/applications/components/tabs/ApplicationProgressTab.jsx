import React from 'react';
import MonthlyReportsSection from '../MonthlyReportsSection';

const ApplicationProgressTab = ({
  application,
  monthlyReports,
  monthlyReportsProgress,
  monthlyReportsLoading,
  monthlyReportsUploading,
  internshipStarted,
  onUploadReport,
  onDeleteReport,
  onRefreshReports,
}) => (
  <div className="space-y-4">
    {/* Monthly Reports Section */}
    <MonthlyReportsSection
      application={application}
      reports={monthlyReports}
      progress={monthlyReportsProgress}
      loading={monthlyReportsLoading}
      uploading={monthlyReportsUploading}
      onUpload={onUploadReport}
      onDelete={onDeleteReport}
      onRefresh={onRefreshReports}
      hasStarted={internshipStarted}
    />
  </div>
);

export default ApplicationProgressTab;
