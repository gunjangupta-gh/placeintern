import React from 'react';
import { Card, Space, Typography, theme } from 'antd';

const { Title, Text } = Typography;

const PageHeader = ({
  icon: Icon,
  title,
  description,
  actions = [],
  children,
}) => {
  const { token } = theme.useToken();

  return (
    <Card className="rounded-xl border-border shadow-none mb-6 overflow-hidden" styles={{ body: { padding: '16px' } }}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {Icon ? (
              <div
                className="flex items-center justify-center rounded-xl w-10 h-10 bg-surface border border-border text-primary shadow-none shrink-0"
              >
                <Icon className="text-lg" />
              </div>
            ) : null}
            <div>
              <Title level={3} className="!m-0 !text-text-primary text-xl">
                {title}
              </Title>
              {description ? (
                <Text className="text-text-secondary text-sm">{description}</Text>
              ) : null}
            </div>
          </div>

          {actions?.length ? (
            <Space wrap className="flex-shrink-0">{actions.filter(Boolean)}</Space>
          ) : null}
        </div>

        {children && <div className="mt-2">{children}</div>}
      </div>
    </Card>
  );
};

export default PageHeader;