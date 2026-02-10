import React from 'react';
import { Tag } from 'antd';

const BranchTags = ({ branches = [] }) => {
  if (!branches.length) return <Tag>All Branches</Tag>;

  return branches.map((branch) => {
    const label = typeof branch === 'string' ? branch : (branch.shortName || branch.name || branch.id);
    return (
      <Tag key={branch.id || label} color="geekblue">
        {label}
      </Tag>
    );
  });
};

export default BranchTags;
