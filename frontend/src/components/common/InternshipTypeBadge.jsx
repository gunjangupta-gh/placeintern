import React from 'react';
import { Tag } from 'antd';

/**
 * Shows where an internship came from:
 *  - Self-Identified: the student found it and entered it themselves
 *  - State Opportunity: published by the State Directorate and applied for on the portal
 *
 * Pass the application's `isSelfIdentified` flag. A missing flag is treated as
 * self-identified, which is how every record behaved before opportunities existed.
 */
const InternshipTypeBadge = ({ isSelfIdentified, className = '', ...rest }) => {
  const selfIdentified = isSelfIdentified !== false;
  return (
    <Tag
      color={selfIdentified ? 'purple' : 'blue'}
      bordered={false}
      className={className}
      {...rest}
    >
      {selfIdentified ? 'Self-Identified' : 'State Opportunity'}
    </Tag>
  );
};

export default InternshipTypeBadge;
