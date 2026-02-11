import React from 'react';
import { Breadcrumb, Typography } from 'antd';
import { HomeOutlined } from '@ant-design/icons';
import { Link, useLocation } from 'react-router-dom';

const { Text } = Typography;

// Route to label mapping
const routeLabels = {
  training: 'Training',
  calendar: 'Calendar',
  applications: 'My Applications',
  'lesson-plans': 'Lesson Plans',
  certificates: 'Certificates',
  manage: 'Manage Trainings',
  create: 'Create Training',
  edit: 'Edit Training',
  'feedback-forms': 'Feedback Forms',
  analytics: 'Analytics',
  reports: 'Reports',
  attendance: 'Attendance',
};

/**
 * Breadcrumb component for training module pages
 */
const TrainingBreadcrumb = ({
  items,
  currentPage,
  showHome = true,
  className = '',
}) => {
  const location = useLocation();

  // Auto-generate breadcrumb items from current path if not provided
  const generateBreadcrumbItems = () => {
    if (items) {
      return items;
    }

    const pathParts = location.pathname.split('/').filter(Boolean);
    const breadcrumbItems = [];

    // Build cumulative paths
    let currentPath = '';
    pathParts.forEach((part, index) => {
      currentPath += `/${part}`;

      // Skip 'app' prefix
      if (part === 'app') return;

      // Check if it's a UUID (skip as separate breadcrumb)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part);

      if (!isUuid) {
        const label = routeLabels[part] || part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' ');
        const isLast = index === pathParts.length - 1;

        breadcrumbItems.push({
          key: part,
          label: label,
          path: currentPath,
          isLast: isLast,
        });
      }
    });

    return breadcrumbItems;
  };

  const breadcrumbItems = generateBreadcrumbItems();

  // Replace last item's label with currentPage if provided
  if (currentPage && breadcrumbItems.length > 0) {
    breadcrumbItems[breadcrumbItems.length - 1].label = currentPage;
  }

  const antdItems = [
    ...(showHome
      ? [
          {
            key: 'home',
            title: (
              <Link to="/app" className="text-text-secondary hover:text-primary">
                <HomeOutlined />
              </Link>
            ),
          },
        ]
      : []),
    ...breadcrumbItems.map((item, index) => ({
      key: item.key,
      title: item.isLast ? (
        <Text className="text-text-primary font-medium">{item.label}</Text>
      ) : (
        <Link to={item.path} className="text-text-secondary hover:text-primary">
          {item.label}
        </Link>
      ),
    })),
  ];

  return (
    <Breadcrumb
      className={`mb-4 ${className}`}
      items={antdItems}
      separator={<span className="text-text-tertiary">/</span>}
    />
  );
};

export default TrainingBreadcrumb;
