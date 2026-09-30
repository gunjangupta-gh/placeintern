import React from 'react';
import {
  Form,
  Input,
  InputNumber,
  Button,
  Select,
  Tabs,
  DatePicker,
  Table,
  Row,
  Col,
  Checkbox,
  Alert,
} from 'antd';
import {
  PhoneOutlined,
  MailOutlined,
  GlobalOutlined,
  TeamOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  COVERED_AREA_ENTITIES,
  LAND_OWNERSHIP_OPTIONS,
  INSTITUTION_TYPES,
  YES_NO_OPTIONS,
  getDefaultAcademicYear,
} from './institutionFormUtils';

const { Option } = Select;
const { TextArea } = Input;

const TabLabel = ({ active, number, text }) => (
  <span
    className={`inline-flex items-center gap-2 px-2 py-1 rounded-md border transition-all ${
      active ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'
    }`}
  >
    <span
      className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-semibold rounded-full ${
        active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {number}
    </span>
    <span className="font-medium">{text}</span>
  </span>
);

const YesNoSelect = (props) => (
  <Select allowClear placeholder="Select" options={YES_NO_OPTIONS} {...props} />
);

/**
 * The tabbed body of the institution form. Must be rendered inside an antd
 * <Form>. Used by the State modal (mode="state") and the Principal
 * "My Institution" page (mode="principal").
 *
 * In principal mode the state-only fields (code, type, status, seat totals)
 * are read-only and the "Principal" account tab is not offered.
 */
const InstitutionFormTabs = ({
  mode = 'state',
  isEditMode,
  activeFormTab,
  onTabChange,
  branchOptions = [],
  batchOptions = [],
  createPrincipal = false,
  onCreatePrincipalChange,
}) => {
  const isPrincipalMode = mode === 'principal';
  const stateOnly = isPrincipalMode; // disable state-only fields for principals

  const tabs = [
    {
      key: 'basic',
      text: 'Basic',
      children: (
        <Row gutter={[10, 2]}>
          <Col xs={24} md={12}>
            <Form.Item name="type" label="Institution Type" rules={[{ required: true, message: 'Please select institution type' }]}>
              <Select placeholder="Select type" className="h-10" disabled={stateOnly}>
                {INSTITUTION_TYPES.map((opt) => (
                  <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="code" label="Institution Code" rules={[{ required: true, message: 'Please enter institution code' }]}>
              <Input placeholder="e.g. GPC-001" className="h-10 rounded-lg" disabled={stateOnly} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="name" label="Full Name" rules={[{ required: true, message: 'Please enter full name' }]}>
              <Input placeholder="Full institution name" className="h-10 rounded-lg" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="shortName" label="Short Name">
              <Input placeholder="Abbreviated name" className="h-10 rounded-lg" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="establishedYear" label="Est. Year">
              <Input type="number" placeholder="YYYY" min={1800} max={new Date().getFullYear()} className="h-10 rounded-lg" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="totalStudentSeats" label="Student Capacity">
              <Input type="number" placeholder="0" min={0} className="h-10 rounded-lg" disabled={stateOnly} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="totalStaffSeats" label="Staff Capacity">
              <Input type="number" placeholder="0" min={0} className="h-10 rounded-lg" disabled={stateOnly} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="isActive" label="Status" rules={[{ required: true }]}>
              <Select className="h-10" disabled={stateOnly}>
                <Option value="true">Active</Option>
                <Option value="false">Inactive</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
      ),
    },
    {
      key: 'location',
      text: 'Location',
      children: (
        <Row gutter={[10, 2]}>
          <Col xs={24}>
            <Form.Item name="address" label="Address" rules={[{ required: true, message: 'Please enter address' }]}>
              <TextArea rows={2} placeholder="Full address" className="rounded-lg" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}><Form.Item name="city" label="City"><Input className="h-10 rounded-lg" /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="district" label="District"><Input className="h-10 rounded-lg" /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="state" label="State" rules={[{ required: true, message: 'Please enter state' }]}><Input className="h-10 rounded-lg" /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="pinCode" label="PIN Code"><Input maxLength={6} className="h-10 rounded-lg" /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="country" label="Country" rules={[{ required: true, message: 'Please enter country' }]}><Input className="h-10 rounded-lg" /></Form.Item></Col>
          <Col xs={24} md={12}>
            <Form.Item name="contactEmail" label="Email" rules={[{ required: true, message: 'Please enter email' }, { type: 'email', message: 'Invalid email' }]}>
              <Input prefix={<MailOutlined className="text-text-tertiary" />} className="h-10 rounded-lg" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="contactPhone" label="Phone" rules={[{ required: true, message: 'Please enter phone' }]}>
              <Input prefix={<PhoneOutlined className="text-text-tertiary" />} className="h-10 rounded-lg" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}><Form.Item name="website" label="Website"><Input prefix={<GlobalOutlined className="text-text-tertiary" />} className="h-10 rounded-lg" /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="latitude" label="Latitude"><Input type="number" step="any" className="h-10 rounded-lg" /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="longitude" label="Longitude"><Input type="number" step="any" className="h-10 rounded-lg" /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="gpsMapLink" label="GPS Map Link"><Input className="h-10 rounded-lg" /></Form.Item></Col>
        </Row>
      ),
    },
    {
      key: 'land',
      text: 'Land',
      children: (
        <>
          <Row gutter={[10, 2]}>
            <Col xs={24} md={12}><Form.Item name="affiliatedTo" label="Affiliated To"><Input className="h-10 rounded-lg" /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="recognizedBy" label="Recognized By"><Input className="h-10 rounded-lg" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="totalLandAcres" label="Total Land (Acres)"><Input type="number" min={0} step="any" className="h-10 rounded-lg" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="landOwnership" label="Land Ownership"><Select allowClear options={LAND_OWNERSHIP_OPTIONS} className="h-10" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="hasLandDispute" label="Any Land Dispute"><YesNoSelect className="h-10" /></Form.Item></Col>
          </Row>
          <Form.List name="coveredAreaDetails">
            {(fields) => {
              const tableColumns = [
                { title: 'Entity', width: 140, render: (_, __, index) => <Form.Item name={[index, 'entityType']} className="mb-0"><Select disabled options={COVERED_AREA_ENTITIES} /></Form.Item> },
                { title: 'Rooms', width: 100, render: (_, __, index) => <Form.Item name={[index, 'numberOfRooms']} className="mb-0"><InputNumber min={0} precision={0} className="w-full" /></Form.Item> },
                { title: 'Required', width: 110, render: (_, __, index) => <Form.Item name={[index, 'requiredAreaSqFt']} className="mb-0"><InputNumber min={0} step={0.01} className="w-full" /></Form.Item> },
                { title: 'Available', width: 110, render: (_, __, index) => <Form.Item name={[index, 'availableAreaSqFt']} className="mb-0"><InputNumber min={0} step={0.01} className="w-full" /></Form.Item> },
                { title: 'Additional', width: 120, render: (_, __, index) => <Form.Item name={[index, 'additionalRequirementSqFt']} className="mb-0"><InputNumber min={0} step={0.01} className="w-full" /></Form.Item> },
                { title: 'Unsafe', width: 100, render: (_, __, index) => <Form.Item name={[index, 'declaredUnsafeAreaSqFt']} className="mb-0"><InputNumber min={0} step={0.01} className="w-full" /></Form.Item> },
                { title: 'Last Repair Date', width: 160, render: (_, __, index) => <Form.Item name={[index, 'lastMajorRepairDate']} className="mb-0"><DatePicker className="w-full" format="DD-MM-YYYY" /></Form.Item> },
                { title: 'Furniture Available', width: 140, render: (_, __, index) => <Form.Item name={[index, 'furnitureAvailable']} className="mb-0"><YesNoSelect /></Form.Item> },
                { title: 'Smart Boards / TVs', width: 140, render: (_, __, index) => <Form.Item name={[index, 'smartBoardsCount']} className="mb-0"><InputNumber min={0} precision={0} className="w-full" /></Form.Item> },
                { title: 'Future Expansion', width: 190, render: (_, __, index) => <Form.Item name={[index, 'futureExpansionScope']} className="mb-0"><Input placeholder="Optional" /></Form.Item> },
              ];
              return <Table size="small" bordered pagination={false} scroll={{ x: 1310 }} columns={tableColumns} dataSource={fields.map((field) => ({ key: field.key }))} />;
            }}
          </Form.List>
        </>
      ),
    },
    {
      key: 'other',
      text: 'Other Info',
      children: (
        <Table
          size="small"
          bordered
          pagination={false}
          scroll={{ x: 720 }}
          rowKey="key"
          columns={[
            { title: 'Sr No', dataIndex: 'srNo', width: 60 },
            { title: 'Description', dataIndex: 'label', width: 200 },
            { title: 'Yes / No', width: 120, render: (_, row) => row.first },
            { title: 'Description', dataIndex: 'label2', width: 240 },
            { title: 'Yes / No', width: 120, render: (_, row) => row.second },
          ]}
          dataSource={[
            {
              key: 'library',
              srNo: 1,
              label: 'Library Available',
              first: <Form.Item name="hasLibrary" className="mb-0"><YesNoSelect /></Form.Item>,
              label2: 'Books as per AICTE Norms Available',
              second: <Form.Item name="libraryAictBooksAvailable" className="mb-0"><YesNoSelect /></Form.Item>,
            },
            {
              key: 'bus',
              srNo: 2,
              label: 'College Bus / Van',
              first: <Form.Item name="hasCollegeBus" className="mb-0"><YesNoSelect /></Form.Item>,
              label2: 'Driver',
              second: <Form.Item name="busHasDriver" className="mb-0"><YesNoSelect /></Form.Item>,
            },
            {
              key: 'computers',
              srNo: 3,
              label: 'Number of Computers',
              first: <Form.Item name="computersCount" className="mb-0"><Input type="number" min={0} placeholder="0" /></Form.Item>,
              label2: 'Are all Computers Connected to Internet',
              second: <Form.Item name="computersAllInternetConnected" className="mb-0"><YesNoSelect /></Form.Item>,
            },
          ]}
        />
      ),
    },
    {
      key: 'intake',
      text: 'Intake',
      children: (
        <div className="space-y-3">
          <Alert
            type="info"
            showIcon
            className="rounded-lg border-info/20"
            message="Course-wise seats are stored separately from the institution totals."
            description="Add one row per branch and academic year. Sanctioned seats and fee-waiver seats are captured per institution."
          />
          <Form.List name="branchIntakes">
            {(fields, { add, remove }) => {
              const tableColumns = [
                {
                  title: 'Branch',
                  width: 220,
                  render: (_, __, index) => (
                    <Form.Item name={[index, 'branchId']} className="mb-0" rules={[{ required: true, message: 'Select a branch' }]}>
                      <Select showSearch optionFilterProp="label" placeholder="Select branch" options={branchOptions} />
                    </Form.Item>
                  ),
                },
                {
                  title: 'Academic Year',
                  width: 150,
                  render: (_, __, index) => (
                    <Form.Item name={[index, 'academicYear']} className="mb-0" rules={[{ required: true, message: 'Enter academic year' }]}>
                      <Input placeholder="2026-27" />
                    </Form.Item>
                  ),
                },
                {
                  title: 'Batch',
                  width: 180,
                  render: (_, __, index) => (
                    <Form.Item name={[index, 'batchId']} className="mb-0">
                      <Select allowClear showSearch optionFilterProp="label" placeholder="Optional batch" options={batchOptions} />
                    </Form.Item>
                  ),
                },
                {
                  title: 'Sanctioned',
                  width: 120,
                  render: (_, __, index) => (
                    <Form.Item name={[index, 'sanctionedSeats']} className="mb-0" rules={[{ required: true, message: 'Enter seats' }]}>
                      <Input type="number" min={0} placeholder="0" />
                    </Form.Item>
                  ),
                },
                {
                  title: 'Fee Waiver',
                  width: 120,
                  render: (_, __, index) => (
                    <Form.Item name={[index, 'feeWaiverSeats']} className="mb-0" rules={[{ required: true, message: 'Enter fee waiver seats' }]}>
                      <Input type="number" min={0} placeholder="0" />
                    </Form.Item>
                  ),
                },
                {
                  title: 'Actions',
                  width: 90,
                  render: (_, __, index) => (
                    <Button danger type="text" size="small" onClick={() => remove(index)} disabled={fields.length === 1}>
                      Remove
                    </Button>
                  ),
                },
              ];

              return (
                <div className="space-y-2">
                  <div className="flex justify-end">
                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      onClick={() => add({
                        branchId: undefined,
                        batchId: undefined,
                        academicYear: getDefaultAcademicYear(),
                        sanctionedSeats: 0,
                        feeWaiverSeats: 0,
                        isActive: true,
                      })}
                    >
                      Add Intake Row
                    </Button>
                  </div>
                  <Table size="small" bordered pagination={false} scroll={{ x: 980 }} columns={tableColumns} dataSource={fields.map((field) => ({ key: field.key }))} />
                </div>
              );
            }}
          </Form.List>
        </div>
      ),
    },
    {
      key: 'staff',
      text: 'Staff',
      children: (
        <div className="space-y-3">
          <Alert
            type="info"
            showIcon
            className="rounded-lg border-info/20"
            message="Branch-wise staff capacity tracking."
            description="Add one row per branch and academic year. Track sanctioned posts, filled posts, and guest faculty."
          />
          <Form.List name="staffCapacities">
            {(fields, { add, remove }) => {
              const tableColumns = [
                {
                  title: 'Branch',
                  width: 220,
                  render: (_, __, index) => (
                    <Form.Item name={[index, 'branchId']} className="mb-0" rules={[{ required: true, message: 'Select a branch' }]}>
                      <Select showSearch optionFilterProp="label" placeholder="Select branch" options={branchOptions} />
                    </Form.Item>
                  ),
                },
                {
                  title: 'Academic Year',
                  width: 130,
                  render: (_, __, index) => (
                    <Form.Item name={[index, 'academicYear']} className="mb-0" rules={[{ required: true, message: 'Enter academic year' }]}>
                      <Input placeholder="2026-27" />
                    </Form.Item>
                  ),
                },
                {
                  title: 'Sanctioned',
                  width: 100,
                  render: (_, __, index) => (
                    <Form.Item name={[index, 'sanctionedPosts']} className="mb-0" rules={[{ required: true, message: 'Required' }]}>
                      <InputNumber min={0} placeholder="0" className="w-full" />
                    </Form.Item>
                  ),
                },
                {
                  title: 'Filled (Auto)',
                  width: 100,
                  render: (_, __, index) => (
                    <Form.Item name={[index, 'filledPosts']} className="mb-0">
                      <InputNumber min={0} disabled className="w-full" />
                    </Form.Item>
                  ),
                },
                {
                  title: 'Guest (Auto)',
                  width: 100,
                  render: (_, __, index) => (
                    <Form.Item name={[index, 'guestFaculty']} className="mb-0">
                      <InputNumber min={0} disabled className="w-full" />
                    </Form.Item>
                  ),
                },
                {
                  title: '',
                  width: 80,
                  render: (_, __, index) => (
                    <Button danger type="text" size="small" onClick={() => remove(index)} disabled={fields.length === 1}>
                      Remove
                    </Button>
                  ),
                },
              ];

              return (
                <div className="space-y-2">
                  <div className="flex justify-end">
                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      onClick={() => add({
                        branchId: undefined,
                        academicYear: getDefaultAcademicYear(),
                        sanctionedPosts: 0,
                        isActive: true,
                      })}
                    >
                      Add Staff Row
                    </Button>
                  </div>
                  <Table size="small" bordered pagination={false} scroll={{ x: 800 }} columns={tableColumns} dataSource={fields.map((field) => ({ key: field.key }))} />
                </div>
              );
            }}
          </Form.List>
        </div>
      ),
    },
    ...(!isEditMode && !isPrincipalMode
      ? [{
          key: 'principal',
          text: 'Principal',
          children: (
            <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
              <Form.Item className="mb-0">
                <Checkbox checked={createPrincipal} onChange={(e) => onCreatePrincipalChange?.(e.target.checked)} className="font-semibold text-text-primary">
                  Create Principal Account for this Institute
                </Checkbox>
              </Form.Item>
              {createPrincipal && (
                <div className="mt-4">
                  <Row gutter={[10, 2]}>
                    <Col xs={24} md={12}>
                      <Form.Item name="principalName" label="Principal Name" rules={[{ required: createPrincipal, message: 'Please enter principal name' }, { min: 3 }]}>
                        <Input prefix={<TeamOutlined className="text-text-tertiary" />} placeholder="Full name" className="h-10 rounded-lg" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="principalPhone" label="Principal Phone" rules={[{ required: createPrincipal, message: 'Please enter phone number' }, { pattern: /^[0-9]{10}$/, message: 'Must be 10 digits' }]}>
                        <Input prefix={<PhoneOutlined className="text-text-tertiary" />} placeholder="10-digit phone" maxLength={10} className="h-10 rounded-lg" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Alert title="Credentials Info" description="Default credentials will be generated automatically for the Principal and Institutional Admin." type="info" showIcon className="rounded-lg border-info/20" />
                </div>
              )}
            </div>
          ),
        }]
      : []),
  ];

  return (
    <Tabs
      activeKey={activeFormTab}
      onChange={onTabChange}
      size="small"
      className="mb-2"
      tabBarGutter={12}
      tabBarStyle={{
        position: 'sticky',
        top: 0,
        zIndex: 5,
        background: 'var(--color-bg-container, #fff)',
        marginBottom: 8,
        paddingTop: 2,
      }}
      items={tabs.map((tab, index) => ({
        key: tab.key,
        label: <TabLabel active={activeFormTab === tab.key} number={index + 1} text={tab.text} />,
        children: tab.children,
      }))}
    />
  );
};

export default InstitutionFormTabs;
