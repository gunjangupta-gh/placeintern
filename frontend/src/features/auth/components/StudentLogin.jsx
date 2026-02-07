import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// StudentLogin now redirects to main Login page which has both email and registration number login
function StudentLogin() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/login", { replace: true });
  }, [navigate]);

  return null;
}

export default StudentLogin;
