import React from 'react';
import { Card, Tabs, Tag, Typography, Table, Row, Col, Empty, theme } from 'antd';
import {
  BankOutlined,
  IdcardOutlined,
  MailOutlined,
  PhoneOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  InfoCircleOutlined,
  AppstoreOutlined,
  TeamOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  COVERED_AREA_ENTITIES,
  INSTITUTION_TYPES,
  LAND_OWNERSHIP_OPTIONS,
} from '../../shared/institution/institutionFormUtils';

const { Title, Text } = Typography;

const labelOf = (options, value) => options.find((o) => o.value === value)?.label || value;

// null / undefined = not filled in yet ("N/A"), distinct from an explicit "No"
const yesNo = (value) => {
  if (value === null || value === undefined) return null;
  return (
    <Tag color={value ? 'success' : 'default'} className="m-0 text-[10px] rounded-md border-0 px-2">
      {value ? 'Yes' : 'No'}
    </Tag>
  );
};

const InfoCard = ({ icon, label, value, color }) => {
  const { token } = theme.useToken();
  return (
    <div
      className="p-3 rounded-lg flex items-center gap-3 min-w-0"
      style={{ backgroundColor: token.colorFillQuaternary }}
    >
      <div className="text-lg shrink-0" style={{ color }}>{icon}</div>
      <div className="min-w-0">
        <Text className="text-[11px] block" style={{ color: token.colorTextTertiary }}>{label}</Text>
        <Text className="text-sm font-medium block truncate" style={{ color: token.colorText }}>
          {value || 'N/A'}
        </Text>
      </div>
    </div>
  );
};

// A titled panel of label / value rows (matches the student profile panels)
const Panel = ({ title, icon, rows }) => {
  const { token } = theme.useToken();
  return (
    <div
      className="rounded-xl border p-4 h-full"
      style={{ backgroundColor: token.colorFillQuaternary, borderColor: token.colorBorderSecondary }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span style={{ color: token.colorPrimary }}>{icon}</span>
        <Text className="text-sm font-semibold" style={{ color: token.colorText }}>{title}</Text>
      </div>
      <div className="space-y-2.5">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-start gap-4">
            <Text className="text-xs w-2/5 shrink-0" style={{ color: token.colorTextSecondary }}>{label}</Text>
            <div className="text-xs font-medium min-w-0 break-words" style={{ color: token.colorText }}>
              {value === null || value === undefined || value === '' ? 'N/A' : value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TabLabel = ({ icon, text }) => (
  <span className="flex items-center text-xs font-medium">
    <span className="mr-1.5">{icon}</span>{text}
  </span>
);

const formatDate = (value) => (value ? dayjs(value).format('DD-MM-YYYY') : null);
const formatNumber = (value) => (value === null || value === undefined ? null : Number(value).toLocaleString());

const InstitutionProfileView = ({ institution, intakes = [], staffCapacities = [] }) => {
  const { token } = theme.useToken();
  const inst = institution || {};

  const coveredAreas = COVERED_AREA_ENTITIES
    .map((entity) => (inst.coveredAreaDetails || []).find((row) => row.entityType === entity.value))
    .filter(Boolean);

  const location = [inst.city, inst.district, inst.state].filter(Boolean).join(', ');
  const typeLabel = labelOf(INSTITUTION_TYPES, inst.type);

  const overviewTab = (
    <div className="p-5">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Panel
            title="Basic Information"
            icon={<InfoCircleOutlined />}
            rows={[
              { label: 'Full Name', value: inst.name },
              { label: 'Short Name', value: inst.shortName },
              { label: 'Institution Code', value: inst.code },
              { label: 'Institution Type', value: typeLabel },
              { label: 'Established Year', value: inst.establishedYear },
              { label: 'Student Capacity', value: formatNumber(inst.totalStudentSeats) },
              { label: 'Staff Capacity', value: formatNumber(inst.totalStaffSeats) },
              { label: 'Affiliated To', value: inst.affiliatedTo },
              { label: 'Recognized By', value: inst.recognizedBy },
            ]}
          />
        </Col>
        <Col xs={24} md={12}>
          <Panel
            title="Contact & Location"
            icon={<EnvironmentOutlined />}
            rows={[
              { label: 'Email', value: inst.contactEmail },
              { label: 'Phone', value: inst.contactPhone },
              { label: 'Website', value: inst.website },
              { label: 'Address', value: inst.address },
              { label: 'City', value: inst.city },
              { label: 'District', value: inst.district },
              { label: 'State', value: inst.state },
              { label: 'PIN Code', value: inst.pinCode },
              { label: 'Country', value: inst.country },
              {
                label: 'GPS Location',
                value: inst.gpsMapLink
                  ? <a href={inst.gpsMapLink} target="_blank" rel="noreferrer">View on map</a>
                  : (inst.latitude != null && inst.longitude != null ? `${inst.latitude}, ${inst.longitude}` : null),
              },
            ]}
          />
        </Col>
      </Row>
    </div>
  );

  const coveredColumns = [
    { title: 'Entity', dataIndex: 'entityType', render: (v) => labelOf(COVERED_AREA_ENTITIES, v), fixed: 'left', width: 140 },
    { title: 'Rooms', dataIndex: 'numberOfRooms', align: 'center', render: (v) => v ?? '-' },
    { title: 'Required (Sq.ft)', dataIndex: 'requiredAreaSqFt', align: 'center', render: (v) => formatNumber(v) ?? '-' },
    { title: 'Available (Sq.ft)', dataIndex: 'availableAreaSqFt', align: 'center', render: (v) => formatNumber(v) ?? '-' },
    { title: 'Additional (Sq.ft)', dataIndex: 'additionalRequirementSqFt', align: 'center', render: (v) => formatNumber(v) ?? '-' },
    { title: 'Unsafe (Sq.ft)', dataIndex: 'declaredUnsafeAreaSqFt', align: 'center', render: (v) => formatNumber(v) ?? '-' },
    { title: 'Last Repair', dataIndex: 'lastMajorRepairDate', align: 'center', render: (v) => formatDate(v) ?? '-' },
    { title: 'Furniture', dataIndex: 'furnitureAvailable', align: 'center', render: (v) => yesNo(v) ?? '-' },
    { title: 'Smart Boards / TVs', dataIndex: 'smartBoardsCount', align: 'center', render: (v) => v ?? '-' },
    { title: 'Future Expansion', dataIndex: 'futureExpansionScope', render: (v) => v || '-' },
  ];

  const infrastructureTab = (
    <div className="p-5 space-y-4">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Panel
            title="Land Details"
            icon={<EnvironmentOutlined />}
            rows={[
              { label: 'Total Land (Acres)', value: inst.totalLandAcres },
              { label: 'Land Ownership', value: inst.landOwnership ? labelOf(LAND_OWNERSHIP_OPTIONS, inst.landOwnership) : null },
              { label: 'Any Land Dispute', value: yesNo(inst.hasLandDispute) },
            ]}
          />
        </Col>
        <Col xs={24} md={12}>
          <Panel
            title="Other Information"
            icon={<AppstoreOutlined />}
            rows={[
              { label: 'Library Available', value: yesNo(inst.hasLibrary) },
              { label: 'Books as per AICTE Norms', value: yesNo(inst.libraryAictBooksAvailable) },
              { label: 'College Bus / Van', value: yesNo(inst.hasCollegeBus) },
              { label: 'Driver', value: yesNo(inst.busHasDriver) },
              { label: 'Number of Computers', value: inst.computersCount },
              { label: 'All Computers Connected to Internet', value: yesNo(inst.computersAllInternetConnected) },
            ]}
          />
        </Col>
      </Row>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <BankOutlined style={{ color: token.colorPrimary }} />
          <Text className="text-sm font-semibold" style={{ color: token.colorText }}>Covered Areas</Text>
        </div>
        {coveredAreas.length ? (
          <Table
            size="small"
            bordered
            pagination={false}
            rowKey="entityType"
            scroll={{ x: 1100 }}
            columns={coveredColumns}
            dataSource={coveredAreas}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No covered area details added yet" />
        )}
      </div>
    </div>
  );

  const intakeTab = (
    <div className="p-5">
      <Table
        size="small"
        bordered
        pagination={false}
        rowKey={(row) => row.id || `${row.branchId}-${row.academicYear}`}
        scroll={{ x: 700 }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No intake records added yet" /> }}
        columns={[
          { title: 'Branch', render: (_, row) => row.branch?.name || '-' },
          { title: 'Academic Year', dataIndex: 'academicYear', align: 'center' },
          { title: 'Batch', render: (_, row) => row.batch?.name || '-', align: 'center' },
          { title: 'Sanctioned Seats', dataIndex: 'sanctionedSeats', align: 'center' },
          { title: 'Fee Waiver Seats', dataIndex: 'feeWaiverSeats', align: 'center' },
        ]}
        dataSource={intakes}
      />
    </div>
  );

  const staffTab = (
    <div className="p-5">
      <Table
        size="small"
        bordered
        pagination={false}
        rowKey={(row) => row.id || `${row.branchId}-${row.academicYear}`}
        scroll={{ x: 700 }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No staff capacity records added yet" /> }}
        columns={[
          { title: 'Branch', render: (_, row) => row.branch?.name || '-' },
          { title: 'Academic Year', dataIndex: 'academicYear', align: 'center' },
          { title: 'Sanctioned Posts', dataIndex: 'sanctionedPosts', align: 'center' },
          { title: 'Filled', dataIndex: 'filledPosts', align: 'center' },
          { title: 'Guest Faculty', dataIndex: 'guestFaculty', align: 'center' },
          { title: 'Vacant', dataIndex: 'vacantPosts', align: 'center' },
        ]}
        dataSource={staffCapacities}
      />
    </div>
  );

  return (
    <>
      {/* Profile header card */}
      <Card
        variant="borderless"
        className="rounded-xl shadow-sm border"
        style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorderSecondary }}
        styles={{ body: { padding: '20px' } }}
      >
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: token.colorFillSecondary, color: token.colorTextTertiary }}
          >
            <BankOutlined style={{ fontSize: 36 }} />
          </div>

          <div className="flex-grow min-w-0 text-center sm:text-left">
            <Title level={4} className="!mb-1 font-semibold" style={{ color: token.colorText }}>
              {inst.name || 'N/A'}
            </Title>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs mb-2.5" style={{ color: token.colorTextSecondary }}>
              <span className="flex items-center gap-1.5">
                <IdcardOutlined style={{ color: token.colorTextTertiary }} />
                {inst.code || 'N/A'}
              </span>
              {location && (
                <span className="flex items-center gap-1.5">
                  <EnvironmentOutlined style={{ color: token.colorTextTertiary }} />
                  {location}
                </span>
              )}
            </div>
            <div className="flex flex-wrap justify-center sm:justify-start gap-1.5">
              <Tag color="blue" className="rounded-md text-[10px] font-semibold m-0 px-2 border-0">{typeLabel || 'N/A'}</Tag>
              <Tag color={inst.isActive === false ? 'error' : 'success'} className="rounded-md text-[10px] font-semibold m-0 px-2 border-0">
                {inst.isActive === false ? 'Inactive' : 'Active'}
              </Tag>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
          <InfoCard icon={<MailOutlined />} label="Email" value={inst.contactEmail} color={token.colorPrimary} />
          <InfoCard icon={<PhoneOutlined />} label="Contact" value={inst.contactPhone} color={token.colorSuccess} />
          <InfoCard icon={<CalendarOutlined />} label="Established" value={inst.establishedYear} color={token.colorWarning} />
        </div>
      </Card>

      {/* Details tabs */}
      <Card
        variant="borderless"
        className="rounded-xl shadow-sm overflow-hidden border"
        style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorderSecondary }}
        styles={{ body: { padding: 0 } }}
      >
        <Tabs
          defaultActiveKey="overview"
          className="custom-tabs"
          items={[
            { key: 'overview', label: <TabLabel icon={<InfoCircleOutlined />} text="Overview" />, children: overviewTab },
            { key: 'infrastructure', label: <TabLabel icon={<EnvironmentOutlined />} text="Land & Infrastructure" />, children: infrastructureTab },
            { key: 'intake', label: <TabLabel icon={<ApartmentOutlined />} text="Intake" />, children: intakeTab },
            { key: 'staff', label: <TabLabel icon={<TeamOutlined />} text="Staff" />, children: staffTab },
          ]}
        />
      </Card>
    </>
  );
};

export default InstitutionProfileView;
