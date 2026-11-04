import React from 'react';
import { Empty, Typography } from 'antd';

const { Text } = Typography;

/** One empty state: a title, an optional hint and an optional action button. */
const EmptyState = ({ title = 'No data', text, action, compact = false }) => (
  <Empty
    image={Empty.PRESENTED_IMAGE_SIMPLE}
    styles={compact ? { image: { height: 40 } } : undefined}
    description={
      <div>
        <Text>{title}</Text>
        {text && <div><Text type="secondary" style={{ fontSize: 12 }}>{text}</Text></div>}
      </div>
    }
  >
    {action}
  </Empty>
);

export default EmptyState;
