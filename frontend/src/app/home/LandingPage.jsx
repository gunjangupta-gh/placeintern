import React, { useState, useEffect, useRef } from "react";
import { Button, ConfigProvider, theme } from "antd";
import {
  LoginOutlined,
  SunOutlined,
  MoonOutlined,
  MenuOutlined,
  CloseOutlined,
  CheckCircleOutlined,
  RightOutlined,
  PhoneOutlined,
  MailOutlined,
  EnvironmentOutlined,
  UserOutlined,
  TeamOutlined,
  BankOutlined,
  ApartmentOutlined,
  FileTextOutlined,
  CalendarOutlined,
  BellOutlined,
  SafetyOutlined,
  DashboardOutlined,
  SettingOutlined,
  AuditOutlined,
  SolutionOutlined,
  BarChartOutlined,
  MobileOutlined,
  LockOutlined,
  CloudUploadOutlined,
  MessageOutlined,
  LineChartOutlined,
  BookOutlined,
  IdcardOutlined,
  ScheduleOutlined,
  CommentOutlined,
  FlagOutlined,
  GlobalOutlined,
  FundProjectionScreenOutlined,
  ReconciliationOutlined,
  LinkOutlined,
  QuestionCircleOutlined,
  PlusOutlined,
  MinusOutlined,
} from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { useTheme } from "../../contexts/ThemeContext";
import { useSelector } from "react-redux";


// Scribble underline SVG component - inspired by CodeYogi
const ScribbleUnderline = ({ color = "#6366f1", width = 200 }) => (
  <svg
    width={width}
    height="12"
    viewBox="0 0 200 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="absolute -bottom-2 left-0"
  >
    <path
      d="M2 8.5C20 3.5 40 10.5 60 6.5C80 2.5 100 9.5 120 5.5C140 1.5 160 8.5 180 4.5C190 2.5 198 6.5 198 6.5"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

// Vintage Paper Texture Background
const VintagePaperBackground = ({ isDark }) => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {/* Old paper texture pattern */}
    <div
      className={`absolute inset-0 ${
        isDark ? "opacity-[0.02]" : "opacity-[0.08]"
      }`}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='${
          isDark ? "%23ffffff" : "%23000000"
        }' fill-opacity='0.15'%3E%3Cpath opacity='.5' d='M96 95h4v1h-4v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9zm-1 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm9-10v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm9-10v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm9-10v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9z'/%3E%3Cpath d='M6 5V0H5v5H0v1h5v94h1V6h94V5H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }}
    />

    {/* Aged paper stain effect */}
    <div
      className={`absolute inset-0 ${
        isDark ? "opacity-[0.015]" : "opacity-[0.04]"
      }`}
      style={{
        background: `radial-gradient(ellipse at 20% 30%, ${
          isDark ? "#d4a574" : "#c4956a"
        } 0%, transparent 50%),
                     radial-gradient(ellipse at 80% 70%, ${
                       isDark ? "#d4a574" : "#c4956a"
                     } 0%, transparent 45%),
                     radial-gradient(ellipse at 50% 90%, ${
                       isDark ? "#b8956e" : "#a8856e"
                     } 0%, transparent 40%)`,
      }}
    />

    {/* Book spine shadow effect */}
    <div
      className={`absolute left-0 top-0 bottom-0 w-8 ${
        isDark ? "opacity-[0.1]" : "opacity-[0.06]"
      }`}
      style={{
        background: `linear-gradient(to right, ${
          isDark ? "#000" : "#4a3728"
        } 0%, transparent 100%)`,
      }}
    />
  </div>
);

// Animated Background Component - CodeYogi inspired with vintage elements
const AnimatedBackground = ({ isDark }) => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {/* Grid pattern overlay */}
    <div
      className={`absolute inset-0 ${
        isDark ? "opacity-[0.03]" : "opacity-[0.4]"
      }`}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='${
          isDark ? "%23ffffff" : "%236366f1"
        }' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }}
    />

    {/* Large gradient blob - top right */}
    <motion.div
      className={`absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full ${
        isDark
          ? "bg-gradient-to-br from-indigo-600/20 via-blue-600/10 to-purple-600/20"
          : "bg-gradient-to-br from-indigo-400/30 via-blue-300/20 to-purple-400/30"
      }`}
      style={{ filter: "blur(80px)" }}
      animate={{
        scale: [1, 1.2, 1],
        rotate: [0, 90, 0],
        x: [0, 30, 0],
        y: [0, -20, 0],
      }}
      transition={{
        duration: 20,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />

    {/* Medium gradient blob - bottom left */}
    <motion.div
      className={`absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full ${
        isDark
          ? "bg-gradient-to-tr from-blue-600/20 via-indigo-600/10 to-cyan-600/20"
          : "bg-gradient-to-tr from-blue-400/30 via-indigo-300/20 to-cyan-400/30"
      }`}
      style={{ filter: "blur(80px)" }}
      animate={{
        scale: [1, 1.3, 1],
        rotate: [0, -90, 0],
        x: [0, -20, 0],
        y: [0, 30, 0],
      }}
      transition={{
        duration: 25,
        repeat: Infinity,
        ease: "easeInOut",
        delay: 2,
      }}
    />

    {/* Small accent blob - center */}
    <motion.div
      className={`absolute top-1/2 left-1/2 w-[300px] h-[300px] rounded-full ${
        isDark
          ? "bg-gradient-to-br from-purple-600/15 via-pink-600/10 to-indigo-600/15"
          : "bg-gradient-to-br from-purple-400/20 via-pink-300/15 to-indigo-400/20"
      }`}
      style={{ filter: "blur(60px)", transform: "translate(-50%, -50%)" }}
      animate={{
        scale: [1, 1.4, 1],
        opacity: [0.5, 0.8, 0.5],
      }}
      transition={{
        duration: 15,
        repeat: Infinity,
        ease: "easeInOut",
        delay: 1,
      }}
    />

    {/* Floating dots pattern */}
    {[...Array(6)].map((_, i) => (
      <motion.div
        key={i}
        className={`absolute w-2 h-2 rounded-full ${
          isDark ? "bg-indigo-400/30" : "bg-indigo-500/40"
        }`}
        style={{
          top: `${15 + i * 15}%`,
          left: `${10 + i * 12}%`,
        }}
        animate={{
          y: [0, -30, 0],
          opacity: [0.3, 0.8, 0.3],
          scale: [1, 1.5, 1],
        }}
        transition={{
          duration: 6 + i * 2,
          repeat: Infinity,
          ease: "easeInOut",
          delay: i * 0.5,
        }}
      />
    ))}

    {/* Right side floating dots */}
    {[...Array(4)].map((_, i) => (
      <motion.div
        key={`right-${i}`}
        className={`absolute w-3 h-3 rounded-full ${
          isDark ? "bg-blue-400/20" : "bg-blue-500/30"
        }`}
        style={{
          top: `${20 + i * 20}%`,
          right: `${5 + i * 8}%`,
        }}
        animate={{
          y: [0, 25, 0],
          x: [0, -15, 0],
          opacity: [0.2, 0.6, 0.2],
        }}
        transition={{
          duration: 8 + i * 2,
          repeat: Infinity,
          ease: "easeInOut",
          delay: i * 0.8,
        }}
      />
    ))}
  </div>
);

// Animated counter component
const AnimatedCounter = ({ end, duration = 2, suffix = "" }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let startTime;
    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [isInView, end, duration]);

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
};

// Feature card component
const FeatureCard = ({ icon, title, description, isDark, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.6, delay }}
    className={`p-8 rounded-2xl border transition-all duration-300 hover:-translate-y-2 hover:shadow-xl ${
      isDark
        ? "bg-slate-800/50 border-slate-700 hover:border-indigo-500/50"
        : "bg-white border-gray-100 hover:border-indigo-200 shadow-sm"
    }`}
  >
    <div
      className={`w-14 h-14 rounded-xl flex items-center justify-center mb-6 ${
        isDark ? "bg-indigo-500/20" : "bg-indigo-50"
      }`}
    >
      {typeof icon === "string" ? (
        <span className="text-2xl">{icon}</span>
      ) : (
        icon
      )}
    </div>
    <h3
      className={`text-xl font-semibold mb-3 ${
        isDark ? "text-white" : "text-gray-900"
      }`}
    >
      {title}
    </h3>
    <p
      className={`leading-relaxed ${
        isDark ? "text-slate-400" : "text-gray-600"
      }`}
    >
      {description}
    </p>
  </motion.div>
);

// Process step component
const ProcessStep = ({ number, title, description, isDark, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, x: -30 }}
    whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.6, delay }}
    className="flex gap-6 items-start"
  >
    <div
      className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-lg ${
        isDark
          ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
          : "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
      }`}
    >
      {number}
    </div>
    <div>
      <h4
        className={`text-lg font-semibold mb-2 ${
          isDark ? "text-white" : "text-gray-900"
        }`}
      >
        {title}
      </h4>
      <p className={`${isDark ? "text-slate-400" : "text-gray-600"}`}>
        {description}
      </p>
    </div>
  </motion.div>
);

// FAQ Item component with accordion functionality
const FAQItem = ({ question, answer, isDark, delay = 0 }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className={`rounded-xl border overflow-hidden transition-all duration-300 ${
        isDark
          ? `bg-slate-800/50 ${isOpen ? "border-indigo-500/50" : "border-slate-700"}`
          : `bg-white ${isOpen ? "border-indigo-300" : "border-gray-200"} shadow-sm`
      }`}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-6 py-5 flex items-center justify-between text-left transition-colors ${
          isDark ? "hover:bg-slate-700/50" : "hover:bg-gray-50"
        }`}
      >
        <span
          className={`font-medium text-lg pr-4 ${
            isDark ? "text-white" : "text-gray-900"
          }`}
        >
          {question}
        </span>
        <span
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
            isOpen
              ? "bg-indigo-600 text-white rotate-0"
              : isDark
              ? "bg-slate-700 text-slate-400"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {isOpen ? <MinusOutlined /> : <PlusOutlined />}
        </span>
      </button>
      <motion.div
        initial={false}
        animate={{
          height: isOpen ? "auto" : 0,
          opacity: isOpen ? 1 : 0,
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="overflow-hidden"
      >
        <div
          className={`px-6 pb-5 ${
            isDark ? "text-slate-400" : "text-gray-600"
          }`}
        >
          <div
            className={`pt-2 border-t ${
              isDark ? "border-slate-700" : "border-gray-100"
            }`}
          >
            <p className="leading-relaxed pt-3">{answer}</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const LandingPage = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((state) => state.auth);
  const { darkMode: isDark, toggleTheme } = useTheme();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const stats = [
    // { number: 16, suffix: " Weeks", label: "Training Duration" },
    { number: 56, suffix: "+", label: "Partner Industries" },
    { number: 25, suffix: "+", label: "Institutions" },
    { number: 100, suffix: "%", label: "Practical Exposure" },
  ];

  const features = [
    {
      icon: <FileTextOutlined className="text-2xl text-indigo-600" />,
      title: "Monthly Reports & Tracking",
      description:
        "Submit monthly progress reports, track attendance, and monitor your training journey with real-time status updates.",
    },
    {
      icon: <SolutionOutlined className="text-2xl text-indigo-600" />,
      title: "Faculty Supervision",
      description:
        "Get guidance from assigned faculty mentors through scheduled site visits, report verification, and continuous support.",
    },
    {
      icon: <SafetyOutlined className="text-2xl text-indigo-600" />,
      title: "Grievance Redressal",
      description:
        "File and track grievances with a multi-level resolution system involving faculty, principal, and state directorate.",
    },
    {
      icon: <BarChartOutlined className="text-2xl text-indigo-600" />,
      title: "Analytics & Insights",
      description:
        "Role-based dashboards with comprehensive analytics, compliance monitoring, and exportable reports for all stakeholders.",
    },
  ];

  const journeySteps = [
    {
      title: "Register & Create Profile",
      description:
        "Complete your profile with academic details, skills, and preferences on the portal.",
    },
    {
      title: "Submit Internship Details",
      description:
        "Upload your internship offer details, joining letter, consent forms, and required documents.",
    },
    {
      title: "Monthly Progress Reports",
      description:
        "Submit monthly reports detailing your learning, projects, and achievements during training.",
    },
    {
      title: "Evaluation & Certification",
      description:
        "Complete final evaluation including viva and report submission to earn your training certificate.",
    },
  ];

  const evaluationBreakdown = [
    {
      label: "Industry Evaluation",
      marks: 200,
      items: [
        "Regularity & Punctuality (50)",
        "Learning & Performance (75)",
        "Discipline & Initiative (50)",
        "Safety Awareness (25)",
      ],
    },
    {
      label: "Institute Evaluation",
      marks: 300,
      items: [
        "Monthly Reports (50)",
        "Faculty Visit Viva (50)",
        "Final Viva Voce (100)",
        "Final Report (100)",
      ],
    },
  ];

  return (
    <div>
      {/* Custom scrollbar styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #6366f1;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #4f46e5;
        }
      `}</style>
      <ConfigProvider
        theme={{
          algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
          token: {
            colorPrimary: "#6366f1",
            borderRadius: 8,
          },
        }}
      >
        <div
          className={`min-h-screen transition-colors duration-300 relative ${
            isDark
              ? "bg-slate-900"
              : "bg-gradient-to-br from-amber-50/20 via-white to-indigo-50/30"
          }`}
        >
          {/* Global Animated Background */}
          <AnimatedBackground isDark={isDark} />

          {/* Subtle vintage paper texture overlay for the whole page */}
          <VintagePaperBackground isDark={isDark} />

          {/* Header */}
          <header
            className={`py-4 px-6 lg:px-12 sticky top-0 z-50 transition-colors duration-300 ${
              isDark
                ? "bg-slate-900/95 border-slate-800"
                : "bg-white/95 border-gray-100"
            } border-b backdrop-blur-md`}
          >
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-8"
              >
                <div
                  className={`text-2xl font-bold flex items-center gap-2 ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  <img
                    src="/dte.webp"
                    alt="Punjab Government"
                    className="h-15 w-15 rounded-full object-contain "
                  />
                  <div>
                    <span className="font-light">Place</span>
                    <span className="text-indigo-600">Intern</span>
                  </div>
                </div>

                {!isMobile && (
                  <nav className="flex items-center gap-8">
                    {["Features", "How It Works", "Portal Features"].map(
                      (item) => (
                        <a
                          key={item}
                          href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
                          className={`text-sm font-medium hover:text-indigo-600 transition-colors ${
                            isDark ? "text-slate-300" : "text-gray-600"
                          }`}
                        >
                          {item}
                        </a>
                      )
                    )}
                  </nav>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3"
              >
                <Button
                  icon={isDark ? <SunOutlined /> : <MoonOutlined />}
                  onClick={toggleTheme}
                  className={`border-0 shadow-none ${
                    isDark ? "text-slate-300" : "text-gray-600"
                  }`}
                />

                {isMobile ? (
                  <Button
                    icon={mobileMenuOpen ? <CloseOutlined /> : <MenuOutlined />}
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className={`border-0 shadow-none ${
                      isDark ? "text-slate-300" : "text-gray-600"
                    }`}
                  />
                ) : (
                  <>
                    {!isAuthenticated ? (
                      <Button
                        type="primary"
                        onClick={() => navigate("/login")}
                        className="bg-indigo-600 hover:bg-indigo-700 border-0"
                      >
                        <LoginOutlined className="mr-1" /> Login
                      </Button>
                    ) : (
                      <Link to="/app/dashboard">
                        <Button
                          type="primary"
                          className="bg-emerald-600 hover:bg-emerald-700 border-0"
                        >
                          <DashboardOutlined className="mr-1" /> Dashboard
                        </Button>
                      </Link>
                    )}
                  </>
                )}
              </motion.div>
            </div>

            {/* Mobile Menu */}
            {isMobile && mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className={`mt-4 pt-4 border-t ${
                  isDark ? "border-slate-800" : "border-gray-100"
                }`}
              >
                <div className="flex flex-col gap-4">
                  {["Features", "How It Works", "Portal Features"].map(
                    (item) => (
                      <a
                        key={item}
                        href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`text-sm font-medium ${
                          isDark ? "text-slate-300" : "text-gray-600"
                        }`}
                      >
                        {item}
                      </a>
                    )
                  )}
                  {!isAuthenticated && (
                    <div className="flex flex-col gap-2 pt-4 border-t border-gray-200">
                      <Button
                        block
                        type="primary"
                        onClick={() => navigate("/login")}
                        className="bg-indigo-600"
                      >
                        <LoginOutlined className="mr-1" /> Login to Portal
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </header>

          {/* Hero Section */}
          <section
            className={`py-20 lg:py-18 px-6 lg:px-12 relative overflow-hidden ${
              isDark ? "bg-transparent" : "bg-transparent"
            }`}
          >
            <div className="max-w-7xl mx-auto">
              <div className="text-center max-w-5xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                >
                  <span
                    className={`inline-block px-4 py-2 rounded-full text-sm font-medium mb-4 ${
                      isDark
                        ? "bg-indigo-500/20 text-indigo-400"
                        : "bg-indigo-100 text-indigo-700"
                    }`}
                  >
                    Revolutionary Semester long Industrial Internship Program
                  </span>

                  <h1
                    className={`text-4xl md:text-4xl lg:text-6xl font-bold leading-tight lg:mb-4 mb-2 ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Transforming Technical Education{" "}
                    <span className="relative inline-block">
                      <span className="text-indigo-600">Through Real</span>
                    </span>{" "}
                    <span className="text-indigo-600">Industry Experience</span>
                  </h1>

                  <p
                    className={`lg:text-lg text-md leading-relaxed mb-6 max-w-4xl mx-auto ${
                      isDark ? "text-slate-400" : "text-gray-600"
                    }`}
                  >
                    A paradigm shift from traditional 4-6 week training to
                    comprehensive semester long internship for professional experiences, positioning
                    Punjab as a leader in industry-aligned skill development.
                  </p>

                  <div className="flex flex-wrap gap-4 justify-center">
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        size="large"
                        type="primary"
                        onClick={() =>
                          window.open(
                            "http://www.punjabteched.net/news/Circular-and-guidelines-of-industrial-training_July25.pdf",
                            "_blank"
                          )
                        }
                        className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 border-0 font-medium"
                      >
                        📋 View Guidelines
                      </Button>
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        size="large"
                        onClick={() => navigate("/login")}
                        className={`h-12 px-8 font-medium ${
                          isDark
                            ? "border-slate-600 text-slate-300"
                            : "border-gray-300 text-gray-700"
                        }`}
                      >
                        Get Started <RightOutlined className="ml-2" />
                      </Button>
                    </motion.div>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Decorative blurred gradient elements */}
            <div className="absolute top-20 right-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-10 left-10 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl" />
            <div className="absolute top-1/3 left-20 w-64 h-64 bg-blue-500/8 rounded-full blur-3xl" />

            {/* Floating Blurred Square Decorations - Distributed on both sides */}
            {/* Left side squares */}
            <motion.div
              className="absolute top-32 left-16 w-12 h-12 rounded-xl blur-sm"
              style={{
                backgroundColor: isDark
                  ? "rgba(129, 140, 248, 0.15)"
                  : "rgba(99, 102, 241, 0.12)",
              }}
              animate={{
                y: [0, -15, 0],
                x: [0, 8, 0],
                rotate: [0, 10, 0],
                opacity: [0.15, 0.25, 0.15],
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />

            <motion.div
              className="absolute top-48 left-32 w-8 h-8 rounded-lg blur-[2px]"
              style={{
                backgroundColor: isDark
                  ? "rgba(167, 139, 250, 0.2)"
                  : "rgba(139, 92, 246, 0.15)",
              }}
              animate={{
                y: [0, 12, 0],
                x: [0, -6, 0],
                rotate: [15, -5, 15],
                opacity: [0.2, 0.35, 0.2],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5,
              }}
            />

            <motion.div
              className="absolute bottom-40 left-24 w-10 h-10 rounded-xl blur-sm"
              style={{
                backgroundColor: isDark
                  ? "rgba(99, 102, 241, 0.18)"
                  : "rgba(79, 70, 229, 0.12)",
              }}
              animate={{
                y: [0, -10, 0],
                x: [0, 5, 0],
                scale: [1, 1.1, 1],
                opacity: [0.18, 0.28, 0.18],
              }}
              transition={{
                duration: 7,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1,
              }}
            />

            <motion.div
              className="absolute top-64 left-48 w-6 h-6 rounded-md blur-[1px]"
              style={{
                backgroundColor: isDark
                  ? "rgba(129, 140, 248, 0.22)"
                  : "rgba(99, 102, 241, 0.18)",
              }}
              animate={{
                y: [0, 8, 0],
                rotate: [0, -15, 0],
                opacity: [0.22, 0.32, 0.22],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1.5,
              }}
            />

            {/* Right side squares */}
            <motion.div
              className="absolute top-28 right-20 w-14 h-14 rounded-xl blur-sm"
              style={{
                backgroundColor: isDark
                  ? "rgba(167, 139, 250, 0.15)"
                  : "rgba(139, 92, 246, 0.1)",
              }}
              animate={{
                y: [0, 12, 0],
                x: [0, -10, 0],
                rotate: [0, -8, 0],
                opacity: [0.15, 0.22, 0.15],
              }}
              transition={{
                duration: 9,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.3,
              }}
            />

            <motion.div
              className="absolute top-52 right-36 w-8 h-8 rounded-lg blur-[2px]"
              style={{
                backgroundColor: isDark
                  ? "rgba(99, 102, 241, 0.2)"
                  : "rgba(79, 70, 229, 0.15)",
              }}
              animate={{
                y: [0, -14, 0],
                x: [0, 8, 0],
                rotate: [-10, 10, -10],
                opacity: [0.2, 0.3, 0.2],
              }}
              transition={{
                duration: 7,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.8,
              }}
            />

            <motion.div
              className="absolute bottom-36 right-28 w-10 h-10 rounded-xl blur-sm"
              style={{
                backgroundColor: isDark
                  ? "rgba(129, 140, 248, 0.18)"
                  : "rgba(99, 102, 241, 0.14)",
              }}
              animate={{
                y: [0, 10, 0],
                x: [0, -6, 0],
                scale: [1, 1.15, 1],
                opacity: [0.18, 0.26, 0.18],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1.2,
              }}
            />

            <motion.div
              className="absolute top-72 right-52 w-6 h-6 rounded-md blur-[1px]"
              style={{
                backgroundColor: isDark
                  ? "rgba(167, 139, 250, 0.25)"
                  : "rgba(139, 92, 246, 0.18)",
              }}
              animate={{
                y: [0, -8, 0],
                rotate: [10, -10, 10],
                opacity: [0.25, 0.35, 0.25],
              }}
              transition={{
                duration: 5.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 2,
              }}
            />

            {/* Center area floating squares (further from center) */}
            <motion.div
              className="absolute top-40 left-1/4 w-7 h-7 rounded-lg blur-[2px]"
              style={{
                backgroundColor: isDark
                  ? "rgba(99, 102, 241, 0.12)"
                  : "rgba(79, 70, 229, 0.1)",
              }}
              animate={{
                y: [0, -12, 0],
                x: [0, 6, 0],
                opacity: [0.12, 0.2, 0.12],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.6,
              }}
            />

            <motion.div
              className="absolute bottom-32 right-1/4 w-9 h-9 rounded-xl blur-sm"
              style={{
                backgroundColor: isDark
                  ? "rgba(129, 140, 248, 0.14)"
                  : "rgba(99, 102, 241, 0.12)",
              }}
              animate={{
                y: [0, 10, 0],
                x: [0, -8, 0],
                rotate: [5, -5, 5],
                opacity: [0.14, 0.22, 0.14],
              }}
              transition={{
                duration: 7.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1.8,
              }}
            />
          </section>

          {/* Stats Section */}
          <section
            className={`py-16 px-6 lg:px-12 relative ${
              isDark
                ? "bg-slate-800/30 backdrop-blur-sm"
                : "bg-white/60 backdrop-blur-sm"
            }`}
          >
            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {stats.map((stat, index) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="text-center"
                  >
                    <div
                      className={`text-4xl md:text-5xl font-bold mb-2 ${
                        isDark ? "text-white" : "text-gray-900"
                      }`}
                    >
                      <AnimatedCounter end={stat.number} suffix={stat.suffix} />
                    </div>
                    <div
                      className={`text-sm font-medium ${
                        isDark ? "text-slate-400" : "text-gray-600"
                      }`}
                    >
                      {stat.label}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section
            id="features"
            className={`py-20 lg:py-24 px-6 lg:px-12 relative ${
              isDark ? "bg-transparent" : "bg-transparent"
            }`}
          >
            <div className="max-w-7xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center mb-16"
              >
                <h2
                  className={`text-3xl md:text-4xl font-bold mb-4 ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  What Makes It{" "}
                  <span className="relative inline-block">
                    <span className="text-indigo-600">Work</span>
                    <ScribbleUnderline
                      color={isDark ? "#818cf8" : "#6366f1"}
                      width={100}
                    />
                  </span>
                </h2>
                <p
                  className={`text-lg max-w-2xl mx-auto ${
                    isDark ? "text-slate-400" : "text-gray-600"
                  }`}
                >
                  A comprehensive digital platform designed to streamline every
                  aspect of industrial training
                </p>
              </motion.div>

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {features.map((feature, index) => (
                  <FeatureCard
                    key={feature.title}
                    {...feature}
                    isDark={isDark}
                    delay={index * 0.1}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* How It Works Section */}
          <section
            id="how-it-works"
            className={`py-20 lg:py-24 px-6 lg:px-12 relative overflow-hidden ${
              isDark
                ? "bg-slate-800/20 backdrop-blur-sm"
                : "bg-indigo-50/50 backdrop-blur-sm"
            }`}
          >
            {/* Cross/Plus Pattern Background */}
            <div
              className={`absolute inset-0 ${
                isDark ? "opacity-[0.03]" : "opacity-[0.08]"
              }`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='${
                  isDark ? "%23ffffff" : "%236366f1"
                }' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            />
            <div className="max-w-7xl mx-auto relative z-10">
              <div className="grid lg:grid-cols-2 gap-16 items-start">
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                >
                  <h2
                    className={`text-3xl md:text-4xl font-bold mb-4 ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Your Training{" "}
                    <span className="relative inline-block">
                      <span className="text-indigo-600">Journey</span>
                      <ScribbleUnderline
                        color={isDark ? "#818cf8" : "#6366f1"}
                        width={130}
                      />
                    </span>
                  </h2>
                  <p
                    className={`text-lg mb-10 ${
                      isDark ? "text-slate-400" : "text-gray-600"
                    }`}
                  >
                    A structured program that takes you from classroom
                    to industry floor, ensuring you gain practical skills and
                    professional experience.
                  </p>

                  <div className="space-y-8">
                    {journeySteps.map((step, index) => (
                      <ProcessStep
                        key={step.title}
                        number={index + 1}
                        {...step}
                        isDark={isDark}
                        delay={index * 0.1}
                      />
                    ))}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className={`p-8 rounded-3xl ${
                    isDark ? "bg-slate-800" : "bg-white shadow-xl"
                  }`}
                >
                  <h3
                    className={`text-2xl font-bold mb-6 ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Key Highlights
                  </h3>

                  <div className="space-y-4">
                    {[
                      "Minimum 80% attendance required",
                      "Monthly progress reports mandatory",
                      "Regular faculty visits for guidance",
                      "Industry mentor assigned to each student",
                      "Final viva and report submission",
                      "Certificate upon successful completion",
                    ].map((item, index) => (
                      <motion.div
                        key={item}
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center gap-3"
                      >
                        <CheckCircleOutlined className="text-emerald-500 text-lg" />
                        <span
                          className={
                            isDark ? "text-slate-300" : "text-gray-700"
                          }
                        >
                          {item}
                        </span>
                      </motion.div>
                    ))}
                  </div>

                  <div
                    className={`mt-8 p-6 rounded-2xl ${
                      isDark ? "bg-slate-700/50" : "bg-indigo-50"
                    }`}
                  >
                
                 
                    <div
                      className={`text-sm mt-1 ${
                        isDark ? "text-slate-400" : "text-gray-600"
                      }`}
                    >
                      Full-time industry exposure
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </section>

          {/* Portal Features Section */}
          <section
            id="portal-features"
            className={`py-20 lg:pt-20 lg:pb-5 px-6 lg:px-12 relative overflow-hidden ${
              isDark
                ? "bg-slate-800/20 backdrop-blur-sm"
                : "bg-white/60 backdrop-blur-sm"
            }`}
          >
            {/* Cross/Plus Pattern Background */}
            <div
              className={`absolute inset-0 ${
                isDark ? "opacity-[0.03]" : "opacity-[0.1]"
              }`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='${
                  isDark ? "%23818cf8" : "%236366f1"
                }' fill-opacity='0.4' fill-rule='evenodd'%3E%3Cpath d='M0 20h40v1H0zM20 0v40h1V0z'/%3E%3C/g%3E%3C/svg%3E")`,
              }}
            />
            {/* Decorative Plus Icons */}
            <div
              className={`absolute top-20 left-10 text-6xl ${
                isDark ? "text-indigo-500/10" : "text-indigo-300/20"
              }`}
            >
              +
            </div>
            <div
              className={`absolute top-40 right-20 text-4xl ${
                isDark ? "text-indigo-500/10" : "text-indigo-300/20"
              }`}
            >
              +
            </div>
            <div
              className={`absolute bottom-32 left-1/4 text-5xl ${
                isDark ? "text-indigo-500/10" : "text-indigo-300/20"
              }`}
            >
              +
            </div>
            <div
              className={`absolute bottom-20 right-10 text-7xl ${
                isDark ? "text-indigo-500/10" : "text-indigo-300/20"
              }`}
            >
              +
            </div>
            <div className="max-w-7xl mx-auto relative z-10">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center mb-16"
              >
                <h2
                  className={`text-3xl md:text-4xl font-bold mb-4 ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  Role-Based{" "}
                  <span className="relative inline-block">
                    <span className="text-indigo-600">Access</span>
                    <ScribbleUnderline
                      color={isDark ? "#818cf8" : "#6366f1"}
                      width={100}
                    />
                  </span>
                </h2>
                <p
                  className={`text-lg max-w-2xl mx-auto ${
                    isDark ? "text-slate-400" : "text-gray-600"
                  }`}
                >
                  Tailored dashboards and features for every stakeholder in the
                  industrial training ecosystem
                </p>
              </motion.div>

              {/* Role Cards - 4 Column Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
                {/* Student Card */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                  whileHover={{ y: -8 }}
                  className={`p-6 rounded-2xl border transition-all duration-300 ${
                    isDark
                      ? "bg-slate-800/50 border-slate-700 hover:border-blue-500/50"
                      : "bg-white border-gray-100 shadow-lg hover:shadow-xl hover:border-blue-200"
                  }`}
                >
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${
                      isDark ? "bg-blue-500/20" : "bg-blue-50"
                    }`}
                  >
                    <UserOutlined
                      className={`text-2xl ${
                        isDark ? "text-blue-400" : "text-blue-600"
                      }`}
                    />
                  </div>
                  <h4
                    className={`text-lg font-bold mb-2 ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Student
                  </h4>
                  <p
                    className={`text-sm leading-relaxed ${
                      isDark ? "text-slate-400" : "text-gray-500"
                    }`}
                  >
                    Responsible for profile management, application tracking,
                    daily reporting, and feedback submission throughout the
                    training period.
                  </p>
                  <div className="mt-4 pt-4 border-t border-dashed border-gray-200 dark:border-slate-700">
                    <div className="flex flex-wrap gap-2">
                      {["Profile", "Reports", "Attendance", "Feedback"].map(
                        (tag) => (
                          <span
                            key={tag}
                            className={`text-xs px-2 py-1 rounded-full ${
                              isDark
                                ? "bg-blue-500/10 text-blue-400"
                                : "bg-blue-50 text-blue-600"
                            }`}
                          >
                            {tag}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Faculty Card */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  whileHover={{ y: -8 }}
                  className={`p-6 rounded-2xl border transition-all duration-300 ${
                    isDark
                      ? "bg-slate-800/50 border-slate-700 hover:border-teal-500/50"
                      : "bg-white border-gray-100 shadow-lg hover:shadow-xl hover:border-teal-200"
                  }`}
                >
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${
                      isDark ? "bg-teal-500/20" : "bg-teal-50"
                    }`}
                  >
                    <SolutionOutlined
                      className={`text-2xl ${
                        isDark ? "text-teal-400" : "text-teal-600"
                      }`}
                    />
                  </div>
                  <h4
                    className={`text-lg font-bold mb-2 ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Faculty Supervisor
                  </h4>
                  <p
                    className={`text-sm leading-relaxed ${
                      isDark ? "text-slate-400" : "text-gray-500"
                    }`}
                  >
                    Provides mentorship, conducts site visits, verifies reports,
                    and handles first-level grievances for assigned students.
                  </p>
                  <div className="mt-4 pt-4 border-t border-dashed border-gray-200 dark:border-slate-700">
                    <div className="flex flex-wrap gap-2">
                      {[
                        "Mentorship",
                        "Visits",
                        "Verification",
                        "Grievances",
                      ].map((tag) => (
                        <span
                          key={tag}
                          className={`text-xs px-2 py-1 rounded-full ${
                            isDark
                              ? "bg-teal-500/10 text-teal-400"
                              : "bg-teal-50 text-teal-600"
                          }`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.div>

                {/* Principal Card */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                  whileHover={{ y: -8 }}
                  className={`p-6 rounded-2xl border transition-all duration-300 ${
                    isDark
                      ? "bg-slate-800/50 border-slate-700 hover:border-indigo-500/50"
                      : "bg-white border-gray-100 shadow-lg hover:shadow-xl hover:border-indigo-200"
                  }`}
                >
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${
                      isDark ? "bg-indigo-500/20" : "bg-indigo-50"
                    }`}
                  >
                    <FlagOutlined
                      className={`text-2xl ${
                        isDark ? "text-indigo-400" : "text-indigo-600"
                      }`}
                    />
                  </div>
                  <h4
                    className={`text-lg font-bold mb-2 ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Principal
                  </h4>
                  <p
                    className={`text-sm leading-relaxed ${
                      isDark ? "text-slate-400" : "text-gray-500"
                    }`}
                  >
                    Oversees institute strategy, allocates faculty mentors,
                    monitors placement metrics, and manages critical issues.
                  </p>
                  <div className="mt-4 pt-4 border-t border-dashed border-gray-200 dark:border-slate-700">
                    <div className="flex flex-wrap gap-2">
                      {[
                        "Strategy",
                        "Allocation",
                        "Analytics",
                        "Management",
                      ].map((tag) => (
                        <span
                          key={tag}
                          className={`text-xs px-2 py-1 rounded-full ${
                            isDark
                              ? "bg-indigo-500/10 text-indigo-400"
                              : "bg-indigo-50 text-indigo-600"
                          }`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.div>

                {/* State Directorate Card */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 }}
                  whileHover={{ y: -8 }}
                  className={`p-6 rounded-2xl border transition-all duration-300 ${
                    isDark
                      ? "bg-slate-800/50 border-slate-700 hover:border-orange-500/50"
                      : "bg-white border-gray-100 shadow-lg hover:shadow-xl hover:border-orange-200"
                  }`}
                >
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${
                      isDark ? "bg-orange-500/20" : "bg-orange-50"
                    }`}
                  >
                    <BankOutlined
                      className={`text-2xl ${
                        isDark ? "text-orange-400" : "text-orange-600"
                      }`}
                    />
                  </div>
                  <h4
                    className={`text-lg font-bold mb-2 ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    State Directorate
                  </h4>
                  <p
                    className={`text-sm leading-relaxed ${
                      isDark ? "text-slate-400" : "text-gray-500"
                    }`}
                  >
                    Sets policy guidelines, monitors compliance, audits
                    institutions, and analyzes statewide training data.
                  </p>
                  <div className="mt-4 pt-4 border-t border-dashed border-gray-200 dark:border-slate-700">
                    <div className="flex flex-wrap gap-2">
                      {["Policy", "Compliance", "Audit", "Analytics"].map(
                        (tag) => (
                          <span
                            key={tag}
                            className={`text-xs px-2 py-1 rounded-full ${
                              isDark
                                ? "bg-orange-500/10 text-orange-400"
                                : "bg-orange-50 text-orange-600"
                            }`}
                          >
                            {tag}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </section>

          {/* Grading & Assessment Structure Section */}
          <section
            id="grading"
            className={`py-20 lg:pt-10   px-6 lg:px-12 relative overflow-hidden ${
              isDark ? "bg-transparent" : "bg-transparent"
            }`}
          >
            <div className="max-w-7xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center mb-12"
              >
                <h2
                  className={`text-3xl md:text-4xl font-bold mb-4 ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  Grading &{" "}
                  <span className="relative inline-block">
                    <span className="text-indigo-600">Assessment</span>
                    <ScribbleUnderline
                      color={isDark ? "#818cf8" : "#6366f1"}
                      width={180}
                    />
                  </span>{" "}
                  Structure
                </h2>
                <p
                  className={`text-lg max-w-2xl mx-auto ${
                    isDark ? "text-slate-400" : "text-gray-600"
                  }`}
                >
                  Total Marks: 500 | Passing Criteria: Minimum 40% in both
                  components separately
                </p>
              </motion.div>

              <div className="grid lg:grid-cols-2 gap-8">
                {/* Industry Assessment Card */}
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className={`rounded-2xl overflow-hidden border ${
                    isDark
                      ? "bg-slate-800/50 border-slate-700"
                      : "bg-white border-gray-200 shadow-lg"
                  }`}
                >
                  {/* Header */}
                  <div className="bg-gray-900 text-white p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                        <BankOutlined className="text-xl" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">
                          Industry Assessment
                        </h3>
                        <p className="text-sm text-gray-300">
                          Evaluated by Organization Supervisor
                        </p>
                      </div>
                    </div>
                    <div className="text-3xl font-bold mt-4">200 Marks</div>
                  </div>
                  {/* Content */}
                  <div className="p-6 space-y-4">
                    {[
                      {
                        title: "Task Quality",
                        desc: "Completion of assigned tasks, accuracy, and neatness",
                        marks: 100,
                      },
                      {
                        title: "Responsiveness",
                        desc: "Following instructions and acting on feedback",
                        marks: 20,
                      },
                      {
                        title: "Teamwork",
                        desc: "Cooperation, workplace discipline, professional behavior",
                        marks: 20,
                      },
                      {
                        title: "Punctuality",
                        desc: "Regular attendance and reporting to duty on time",
                        marks: 20,
                      },
                      {
                        title: "Initiative",
                        desc: "Proactive problem-solving and self-learning",
                        marks: 20,
                      },
                      {
                        title: "Adaptability",
                        desc: "Willingness to learn new tools and processes",
                        marks: 20,
                      },
                    ].map((item, index) => (
                      <div
                        key={index}
                        className={`flex items-start justify-between py-3 ${
                          index !== 5
                            ? isDark
                              ? "border-b border-slate-700"
                              : "border-b border-gray-100"
                            : ""
                        }`}
                      >
                        <div className="flex-1">
                          <h4
                            className={`font-semibold ${
                              isDark ? "text-white" : "text-gray-900"
                            }`}
                          >
                            {item.title}
                          </h4>
                          <p
                            className={`text-sm ${
                              isDark ? "text-slate-400" : "text-gray-500"
                            }`}
                          >
                            {item.desc}
                          </p>
                        </div>
                        <div
                          className={`ml-4 px-3 py-1 rounded-full text-sm font-semibold ${
                            isDark
                              ? "bg-slate-700 text-white"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {item.marks}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Institute Assessment Card */}
                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className={`rounded-2xl overflow-hidden border ${
                    isDark
                      ? "bg-slate-800/50 border-slate-700"
                      : "bg-white border-gray-200 shadow-lg"
                  }`}
                >
                  {/* Header */}
                  <div className="bg-indigo-600 text-white p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                        <SolutionOutlined className="text-xl" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">
                          Institute Assessment
                        </h3>
                        <p className="text-sm text-indigo-200">
                          Evaluated by Faculty Mentor & Committee
                        </p>
                      </div>
                    </div>
                    <div className="text-3xl font-bold mt-4">300 Marks</div>
                  </div>
                  {/* Content */}
                  <div className="p-6 space-y-4">
                    {[
                      {
                        title: "Monthly Progress Reports",
                        desc: "Timely submission of reports, meaningful interaction with mentor, and quality of logbooks",
                        marks: 120,
                      },
                      {
                        title: "Viva Voce Examination",
                        desc: "Final presentation, understanding of industrial processes, and ability to explain work done",
                        marks: 180,
                      },
                    ].map((item, index) => (
                      <div
                        key={index}
                        className={`flex items-start justify-between py-3 ${
                          index !== 1
                            ? isDark
                              ? "border-b border-slate-700"
                              : "border-b border-gray-100"
                            : ""
                        }`}
                      >
                        <div className="flex-1">
                          <h4
                            className={`font-semibold ${
                              isDark ? "text-white" : "text-gray-900"
                            }`}
                          >
                            {item.title}
                          </h4>
                          <p
                            className={`text-sm ${
                              isDark ? "text-slate-400" : "text-gray-500"
                            }`}
                          >
                            {item.desc}
                          </p>
                        </div>
                        <div
                          className={`ml-4 px-3 py-1 rounded-full text-sm font-semibold ${
                            isDark
                              ? "bg-indigo-500/20 text-indigo-400"
                              : "bg-indigo-50 text-indigo-600"
                          }`}
                        >
                          {item.marks}
                        </div>
                      </div>
                    ))}

                    {/* Note */}
                    <div
                      className={`mt-6 p-4 rounded-xl ${
                        isDark ? "bg-slate-700/50" : "bg-gray-50"
                      }`}
                    >
                      <p
                        className={`text-sm ${
                          isDark ? "text-slate-300" : "text-gray-600"
                        }`}
                      >
                        <span className="font-semibold">Note:</span> Minimum 40%
                        marks required separately in both external (Industry)
                        and internal (Institute) evaluation to pass.
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </section>

          {/* See the Platform Section */}
          {/* <section
            id="platform-preview"
            className={`py-18  px-6 lg:px-12 relative overflow-hidden ${
              isDark
                ? "bg-slate-800/30 backdrop-blur-sm"
                : "bg-gradient-to-b from-indigo-50/50 to-white/60 backdrop-blur-sm"
            }`}
          >

            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div
                className={`absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl ${
                  isDark ? "bg-indigo-500/5" : "bg-indigo-300/20"
                }`}
              />
              <div
                className={`absolute bottom-0 right-1/4 w-80 h-80 rounded-full blur-3xl ${
                  isDark ? "bg-purple-500/5" : "bg-purple-300/15"
                }`}
              />
            </div>

            <div className="max-w-7xl mx-auto relative z-10">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center mb-16"
              >
                <h2
                  className={`text-3xl md:text-4xl font-bold mb-4 ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  See the{" "}
                  <span className="relative inline-block">
                    <span className="text-indigo-600">Platform</span>
                    <ScribbleUnderline
                      color={isDark ? "#818cf8" : "#6366f1"}
                      width={140}
                    />
                  </span>{" "}
                  in Action
                </h2>
                <p
                  className={`text-lg max-w-2xl mx-auto ${
                    isDark ? "text-slate-400" : "text-gray-600"
                  }`}
                >
                  Intuitive dashboards designed for every stakeholder with
                  real-time insights and seamless navigation
                </p>
              </motion.div>


              {(() => {
                const [activeSlide, setActiveSlide] = React.useState(0);
                const slides = [
                  {
                    image: isDark ? "/principal dark.webp" : "/principal.webp",
                  },
                  {
                    image: isDark
                      ? "/student progress dark.webp"
                      : "/student progress.webp",
                  },
                  { image: isDark ? "/faculty dark.webp" : "/faculty.webp" },
                  { image: isDark ? "/student dark.webp" : "/student.webp" },
                ];

                return (
                  <div className="relative">
               
                    <div className="relative max-w-5xl mx-auto">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        className="relative"
                      >
                     
                        <div
                          className={`relative rounded-3xl overflow-hidden shadow-2xl ${
                            isDark
                              ? "bg-slate-800 ring-1 ring-slate-700"
                              : "bg-white ring-1 ring-gray-200"
                          }`}
                        >
                      
                          <div
                            className={`flex items-center px-6 py-4 border-b ${
                              isDark
                                ? "bg-slate-900/80 border-slate-700"
                                : "bg-gray-50/80 border-gray-200"
                            }`}
                          >
                            <div className="flex gap-2">
                              <div className="w-3 h-3 rounded-full bg-red-400" />
                              <div className="w-3 h-3 rounded-full bg-yellow-400" />
                              <div className="w-3 h-3 rounded-full bg-green-400" />
                            </div>
                          </div>

                       
                          <div className="relative overflow-hidden">
                            {slides.map((slide, index) => (
                              <motion.div
                                key={index}
                                initial={false}
                                animate={{
                                  opacity: activeSlide === index ? 1 : 0,
                                  x:
                                    activeSlide === index
                                      ? 0
                                      : activeSlide > index
                                      ? -20
                                      : 20,
                                }}
                                transition={{
                                  duration: 0.5,
                                  ease: "easeInOut",
                                }}
                                className={`${
                                  activeSlide === index
                                    ? "relative"
                                    : "absolute inset-0"
                                }`}
                              >
                                <img
                                  src={slide.image}
                                  alt="Platform Screenshot"
                                  className="w-full h-auto"
                                />
                              </motion.div>
                            ))}
                          </div>
                        </div>

                       
                        <button
                          onClick={() =>
                            setActiveSlide((prev) =>
                              prev === 0 ? slides.length - 1 : prev - 1
                            )
                          }
                          className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 lg:-translate-x-12 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 ${
                            isDark
                              ? "bg-slate-800 text-white hover:bg-indigo-600"
                              : "bg-white text-gray-900 shadow-lg hover:bg-indigo-600 hover:text-white"
                          }`}
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 19l-7-7 7-7"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() =>
                            setActiveSlide((prev) =>
                              prev === slides.length - 1 ? 0 : prev + 1
                            )
                          }
                          className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 lg:translate-x-12 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 ${
                            isDark
                              ? "bg-slate-800 text-white hover:bg-indigo-600"
                              : "bg-white text-gray-900 shadow-lg hover:bg-indigo-600 hover:text-white"
                          }`}
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </button>
                      </motion.div>

                      <div className="flex justify-center gap-2 mt-8">
                        {slides.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => setActiveSlide(index)}
                            className={`w-3 h-3 rounded-full transition-all duration-300 ${
                              activeSlide === index
                                ? "bg-indigo-600 w-8"
                                : isDark
                                ? "bg-slate-600 hover:bg-slate-500"
                                : "bg-gray-300 hover:bg-gray-400"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

     
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6"
              >
                {[
                  { icon: "mobile", label: "Responsive Design" },
                  { icon: "moon", label: "Dark Mode Support" },
                  { icon: "chart", label: "Real-time Analytics" },
                  { icon: "lock", label: "Secure & Private" },
                ].map((item, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-3 p-4 rounded-xl ${
                      isDark ? "bg-slate-800/50" : "bg-white/80 shadow-sm"
                    }`}
                  >
                    <div
                      className={`text-xl ${
                        isDark ? "text-indigo-400" : "text-indigo-600"
                      }`}
                    >
                      {item.icon === "mobile" && <MobileOutlined />}
                      {item.icon === "moon" && <MoonOutlined />}
                      {item.icon === "chart" && <LineChartOutlined />}
                      {item.icon === "lock" && <LockOutlined />}
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        isDark ? "text-slate-300" : "text-gray-700"
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                ))}
              </motion.div>
            </div>
          </section> */}

          {/* FAQ Section */}
          <section
            id="faq"
            className={`py-20 px-6 lg:px-12 relative ${
              isDark ? "bg-slate-900/50" : "bg-white"
            }`}
          >
            <div className="max-w-4xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="text-center mb-8"
              >
                {/* <div
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 ${
                    isDark
                      ? "bg-indigo-500/20 text-indigo-300"
                      : "bg-indigo-50 text-indigo-600"
                  }`}
                >
                  <QuestionCircleOutlined />
                  <span className="text-sm font-medium">Got Questions?</span>
                </div> */}
                <h2
                  className={`text-4xl lg:text-5xl font-bold mb-4 ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  Frequently Asked{" "}
                  <span className="relative inline-block">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                      Questions
                    </span>
                    <ScribbleUnderline color="#6366f1" width={180} />
                  </span>
                </h2>
                <p
                  className={`text-lg max-w-2xl mx-auto ${
                    isDark ? "text-slate-400" : "text-gray-600"
                  }`}
                >
                  Find answers to common questions about the Industrial Training Management Portal.
                </p>
              </motion.div>

              {/* FAQ Accordion */}
              <div className="space-y-4">
                {[
                  {
                    question: "Who can use the PlaceIntern portal?",
                    answer: "The portal is designed for students enrolled in polytechnic institutions under Punjab State Board of Technical Education & Industrial Training (PSBTE). Faculty members, principals, and state directorate officials also have role-based access to manage and monitor the internship program."
                  },
                  {
                    question: "How do I register for an internship on this portal?",
                    answer: "Students can register through their institution. Once your profile is created by the institute, you can log in with your credentials, complete your profile with details, and then submit your internship details."
                  },
                  {
                    question: "What documents are required for internship registration?",
                    answer: "You'll need to upload your joining letter from the industry. These can be uploaded directly through the portal in the self identified form or dashboard."
                  },
                  {
                    question: "How do I submit my monthly progress reports?",
                    answer: "Navigate to the 'Monthly Reports' section in your dashboard or 'My Application' have monthly reports tab there you also can upload the monthly reports. You can submit reports detailing your learning outcomes, projects worked on, skills acquired, and attendance. Reports must be submitted before the deadline each month and will be reviewed by your assigned faculty mentor."
                  }
                ].map((faq, index) => (
                  <FAQItem
                    key={index}
                    question={faq.question}
                    answer={faq.answer}
                    isDark={isDark}
                    delay={index * 0.1}
                  />
                ))}
              </div>

              {/* Contact CTA */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className={`mt-12 text-center p-8 rounded-2xl ${
                  isDark
                    ? "bg-gradient-to-br from-indigo-900/30 to-purple-900/30 border border-indigo-500/20"
                    : "bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100"
                }`}
              >
                <p
                  className={`text-lg mb-4 ${
                    isDark ? "text-slate-300" : "text-gray-700"
                  }`}
                >
                  Still have questions? We're here to help!
                </p>
                <a
                  href="mailto:dtepunjab.internship@gmail.com"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
                >
                  <MailOutlined />
                  Contact Support
                </a>
              </motion.div>
            </div>
          </section>

          {/* Footer */}
          <footer
            className={`py-8 px-6 lg:px-12 ${
              isDark ? "bg-slate-950" : "bg-gray-900"
            }`}
          >
            <div className="max-w-7xl mx-auto">
              <div className="grid md:grid-cols-5 gap-12 mb-12">
                <div className="md:col-span-2">
                  <div className="flex items-center gap-3">
                    <img
                      src="/dte.webp"
                      alt="Punjab Government"
                      className="h-15 w-15 rounded-full object-contain "
                    />
                    <div className="text-2xl font-bold text-white ">
                      <span className="font-light">Place</span>
                      <span className="text-indigo-400">Intern</span>
                    </div>
                  </div>
                  <p className="text-slate-400 mb-6 mt-1 max-w-md">
                    Industrial Training Management Portal for Punjab State Board
                    of Technical Education & Industrial Training.
                  </p>
                  <div className="">
                    <img
                      src="/Vibha-MainLogo.webp"
                      alt="Vibha"
                      className="h-15 w-25 object-contain "
                    />
                    <p className="text-slate-500 text-sm mb-4">
                      Supported by{" "}
                      <span className="text-indigo-400 font-medium">Vibha</span>,
                      Developed by{" "}
                      <span className="text-indigo-400 font-medium">
                        GPC Talwara
                      </span>
                    </p>
                  </div>

                  {/* <div className="flex gap-4">
                    {["facebook", "twitter", "linkedin"].map((social) => (
                      <a
                        key={social}
                        href="#"
                        className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-indigo-600 transition-colors"
                      >
                        <span className="text-sm capitalize">
                          {social[0].toUpperCase()}
                        </span>
                      </a>
                    ))}
                  </div> */}
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-4">Quick Links</h4>
                  <ul className="space-y-3">
                    {["Features", "How It Works", "Portal Features"].map(
                      (link) => (
                        <li key={link}>
                          <a
                            href={`#${link.toLowerCase().replace(/\s+/g, "-")}`}
                            className="text-slate-400 hover:text-white transition-colors"
                          >
                            {link}
                          </a>
                        </li>
                      )
                    )}
                  </ul>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-4">Board Links</h4>
                  <ul className="space-y-3">
                    <li>
                      <a
                        href="http://www.punjabteched.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-white transition-colors flex items-center gap-2"
                      >
                        <LinkOutlined /> PSBTE Main Site
                      </a>
                    </li>
                    <li>
                      <a
                        href="http://www.punjabteched.net/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-white transition-colors flex items-center gap-2"
                      >
                        <LinkOutlined /> PSBTE Portal
                      </a>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-4">Contact</h4>
                  <ul className="space-y-3 text-slate-400">
                    <li className="flex items-center gap-2">
                      <EnvironmentOutlined />
                      <span>Punjab, India</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <MailOutlined />
                      <span>dtepunjab.internship@gmail.com</span>
                    </li>
                    {/* <li className="flex items-center gap-2">
                      <PhoneOutlined />
                      <span>+91 1234567890</span>
                    </li> */}
                  </ul>
                </div>
              </div>

              <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
                <p className="text-slate-500 text-sm">
                  © {new Date().getFullYear()} PlaceIntern. Supported
                  by Vibha.
                </p>
                {/* <div className="flex items-center gap-4">
                  <img
                    src="/dte.webp"
                    alt="Punjab Government"
                    className="h-15 w-15 rounded-full object-contain opacity-80 hover:opacity-100 transition-opacity"
                  />
                  <img
                    src="/logo-psbte.webp"
                    alt="PSBTE Logo"
                    className="h-15 w-15 object-contain opacity-80 hover:opacity-100 transition-opacity"
                  />
                  <img
                    src="/Vibha-MainLogo.webp"
                    alt="Vibha"
                    className="h-15 w-20 object-contain opacity-80 hover:opacity-100 transition-opacity"
                  />
                </div> */}
                <div className="flex gap-6">
                  {["Privacy Policy", "Terms and Conditions"].map((link) => (
                    <a
                      key={link}
                      href={ `/${link.toLowerCase().replace(/\s+/g, "-")}`}
                      className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
                    >
                      {link}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </footer>
        </div>
      </ConfigProvider>
    </div>
  );
};

export default LandingPage;
