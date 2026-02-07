import React from 'react';
import {
  Card,
  Row,
  Col,
  Input,
  Select,
  Button,
  Tag,
  Typography,
  Pagination,
  Empty,
  Spin,
} from 'antd';
import {
  SearchOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  BankOutlined,
  EyeOutlined,
  FilterOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import useBrowseInternships from './hooks/useBrowseInternships';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// Utility functions
const getStatusColor = (deadline) => {
  const daysLeft = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 3) return 'red';
  if (daysLeft <= 7) return 'orange';
  return 'green';
};

const getDaysLeft = (deadline) => {
  const daysLeft = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
  return daysLeft > 0 ? daysLeft : 0;
};

// Internship Card Component
const InternshipCard = ({ internship, isApplied, onViewDetails }) => (
  <Card
    className={`h-full rounded-2xl border-border shadow-sm hover:shadow-md transition-all duration-300 bg-surface overflow-hidden group flex flex-col ${
      isApplied ? 'border-success/30 bg-success-50/5' : ''
    }`}
    styles={{ body: { padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' } }}
  >
    <div className="flex justify-between items-start mb-4">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
        <BankOutlined className="text-xl text-primary" />
      </div>
      {isApplied ? (
        <Tag className="m-0 px-3 py-0.5 rounded-full border-0 bg-success/10 text-success-600 font-bold uppercase tracking-widest text-[9px]">
          Applied
        </Tag>
      ) : (
        <Tag
          color={getStatusColor(internship.applicationDeadline)}
          className="m-0 px-3 py-0.5 rounded-full border-0 font-bold uppercase tracking-widest text-[9px]"
        >
          {getDaysLeft(internship.applicationDeadline)}d Left
        </Tag>
      )}
    </div>

    <div className="mb-4">
      <Title level={5} className="!mb-1 !text-text-primary line-clamp-1 group-hover:text-primary transition-colors">
        {internship.title}
      </Title>
      <Text className="text-text-tertiary text-xs font-bold uppercase tracking-wider block">
        {internship.industry?.companyName}
      </Text>
    </div>

    <div className="flex flex-wrap gap-1.5 mb-4">
      <Tag className="m-0 px-2 py-0 border-border bg-background-tertiary/50 text-text-secondary text-[10px] font-medium rounded-md">
        {internship.fieldOfWork}
      </Tag>
      <Tag className="m-0 px-2 py-0 border-border bg-background-tertiary/50 text-text-secondary text-[10px] font-medium rounded-md">
        {internship.workLocation?.replace('_', ' ')}
      </Tag>
    </div>

    <Paragraph
      className="text-text-secondary text-sm line-clamp-2 mb-6"
      ellipsis={{ rows: 2 }}
    >
      {internship.description}
    </Paragraph>

    <div className="mt-auto space-y-3 pt-4 border-t border-border/50">
      <div className="grid grid-cols-2 gap-y-2">
        <div className="flex items-center gap-2">
          <ClockCircleOutlined className="text-warning text-xs" />
          <span className="text-[11px] font-bold text-text-secondary">{internship.duration}</span>
        </div>
        <div className="flex items-center gap-2">
          <DollarOutlined className="text-success text-xs" />
          <span className="text-[11px] font-bold text-text-secondary">
            {internship.isStipendProvided ? `₹${internship.stipendAmount}` : 'Unpaid'}
          </span>
        </div>
      </div>

      <Button
        type={isApplied ? "default" : "primary"}
        block
        icon={isApplied ? <CheckCircleOutlined /> : <EyeOutlined />}
        onClick={() => onViewDetails(internship)}
        className={`h-11 rounded-xl font-bold border-0 transition-all ${
          isApplied ? 'bg-background-tertiary text-text-secondary' : 'bg-primary shadow-lg shadow-primary/20'
        }`}
      >
        {isApplied ? 'View Details' : 'See Details'}
      </Button>
    </div>
  </Card>
);

// Filters Sidebar Component
const FiltersSection = ({
  searchText,
  onSearchChange,
  showApplied,
  onShowAppliedChange,
  appliedCount,
  filters,
  onFilterChange,
  onClearFilters,
}) => (
  <Card
    className="sticky top-6 rounded-2xl border-border shadow-sm"
    styles={{ body: { padding: '24px' } }}
    title={
      <div className="flex items-center gap-2">
        <FilterOutlined className="text-primary" />
        <span className="font-bold text-text-primary">Filters</span>
        <Button type="link" onClick={onClearFilters} className="ml-auto p-0 font-bold text-xs">RESET</Button>
      </div>
    }
  >
    <div className="space-y-6">
      <div>
        <Text className="text-[10px] uppercase font-black text-text-tertiary tracking-widest block mb-2">Search Role</Text>
        <Input
          placeholder="e.g. Frontend Developer"
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          className="rounded-xl h-11 bg-background border-border"
          prefix={<SearchOutlined className="text-text-tertiary" />}
          allowClear
        />
      </div>

      <div>
        <Text className="text-[10px] uppercase font-black text-text-tertiary tracking-widest block mb-2">Visibility</Text>
        <Select
          value={showApplied ? 'applied' : 'available'}
          onChange={(value) => onShowAppliedChange(value === 'applied')}
          className="w-full h-11"
        >
          <Option value="available">Hide Applied</Option>
          <Option value="applied">Show Applied ({appliedCount})</Option>
        </Select>
      </div>

      <div>
        <Text className="text-[10px] uppercase font-black text-text-tertiary tracking-widest block mb-2">Domain</Text>
        <Select
          placeholder="All Domains"
          value={filters.fieldOfWork}
          onChange={(value) => onFilterChange('fieldOfWork', value)}
          className="w-full h-11"
          allowClear
        >
          <Option value="Software Development">Software Development</Option>
          <Option value="Web Development">Web Development</Option>
          <Option value="Data Science">Data Science</Option>
          <Option value="UI/UX Design">UI/UX Design</Option>
          <Option value="Mechanical Engineering">Mechanical Engineering</Option>
        </Select>
      </div>

      <div>
        <Text className="text-[10px] uppercase font-black text-text-tertiary tracking-widest block mb-2">Work Mode</Text>
        <Select
          placeholder="Any Mode"
          value={filters.workLocation}
          onChange={(value) => onFilterChange('workLocation', value)}
          className="w-full h-11"
          allowClear
        >
          <Option value="ON_SITE">On-site</Option>
          <Option value="REMOTE">Remote</Option>
          <Option value="HYBRID">Hybrid</Option>
        </Select>
      </div>
    </div>
  </Card>
);

// Main Component
const BrowseInternships = () => {
  const navigate = useNavigate();
  const {
    loading,
    internships,
    totalInternships,
    searchText,
    setSearchText,
    showApplied,
    setShowApplied,
    filters,
    handleFilterChange,
    clearFilters,
    currentPage,
    setCurrentPage,
    pageSize,
    isApplied,
    appliedCount,
  } = useBrowseInternships();

  const handleViewDetails = (internship) => {
    navigate(`/internships/${internship.id}`);
  };

  return (
    <div className="p-4 md:p-6 bg-background-secondary min-h-screen">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-border text-primary shadow-sm mr-3">
              <SearchOutlined className="text-lg" />
            </div>
            <div>
              <Title level={2} className="mb-0 text-text-primary text-2xl">
                Browse Internships
              </Title>
              <Paragraph className="text-text-secondary text-sm mb-0">
                Discover internship opportunities that match your academic profile
              </Paragraph>
            </div>
          </div>
        </div>

        {/* Info Area */}
        {appliedCount > 0 && (
          <div className="bg-primary-50/50 border border-primary-100 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-primary">
              <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center shadow-sm">
                <CheckCircleOutlined className="text-sm" />
              </div>
              <Text className="font-semibold">
                You have applied to <span className="text-lg">{appliedCount}</span> internships
              </Text>
            </div>
            <Button
              onClick={() => setShowApplied(!showApplied)}
              className="rounded-xl px-6 font-bold bg-surface border-primary-200 text-primary"
            >
              {showApplied ? 'Show Available Only' : 'Manage My Applications'}
            </Button>
          </div>
        )}

        <Row gutter={[24, 24]}>
          {/* Filters Sidebar */}
          <Col xs={24} lg={6}>
            <FiltersSection
              searchText={searchText}
              onSearchChange={setSearchText}
              showApplied={showApplied}
              onShowAppliedChange={setShowApplied}
              appliedCount={appliedCount}
              filters={filters}
              onFilterChange={handleFilterChange}
              onClearFilters={clearFilters}
            />
          </Col>

          {/* Internships Grid */}
          <Col xs={24} lg={18}>
            <div className="mb-6 flex justify-between items-center px-2">
              <Text className="text-text-secondary font-medium">
                Found <span className="text-primary font-bold">{totalInternships}</span> opportunities
              </Text>
              <Select
                defaultValue="newest"
                className="w-44 h-10"
                placeholder="Sort by"
              >
                <Option value="newest">Latest Postings</Option>
                <Option value="deadline">Expiring Soon</Option>
                <Option value="stipend">Highest Stipend</Option>
              </Select>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 opacity-50">
                <Spin size="large" />
                <Text className="mt-4 font-medium">Fetching internships...</Text>
              </div>
            ) : internships.length > 0 ? (
              <>
                <Row gutter={[20, 20]}>
                  {internships.map((internship) => (
                    <Col xs={24} md={12} xl={8} key={internship.id}>
                      <InternshipCard
                        internship={internship}
                        isApplied={isApplied(internship.id)}
                        onViewDetails={handleViewDetails}
                      />
                    </Col>
                  ))}
                </Row>

                {totalInternships > pageSize && (
                  <div className="mt-12 flex justify-center pb-8">
                    <Pagination
                      current={currentPage}
                      pageSize={pageSize}
                      total={totalInternships}
                      onChange={setCurrentPage}
                      showSizeChanger={false}
                    />
                  </div>
                )}
              </>
            ) : (
              <Card className="rounded-2xl border-border border-dashed bg-surface p-20 flex flex-col items-center">
                <Empty description={false} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                <Title level={4} className="text-text-secondary mt-6 !mb-2">No opportunities found</Title>
                <Text className="text-text-tertiary text-center max-w-xs mb-8">
                  Try adjusting your filters or search terms to see more results.
                </Text>
                <Button onClick={clearFilters} className="rounded-xl px-8 font-bold">
                  Clear All Filters
                </Button>
              </Card>
            )}
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default BrowseInternships;
