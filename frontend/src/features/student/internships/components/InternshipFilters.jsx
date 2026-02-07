import React from 'react';
import { Card, Input, Select, Button, Typography } from 'antd';
import { FilterOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

const FIELD_OF_WORK_OPTIONS = [
  'Software Development',
  'Web Development',
  'Mobile Development',
  'Data Science',
  'UI/UX Design',
  'Digital Marketing',
  'Mechanical Engineering',
  'Civil Engineering',
  'Electrical Engineering',
];

const WORK_LOCATION_OPTIONS = [
  { value: 'ON_SITE', label: 'On-site' },
  { value: 'REMOTE', label: 'Remote' },
  { value: 'HYBRID', label: 'Hybrid' },
];

const DURATION_OPTIONS = [
  '1 month',
  '2 months',
  '3 months',
  '4 months',
  '5 months',
  '6 months',
];

const InternshipFilters = ({
  searchText,
  onSearchChange,
  showApplied,
  onShowAppliedChange,
  appliedCount,
  filters,
  onFilterChange,
  onClearFilters,
}) => {
  return (
    <Card className="sticky top-6 rounded-2xl border-border">
      <div className="flex items-center justify-between mb-6">
        <Title level={4} className="mb-0 flex items-center">
          <FilterOutlined className="mr-2 text-primary" />
          Filters
        </Title>
        <Button type="link" onClick={onClearFilters} className="text-primary">
          Clear All
        </Button>
      </div>

      <div className="space-y-6">
        {/* Search */}
        <div>
          <Text strong className="block mb-2 text-text-secondary">Search</Text>
          <Search
            placeholder="Search internships..."
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            className="rounded-lg"
            allowClear
          />
        </div>

        {/* Show Applied Toggle */}
        <div>
          <Text strong className="block mb-2 text-text-secondary">View Options</Text>
          <Select
            value={showApplied ? 'applied' : 'available'}
            onChange={(value) => onShowAppliedChange(value === 'applied')}
            className="w-full rounded-lg"
          >
            <Option value="available">Available Internships</Option>
            <Option value="applied">Applied Internships ({appliedCount})</Option>
          </Select>
        </div>

        {/* Field of Work */}
        <div>
          <Text strong className="block mb-2 text-text-secondary">Field of Work</Text>
          <Select
            placeholder="Select field"
            value={filters.fieldOfWork}
            onChange={(value) => onFilterChange('fieldOfWork', value)}
            className="w-full rounded-lg"
            allowClear
          >
            {FIELD_OF_WORK_OPTIONS.map((field) => (
              <Option key={field} value={field}>{field}</Option>
            ))}
          </Select>
        </div>

        {/* Work Location */}
        <div>
          <Text strong className="block mb-2 text-text-secondary">Work Location</Text>
          <Select
            placeholder="Select location"
            value={filters.workLocation}
            onChange={(value) => onFilterChange('workLocation', value)}
            className="w-full rounded-lg"
            allowClear
          >
            {WORK_LOCATION_OPTIONS.map((loc) => (
              <Option key={loc.value} value={loc.value}>{loc.label}</Option>
            ))}
          </Select>
        </div>

        {/* Duration */}
        <div>
          <Text strong className="block mb-2 text-text-secondary">Duration</Text>
          <Select
            placeholder="Select duration"
            value={filters.duration}
            onChange={(value) => onFilterChange('duration', value)}
            className="w-full rounded-lg"
            allowClear
          >
            {DURATION_OPTIONS.map((dur) => (
              <Option key={dur} value={dur}>{dur}</Option>
            ))}
          </Select>
        </div>

        {/* Stipend */}
        <div>
          <Text strong className="block mb-2 text-text-secondary">Stipend</Text>
          <Select
            placeholder="Select stipend type"
            value={filters.isStipendProvided}
            onChange={(value) => onFilterChange('isStipendProvided', value)}
            className="w-full rounded-lg"
            allowClear
          >
            <Option value="true">Paid</Option>
            <Option value="false">Unpaid</Option>
          </Select>
        </div>
      </div>
    </Card>
  );
};

export default InternshipFilters;
