import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const GoogleRedirectHandler = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const token = urlParams.get("token");
    const id = urlParams.get("id") || ""; // your backend doesn't send id right now
    const name = urlParams.get("name");
    const email = urlParams.get("email");

    if (token && name && email) {

      const loginResponse = {
        access_token: token,
        user: {
          id,
          name,
          email,
        },
      };

      // Save to localStorage
      localStorage.setItem("token", token);
      localStorage.setItem("loginResponse", JSON.stringify(loginResponse));

      // Redirect to dashboard
      navigate("/dashboard");
    } else {
      console.error("❌ Missing login parameters, redirecting to /login");
      navigate("/login");
    }
  }, [location.search, navigate]);

  return <div>Processing Google Login, Please wait...</div>;
};

export default GoogleRedirectHandler;