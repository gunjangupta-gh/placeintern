import React from "react";
import { Menu, Button, Tooltip } from "antd";
import { FileAddOutlined, HeartFilled } from "@ant-design/icons";
import { Link, useLocation } from "react-router-dom";

// Sidebar colors from theme
const SIDEBAR_COLORS = {
  text: "rgba(255, 255, 255, 0.85)",
  textHover: "#ffffff",
  textMuted: "rgba(255, 255, 255, 0.65)",
  itemHoverBg: "rgba(255, 255, 255, 0.08)",
  itemActiveBg: "rgba(59, 130, 246, 0.2)",
  itemActiveBorder: "#3b82f6",
  buttonBg: "rgba(255, 255, 255, 0.05)",
  buttonBorder: "rgba(255, 255, 255, 0.15)",
};

const SidebarMenu = ({ sections, collapsed, onMobileClose, isMobile }) => {
  const location = useLocation();
  const [openKeys, setOpenKeys] = React.useState([]);

  // Find active keys based on current path
  const findActiveKeys = () => {
    const pathname = location.pathname;
    let activeKeys = [];
    sections.forEach((section) => {
      // Check if current path matches section's direct path
      if (
        section.path &&
        (pathname === section.path || pathname.startsWith(section.path + "/"))
      ) {
        activeKeys = [section.key];
      }
      // Check section items if they exist
      if (section.items) {
        section.items.forEach((item) => {
          if (pathname === item.path || pathname.startsWith(item.path + "/")) {
            activeKeys = [section.key, item.key];
          }
        });
      }
    });
    return activeKeys;
  };

  const activeKeys = findActiveKeys();

  // Set initial open menu based on route
  React.useEffect(() => {
    if (activeKeys[0] && !collapsed) {
      setOpenKeys([activeKeys[0]]);
    }
    // Close all menus when collapsed
    if (collapsed) {
      setOpenKeys([]);
    }
  }, [location.pathname, collapsed]);

  const handleOpenChange = (keys) => {
    if (!collapsed) {
      setOpenKeys(keys);
    }
  };

  const handleLinkClick = () => {
    if (isMobile && onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 relative overflow-hidden">
      {/* Menu Container */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden sidebar-scrollbar py-2"
        style={{
          maxHeight: isMobile ? "calc(100vh - 180px)" : "calc(100vh - 160px)",
        }}
      >
        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={activeKeys}
          openKeys={collapsed ? [] : openKeys}
          onOpenChange={handleOpenChange}
          inlineCollapsed={collapsed}
          style={{
            borderRight: 0,
            background: "transparent",
            padding: collapsed ? "0 4px" : "0 8px",
          }}
          className="sidebar-dark-menu"
          items={sections.map((section) => {
            // Handle sections with direct path AND items (clickable parent with submenu)
            if (section.path && section.items) {
              return {
                key: section.key,
                icon: React.cloneElement(section.icon, {
                  style: {
                    fontSize: collapsed ? "18px" : "16px",
                    color: SIDEBAR_COLORS.text,
                  },
                }),
                label: collapsed ? null : (
                  <Link
                    to={section.path}
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      letterSpacing: "0.2px",
                      color: SIDEBAR_COLORS.text,
                      display: "block",
                    }}
                    onClick={handleLinkClick}
                  >
                    {section.title}
                  </Link>
                ),
                children: section.items?.map((item) => ({
                  key: item.key,
                  icon: React.cloneElement(item.icon, {
                    style: {
                      fontSize: "14px",
                      color: SIDEBAR_COLORS.textMuted,
                    },
                  }),
                  label: (
                    <Link
                      to={item.path}
                      style={{
                        fontSize: "13px",
                        fontWeight: 450,
                        letterSpacing: "0.1px",
                        color: SIDEBAR_COLORS.text,
                        display: "block",
                      }}
                      onClick={handleLinkClick}
                    >
                      {item.label}
                    </Link>
                  ),
                })),
              };
            }
            // Handle sections with direct path only (like PRINCIPAL_HOME)
            if (section.path) {
              return {
                key: section.key,
                icon: React.cloneElement(section.icon, {
                  style: {
                    fontSize: collapsed ? "18px" : "16px",
                    color: SIDEBAR_COLORS.text,
                  },
                }),
                label: collapsed ? null : (
                  <Link
                    to={section.path}
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      letterSpacing: "0.2px",
                      color: SIDEBAR_COLORS.text,
                      display: "block",
                    }}
                    onClick={handleLinkClick}
                  >
                    {section.title}
                  </Link>
                ),
              };
            }

            // Handle sections with items only (submenus)
            return {
              key: section.key,
              icon: React.cloneElement(section.icon, {
                style: {
                  fontSize: collapsed ? "18px" : "16px",
                  color: SIDEBAR_COLORS.text,
                },
              }),
              label: collapsed ? null : (
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    letterSpacing: "0.2px",
                    color: SIDEBAR_COLORS.text,
                  }}
                >
                  {section.title}
                </span>
              ),
              children: section.items?.map((item) => ({
                key: item.key,
                icon: React.cloneElement(item.icon, {
                  style: {
                    fontSize: "14px",
                    color: SIDEBAR_COLORS.textMuted,
                  },
                }),
                label: (
                  <Link
                    to={item.path}
                    style={{
                      fontSize: "13px",
                      fontWeight: 450,
                      letterSpacing: "0.1px",
                      color: SIDEBAR_COLORS.text,
                      display: "block",
                    }}
                    onClick={handleLinkClick}
                  >
                    {item.label}
                  </Link>
                ),
              })),
            };
          })}
        />
      </div>

      {/* Footer Action - Report Issue */}
      <div
        style={{
          padding: collapsed ? "16px 8px" : "16px 12px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(0,0,0,0.1)",
        }}
      >
        {!collapsed ? (
          <Link to="/app/my-tickets" onClick={handleLinkClick}>
            <Button
              type="default"
              block
              icon={<FileAddOutlined />}
              size="small"
              style={{
                height: 36,
                fontSize: 12,
                borderRadius: 8,
                background: SIDEBAR_COLORS.buttonBg,
                borderColor: SIDEBAR_COLORS.buttonBorder,
                color: SIDEBAR_COLORS.text,
              }}
              className="hover:!bg-white/10 hover:!border-white/25 transition-all"
            >
              Support Ticket
            </Button>
          </Link>
        ) : (
          <div className="flex justify-center">
            <Tooltip title="Submit Support Ticket" placement="right">
              <Link to="/app/my-tickets" onClick={handleLinkClick}>
                <Button
                  type="default"
                  shape="circle"
                  size="middle"
                  icon={<FileAddOutlined style={{ fontSize: 14 }} />}
                  style={{
                    background: SIDEBAR_COLORS.buttonBg,
                    borderColor: SIDEBAR_COLORS.buttonBorder,
                    color: SIDEBAR_COLORS.text,
                  }}
                  className="hover:!bg-white/10 hover:!border-white/25 transition-all"
                />
              </Link>
            </Tooltip>
          </div>
        )}

        {/* Built by Section */}
        {/* {!collapsed && (
          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: "1px solid rgba(255,255,255,0.06)",
              // textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.4)",
                lineHeight: 1.4,
              }}
            >
              Made by
              <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>
                Nikhil Kumar
              </span>
              <br />
              under the guidance of
              <br />
              <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>
                Sukeerat Pal Singh Syan
              </span>
              <br />
              <span style={{ fontSize: 10 }}>
                Govt. Polytechnic College Talwara
              </span>
            </div>
          </div>
        )} */}
      </div>
    </div>
  );
};

export default SidebarMenu;