import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Modal,
  Form,
  Input,
  Button,
  Select,
  Tabs,
  DatePicker,
  Table,
  Row,
  Col,
  Divider,
  Typography,
  Checkbox,
  Alert,
  Spin
} from 'antd';
import { toast } from 'react-hot-toast';
import {
  SaveOutlined,
  BankOutlined,
  PhoneOutlined,
  MailOutlined,
  GlobalOutlined,
  TeamOutlined,
  EditOutlined,
  PlusOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import stateService from '../../../services/state.service';
import lookupService from '../../../services/lookup.service';
import {
  createInstitution,
  updateInstitution,
  selectInstitutions,
} from '../store/stateSlice';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const INTEGER_FIELDS = new Set([
  'establishedYear',
  'totalStudentSeats',
  'totalStaffSeats',
]);

const INTAKE_FIELDS = new Set([
  'sanctionedSeats',
  'feeWaiverSeats',
]);

const FLOAT_FIELDS = new Set([
  'latitude',
  'longitude',
  'totalLandAcres',
]);

const COVERED_AREA_ENTITIES = [
  { value: 'LECTURE_ROOMS', label: 'Lecture Rooms' },
  { value: 'LABS', label: 'Labs' },
  { value: 'WORKSHOPS', label: 'Workshops' },
  { value: 'COMMON_AREA', label: 'Common Area' },
  { value: 'OTHERS', label: 'Others' },
];

const LAND_OWNERSHIP_OPTIONS = [
  { value: 'OWNED', label: 'Owned' },
  { value: 'LEASED', label: 'Leased' },
  { value: 'GOVERNMENT_ALLOTTED', label: 'Government Allotted' },
  { value: 'PPP', label: 'PPP' },
  { value: 'OTHER', label: 'Other' },
];

const toNumberOrUndefined = (value) => {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const isCoveredAreaRowFilled = (row = {}) => {
  const keysToCheck = [
    'numberOfRooms',
    'requiredAreaSqFt',
    'availableAreaSqFt',
    'additionalRequirementSqFt',
    'declaredUnsafeAreaSqFt',
    'lastMajorRepairDate',
    'futureExpansionScope',
  ];
  return keysToCheck.some((key) => row[key] !== undefined && row[key] !== null && row[key] !== '');
};

const buildDefaultCoveredAreaRows = () => COVERED_AREA_ENTITIES.map((entity) => ({
  entityType: entity.value,
  numberOfRooms: undefined,
  requiredAreaSqFt: undefined,
  availableAreaSqFt: undefined,
  additionalRequirementSqFt: undefined,
  declaredUnsafeAreaSqFt: undefined,
  lastMajorRepairDate: null,
  futureExpansionScope: '',
}));

const getDefaultAcademicYear = () => {
  const year = new Date().getFullYear();
  const nextYear = String((year + 1) % 100).padStart(2, '0');
  return `${year}-${nextYear}`;
};

const buildDefaultBranchIntakeRows = () => ([{
  branchId: undefined,
  batchId: undefined,
  academicYear: getDefaultAcademicYear(),
  sanctionedSeats: 0,
  feeWaiverSeats: 0,
  isActive: true,
}]);

const normalizeLookupList = (response, key) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.[key])) return response[key];
  if (Array.isArray(response?.data?.[key])) return response.data[key];
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

const sanitizeInstitutionPayload = (values) => {
  const basePayload = {
    ...values,
    isActive: values.isActive === 'true',
    hasLandDispute:
      values.hasLandDispute === '' || values.hasLandDispute === undefined
        ? undefined
        : values.hasLandDispute === 'true',
  };

  const sanitized = Object.entries(basePayload).reduce((acc, [key, value]) => {
    if (key === 'branchIntakes') {
      return acc;
    }

    if (value === '' || value === null || value === undefined) {
      return acc;
    }

    if (INTEGER_FIELDS.has(key)) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        acc[key] = parsed;
      }
      return acc;
    }

    if (FLOAT_FIELDS.has(key)) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        acc[key] = parsed;
      }
      return acc;
    }

    acc[key] = value;
    return acc;
  }, {});

  const coveredAreaRows = (values.coveredAreaDetails || [])
    .map((row) => ({
      entityType: row.entityType,
      numberOfRooms: toNumberOrUndefined(row.numberOfRooms),
      requiredAreaSqFt: toNumberOrUndefined(row.requiredAreaSqFt),
      availableAreaSqFt: toNumberOrUndefined(row.availableAreaSqFt),
      additionalRequirementSqFt: toNumberOrUndefined(row.additionalRequirementSqFt),
      declaredUnsafeAreaSqFt: toNumberOrUndefined(row.declaredUnsafeAreaSqFt),
      lastMajorRepairDate: row.lastMajorRepairDate ? row.lastMajorRepairDate.toISOString() : undefined,
      futureExpansionScope: row.futureExpansionScope || undefined,
    }))
    .filter((row) => row.entityType && isCoveredAreaRowFilled(row));

  if (coveredAreaRows.length > 0) {
    sanitized.coveredAreaDetails = {
      deleteMany: {},
      create: coveredAreaRows,
    };
  }

  return sanitized;
};

const sanitizeBranchIntakeRows = (rows = []) => rows
  .map((row) => ({
    branchId: row.branchId || undefined,
    batchId: row.batchId || undefined,
    academicYear: row.academicYear ? String(row.academicYear).trim() : undefined,
    sanctionedSeats: row.sanctionedSeats === '' || row.sanctionedSeats === null || row.sanctionedSeats === undefined
      ? 0
      : Number(row.sanctionedSeats),
    feeWaiverSeats: row.feeWaiverSeats === '' || row.feeWaiverSeats === null || row.feeWaiverSeats === undefined
      ? 0
      : Number(row.feeWaiverSeats),
    isActive: row.isActive !== false,
  }))
  .filter((row) => row.branchId && row.academicYear);

const buildInstitutionFormValues = (institution) => {
  const existingCoveredArea = (institution?.coveredAreaDetails || []).reduce((acc, row) => {
    acc[row.entityType] = {
      ...row,
      lastMajorRepairDate: row.lastMajorRepairDate ? dayjs(row.lastMajorRepairDate) : null,
    };
    return acc;
  }, {});

  return {
    ...institution,
    isActive: institution?.isActive?.toString(),
    hasLandDispute:
      institution?.hasLandDispute === undefined || institution?.hasLandDispute === null
        ? undefined
        : institution.hasLandDispute.toString(),
    coveredAreaDetails: COVERED_AREA_ENTITIES.map((entity) => ({
      entityType: entity.value,
      ...(existingCoveredArea[entity.value] || {}),
    })),
    branchIntakes: (institution?.branchIntakes?.length ? institution.branchIntakes : buildDefaultBranchIntakeRows()).map((row) => ({
      branchId: row.branchId,
      batchId: row.batchId || undefined,
      academicYear: row.academicYear || getDefaultAcademicYear(),
      sanctionedSeats: row.sanctionedSeats ?? 0,
      feeWaiverSeats: row.feeWaiverSeats ?? 0,
      isActive: row.isActive !== false,
    })),
  };
};

const InstitutionModal = ({ open, onClose, institutionId, onSuccess }) => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const institutions = useSelector(selectInstitutions);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [branchOptions, setBranchOptions] = useState([]);
  const [batchOptions, setBatchOptions] = useState([]);
  const [createPrincipal, setCreatePrincipal] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState('basic');

  const isEditMode = !!institutionId;

  // Institution Types (aligned with backend/schema)
  const institutionTypes = [
    "POLYTECHNIC",
    "ENGINEERING_COLLEGE",
    "UNIVERSITY",
    "DEGREE_COLLEGE",
    "ITI",
    "SKILL_CENTER",
  ];

  useEffect(() => {
    let alive = true;

    const loadInstitutionForEdit = async () => {
      setLoading(true);
      try {
        const [institutionResponse, intakesResponse] = await Promise.all([
          stateService.getInstitutionById(institutionId),
          stateService.getInstitutionBranchIntakes(institutionId),
        ]);

        const detailedInstitution = institutionResponse?.data || institutionResponse;

        if (alive && detailedInstitution) {
          const fetchedIntakes = Array.isArray(intakesResponse)
            ? intakesResponse
            : intakesResponse?.data || detailedInstitution.branchIntakes || [];
          const institutionWithIntakes = {
            ...detailedInstitution,
            branchIntakes: fetchedIntakes,
          };
          form.setFieldsValue(buildInstitutionFormValues(institutionWithIntakes));
        }
      } catch (error) {
        // Fallback to store item if detail API fails.
        const fallbackInstitution = institutions.find((i) => i.id === institutionId);
        if (alive && fallbackInstitution) {
          form.setFieldsValue(buildInstitutionFormValues(fallbackInstitution));
        }
        if (alive) {
          setBranchOptions([]);
          setBatchOptions([]);
        }
      } finally {
        if (alive) {
          setLoading(false);
          setCreatePrincipal(false);
        }
      }
    };

    if (open) {
      const loadOptions = async () => {
        try {
          const [branchesResponse, batchesResponse] = await Promise.all([
            lookupService.getBranches(),
            lookupService.getBatches(),
          ]);

          if (!alive) return;

          const branches = normalizeLookupList(branchesResponse, 'branches');
          const batches = normalizeLookupList(batchesResponse, 'batches');

          setBranchOptions(branches.map((branch) => ({
            label: `${branch.name} (${branch.code})`,
            value: branch.id,
          })));
          setBatchOptions(batches.map((batch) => ({
            label: batch.name,
            value: batch.id,
          })));
        } catch (error) {
          if (alive) {
            setBranchOptions([]);
            setBatchOptions([]);
          }
        }
      };

      loadOptions();

      if (isEditMode) {
        loadInstitutionForEdit();
      } else {
        form.resetFields();
        form.setFieldsValue({
          country: "India",
          state: "Punjab", // Default or dynamic
          isActive: "true",
          type: "POLYTECHNIC",
          coveredAreaDetails: buildDefaultCoveredAreaRows(),
          branchIntakes: buildDefaultBranchIntakeRows(),
        });
        setCreatePrincipal(false);
      }
      setActiveFormTab('basic');
    }

    return () => {
      alive = false;
    };
  }, [open, institutionId, institutions, isEditMode, form]);

  const handleClose = () => {
    form.resetFields();
    setCreatePrincipal(false);
    setActiveFormTab('basic');
    onClose();
  };

  const onFinish = async (values) => {
    setSubmitting(true);
    try {
      // Normalize optional empty fields and ensure numeric fields are numbers.
      const payload = sanitizeInstitutionPayload(values);
      const intakePayload = sanitizeBranchIntakeRows(values.branchIntakes || []);

      if (isEditMode) {
        const updatedInstitution = await dispatch(updateInstitution({ id: institutionId, data: payload })).unwrap();
        const savedInstitutionId = updatedInstitution?.institution?.id || updatedInstitution?.id || institutionId;
        await stateService.replaceInstitutionBranchIntakes(savedInstitutionId, intakePayload);
        toast.success('Institution updated successfully');
      } else {
        const createdInstitution = await dispatch(createInstitution(payload)).unwrap();
        const savedInstitutionId = createdInstitution?.institution?.id || createdInstitution?.id;
        if (savedInstitutionId) {
          await stateService.replaceInstitutionBranchIntakes(savedInstitutionId, intakePayload);
        }
        toast.success('Institution created successfully');
      }
      
      handleClose();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Submission error:", error);
      toast.error(error.message || 'Failed to save institution');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={null}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={820}
      destroyOnHidden
      centered
      closable={false}
      className="rounded-2xl overflow-hidden"
      styles={{
        content: { borderRadius: '12px', padding: 0, overflow: 'hidden' },
        body: {
          padding: 0,
        },
        mask: { backdropFilter: 'blur(4px)' }
      }}
    >
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Spin size="large" />
        </div>
      ) : (
        <>
          <div className="bg-white px-4 py-2.5 border-b border-slate-200">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="bg-primary/10 p-1.5 rounded-md text-primary shrink-0">
                  {isEditMode ? <EditOutlined /> : <BankOutlined />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-800 mb-0 truncate">
                    {isEditMode ? 'Edit Institution' : 'Add New Institution'}
                  </h3>
                </div>
              </div>
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={handleClose}
                className="hover:bg-slate-100"
              />
            </div>
          </div>

          <div className="px-3 py-2 max-h-[calc(100vh-170px)] overflow-y-auto overflow-x-hidden">
            <style>{`
              .compact-institution-form .ant-form-item { margin-bottom: 8px; }
              .compact-institution-form .ant-tabs-nav { margin-bottom: 8px !important; }
              .compact-institution-form .ant-tabs-tab { padding-top: 4px; padding-bottom: 4px; }
              .compact-institution-form .ant-input,
              .compact-institution-form .ant-select-selector,
              .compact-institution-form .ant-picker { min-height: 32px !important; height: 32px !important; }
              .compact-institution-form textarea.ant-input { min-height: 56px !important; height: auto !important; }
            `}</style>
            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              requiredMark={false}
              size="small"
              className="institution-form compact-institution-form"
              style={{ margin: 0 }}
            >
          <Tabs
            activeKey={activeFormTab}
            onChange={setActiveFormTab}
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
            items={[
              {
                key: 'basic',
                label: (
                  <span
                    className={`inline-flex items-center gap-2 px-2 py-1 rounded-md border transition-all ${
                      activeFormTab === 'basic'
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <span
                      className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-semibold rounded-full ${
                        activeFormTab === 'basic'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      1
                    </span>
                    <span className="font-medium">Basic</span>
                  </span>
                ),
                children: (
                  <Row gutter={[10, 2]}>
                    <Col xs={24} md={12}>
                      <Form.Item name="type" label="Institution Type" rules={[{ required: true, message: 'Please select institution type' }]}>
                        <Select placeholder="Select type" className="h-10">
                          {institutionTypes.map((type) => (
                            <Option key={type} value={type}>{type.replace(/_/g, ' ')}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="code" label="Institution Code" rules={[{ required: true, message: 'Please enter institution code' }]}>
                        <Input placeholder="e.g. GPC-001" className="h-10 rounded-lg" />
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
                        <Input type="number" placeholder="0" min={0} className="h-10 rounded-lg" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="totalStaffSeats" label="Staff Capacity">
                        <Input type="number" placeholder="0" min={0} className="h-10 rounded-lg" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="isActive" label="Status" rules={[{ required: true }]}>
                        <Select className="h-10">
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
                label: (
                  <span
                    className={`inline-flex items-center gap-2 px-2 py-1 rounded-md border transition-all ${
                      activeFormTab === 'location'
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <span
                      className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-semibold rounded-full ${
                        activeFormTab === 'location'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      2
                    </span>
                    <span className="font-medium">Location</span>
                  </span>
                ),
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
                label: (
                  <span
                    className={`inline-flex items-center gap-2 px-2 py-1 rounded-md border transition-all ${
                      activeFormTab === 'land'
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <span
                      className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-semibold rounded-full ${
                        activeFormTab === 'land'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      3
                    </span>
                    <span className="font-medium">Land</span>
                  </span>
                ),
                children: (
                  <>
                    <Row gutter={[10, 2]}>
                      <Col xs={24} md={12}><Form.Item name="affiliatedTo" label="Affiliated To"><Input className="h-10 rounded-lg" /></Form.Item></Col>
                      <Col xs={24} md={12}><Form.Item name="recognizedBy" label="Recognized By"><Input className="h-10 rounded-lg" /></Form.Item></Col>
                      <Col xs={24} md={8}><Form.Item name="totalLandAcres" label="Total Land (Acres)"><Input type="number" min={0} step="any" className="h-10 rounded-lg" /></Form.Item></Col>
                      <Col xs={24} md={8}><Form.Item name="landOwnership" label="Land Ownership"><Select allowClear options={LAND_OWNERSHIP_OPTIONS} className="h-10" /></Form.Item></Col>
                      <Col xs={24} md={8}><Form.Item name="hasLandDispute" label="Any Land Dispute"><Select allowClear className="h-10" options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} /></Form.Item></Col>
                    </Row>
                    <Form.List name="coveredAreaDetails">
                      {(fields) => {
                        const tableColumns = [
                          { title: 'Entity', width: 140, render: (_, __, index) => <Form.Item name={[index, 'entityType']} className="mb-0"><Select disabled options={COVERED_AREA_ENTITIES} /></Form.Item> },
                          { title: 'Rooms', width: 100, render: (_, __, index) => <Form.Item name={[index, 'numberOfRooms']} className="mb-0"><Input type="number" min={0} /></Form.Item> },
                          { title: 'Required', width: 110, render: (_, __, index) => <Form.Item name={[index, 'requiredAreaSqFt']} className="mb-0"><Input type="number" min={0} step="any" /></Form.Item> },
                          { title: 'Available', width: 110, render: (_, __, index) => <Form.Item name={[index, 'availableAreaSqFt']} className="mb-0"><Input type="number" min={0} step="any" /></Form.Item> },
                          { title: 'Additional', width: 120, render: (_, __, index) => <Form.Item name={[index, 'additionalRequirementSqFt']} className="mb-0"><Input type="number" min={0} step="any" /></Form.Item> },
                          { title: 'Unsafe', width: 100, render: (_, __, index) => <Form.Item name={[index, 'declaredUnsafeAreaSqFt']} className="mb-0"><Input type="number" min={0} step="any" /></Form.Item> },
                          { title: 'Last Repair Date', width: 160, render: (_, __, index) => <Form.Item name={[index, 'lastMajorRepairDate']} className="mb-0"><DatePicker className="w-full" format="DD-MM-YYYY" /></Form.Item> },
                          { title: 'Future Expansion', width: 190, render: (_, __, index) => <Form.Item name={[index, 'futureExpansionScope']} className="mb-0"><Input placeholder="Optional" /></Form.Item> },
                        ];
                        return <Table size="small" bordered pagination={false} scroll={{ x: 1030 }} columns={tableColumns} dataSource={fields.map((field) => ({ key: field.key }))} />;
                      }}
                    </Form.List>
                  </>
                ),
              },
              {
                key: 'intake',
                label: (
                  <span
                    className={`inline-flex items-center gap-2 px-2 py-1 rounded-md border transition-all ${
                      activeFormTab === 'intake'
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <span
                      className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-semibold rounded-full ${
                        activeFormTab === 'intake'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      4
                    </span>
                    <span className="font-medium">Intake</span>
                  </span>
                ),
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
                              <Form.Item
                                name={[index, 'branchId']}
                                className="mb-0"
                                rules={[{ required: true, message: 'Select a branch' }]}
                              >
                                <Select
                                  showSearch
                                  optionFilterProp="label"
                                  placeholder="Select branch"
                                  options={branchOptions}
                                />
                              </Form.Item>
                            ),
                          },
                          {
                            title: 'Academic Year',
                            width: 150,
                            render: (_, __, index) => (
                              <Form.Item
                                name={[index, 'academicYear']}
                                className="mb-0"
                                rules={[{ required: true, message: 'Enter academic year' }]}
                              >
                                <Input placeholder="2026-27" />
                              </Form.Item>
                            ),
                          },
                          {
                            title: 'Batch',
                            width: 180,
                            render: (_, __, index) => (
                              <Form.Item name={[index, 'batchId']} className="mb-0">
                                <Select
                                  allowClear
                                  showSearch
                                  optionFilterProp="label"
                                  placeholder="Optional batch"
                                  options={batchOptions}
                                />
                              </Form.Item>
                            ),
                          },
                          {
                            title: 'Sanctioned',
                            width: 120,
                            render: (_, __, index) => (
                              <Form.Item
                                name={[index, 'sanctionedSeats']}
                                className="mb-0"
                                rules={[{ required: true, message: 'Enter seats' }]}
                              >
                                <Input type="number" min={0} placeholder="0" />
                              </Form.Item>
                            ),
                          },
                          {
                            title: 'Fee Waiver',
                            width: 120,
                            render: (_, __, index) => (
                              <Form.Item
                                name={[index, 'feeWaiverSeats']}
                                className="mb-0"
                                rules={[{ required: true, message: 'Enter fee waiver seats' }]}
                              >
                                <Input type="number" min={0} placeholder="0" />
                              </Form.Item>
                            ),
                          },
                          {
                            title: 'Active',
                            width: 90,
                            render: (_, __, index) => (
                              <Form.Item name={[index, 'isActive']} className="mb-0" valuePropName="checked">
                                <Checkbox />
                              </Form.Item>
                            ),
                          },
                          {
                            title: 'Actions',
                            width: 90,
                            render: (_, __, index) => (
                              <Button
                                danger
                                type="text"
                                size="small"
                                onClick={() => remove(index)}
                                disabled={fields.length === 1}
                              >
                                Remove
                              </Button>
                            ),
                          },
                        ];

                        return (
                          <div className="space-y-2">
                            <div className="flex justify-end">
                              <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({
                                branchId: undefined,
                                batchId: undefined,
                                academicYear: getDefaultAcademicYear(),
                                sanctionedSeats: 0,
                                feeWaiverSeats: 0,
                                isActive: true,
                              })}>
                                Add Intake Row
                              </Button>
                            </div>
                            <Table
                              size="small"
                              bordered
                              pagination={false}
                              scroll={{ x: 980 }}
                              columns={tableColumns}
                              dataSource={fields.map((field) => ({ key: field.key }))}
                            />
                          </div>
                        );
                      }}
                    </Form.List>
                  </div>
                ),
              },
              ...(!isEditMode
                ? [{
                    key: 'principal',
                    label: (
                      <span
                        className={`inline-flex items-center gap-2 px-2 py-1 rounded-md border transition-all ${
                          activeFormTab === 'principal'
                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <span
                          className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-semibold rounded-full ${
                            activeFormTab === 'principal'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          5
                        </span>
                        <span className="font-medium">Principal</span>
                      </span>
                    ),
                    children: (
                      <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                        <Form.Item className="mb-0">
                          <Checkbox checked={createPrincipal} onChange={(e) => setCreatePrincipal(e.target.checked)} className="font-semibold text-text-primary">
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
            ]}
          />

          <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-border/60 bg-background-primary">
            <Button
              onClick={handleClose}
              className="h-8 px-3 rounded-lg font-medium hover:bg-surface-hover"
            >
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              icon={isEditMode ? <SaveOutlined /> : <PlusOutlined />}
              className="h-8 px-3 rounded-lg font-bold shadow-lg shadow-primary/20"
            >
              {isEditMode ? 'Update Institution' : 'Create Institution'}
            </Button>
          </div>
            </Form>
          </div>
        </>
      )}
    </Modal>
  );
};

export default InstitutionModal;
