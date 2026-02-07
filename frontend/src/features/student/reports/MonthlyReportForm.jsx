import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// This component redirects to the main reports page
// The form is now integrated as a modal in StudentReportSubmit
const MonthlyReportForm = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/app/reports/submit', { replace: true });
  }, [navigate]);

  return null;
};

export default MonthlyReportForm;
