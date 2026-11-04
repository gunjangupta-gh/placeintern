import React from 'react';
import { Typography } from 'antd';

const { Text } = Typography;

/** Table cell with a main line and a muted second line (name + roll no, company + position ...). */
const TitleCell = ({ title, sub }) => (
  <div style={{ minWidth: 0 }}>
    <div>{title}</div>
    {sub ? <Text type="secondary" style={{ fontSize: 12 }}>{sub}</Text> : null}
  </div>
);

export default TitleCell;
