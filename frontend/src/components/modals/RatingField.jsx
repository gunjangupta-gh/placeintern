import React from 'react';
import { Form, Select, Typography } from 'antd';

const { Option } = Select;
const { Text } = Typography;

/**
 * Reusable rating field component with star rating visualization
 * @param {Object} props
 * @param {string} props.name - Form field name
 * @param {string} props.label - Field label
 * @param {boolean} props.required - Whether field is required
 * @param {Object} props.labels - Labels for each rating level [1-5]
 * @param {string} props.tooltip - Optional tooltip text
 * @param {string} props.starColor - Color for the stars (tailwind class)
 */
const RatingField = ({
  name,
  label,
  required = false,
  labels = {
    1: 'Very Poor',
    2: 'Poor',
    3: 'Average',
    4: 'Good',
    5: 'Excellent'
  },
  tooltip,
  starColor = 'text-warning-400',
  placeholder = 'Select rating (1-5)',
}) => {
  return (
    <Form.Item
      name={name}
      label={label}
      rules={required ? [{ required: true, message: `Please rate ${label.toLowerCase()}` }] : []}
      tooltip={tooltip}
    >
      <Select placeholder={placeholder}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Option key={value} value={value}>
            <div className="flex items-center justify-between">
              <span>
                {labels[value] || `Rating ${value}`}
              </span>
              <div className="flex">
                {Array.from({ length: 5 }, (_, i) => (
                  <span
                    key={i}
                    className={`text-sm ${
                      i < value ? starColor : 'text-text-tertiary'
                    }`}
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>
          </Option>
        ))}
      </Select>
    </Form.Item>
  );
};

export default RatingField;