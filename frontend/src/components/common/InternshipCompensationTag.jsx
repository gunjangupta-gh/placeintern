import React from 'react';
import { Tag } from 'antd';
import {
  INTERNSHIP_TYPE_COLORS,
  INTERNSHIP_TYPE_LABELS,
  formatCompensation,
} from '../../utils/internshipCompensation';

/**
 * Compensation of an internship: the type as a coloured tag, with the amount that goes with it
 * ("With Stipend  ₹8,000/mo", "Paid by Student  ₹2,500 fee"). Internships without a type show "Not specified".
 * Pass `showAmount={false}` for the bare type tag.
 */
const InternshipCompensationTag = ({ application, showAmount = true, className = '', ...rest }) => {
  const type = application?.internshipType;
  if (!type) {
    return (
      <Tag color="default" bordered={false} className={className} {...rest}>
        Type not specified
      </Tag>
    );
  }
  const amount = showAmount && type !== 'WITHOUT_STIPEND' ? formatCompensation(application) : null;
  return (
    <Tag color={INTERNSHIP_TYPE_COLORS[type]} bordered={false} className={className} {...rest}>
      {INTERNSHIP_TYPE_LABELS[type]}
      {amount ? ` · ${amount}` : ''}
    </Tag>
  );
};

export default InternshipCompensationTag;
