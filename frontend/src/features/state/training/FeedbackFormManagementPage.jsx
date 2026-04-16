import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Col, Form, Input, Modal, Row, Select, Switch, Table, Tag, Tooltip, Typography, message } from 'antd';
import { FileTextOutlined, PlusOutlined, CheckCircleOutlined, ArrowUpOutlined, ArrowDownOutlined, EditOutlined, DeleteOutlined, EyeOutlined, MinusCircleOutlined, PlusCircleOutlined, SearchOutlined } from '@ant-design/icons';
import InputNumber from 'antd/es/input-number';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';
import { TrainingStatSkeleton, TableRowSkeleton } from '../../../components/training/skeletons/TrainingSkeletons';
import {
  fetchStateFeedbackForms,
  createStateFeedbackForm,
  updateStateFeedbackForm,
  deleteStateFeedbackForm,
  publishStateFeedbackForm,
} from '../store/stateTrainingSlice';
import trainingAdminService from '../../../services/training-admin.service';

const { Text, Title } = Typography;

const STAT_TONES = {
  primary: { icon: 'bg-blue-100 text-blue-700', card: 'bg-gradient-to-br from-blue-50 via-white to-slate-50' },
  success: { icon: 'bg-emerald-100 text-emerald-700', card: 'bg-gradient-to-br from-emerald-50 via-white to-slate-50' },
  warning: { icon: 'bg-amber-100 text-amber-700', card: 'bg-gradient-to-br from-amber-50 via-white to-slate-50' },
  secondary: { icon: 'bg-slate-100 text-slate-700', card: 'bg-gradient-to-br from-slate-50 via-white to-blue-50' },
};

const StatCard = ({ icon: Icon, title, value, subtitle, tone, trend, onClick }) => {
  const styles = STAT_TONES[tone] || STAT_TONES.primary;
  const hasTrend = trend !== undefined && trend !== null;
  const isPositiveTrend = hasTrend && trend >= 0;

  return (
    <Card
      className={`rounded-xl border-border shadow-none ${onClick ? 'cursor-pointer hover:shadow-md' : ''} transition-shadow h-full ${styles.card}`}
      onClick={onClick}
      styles={{ body: { padding: '16px' } }}
    >
      <div className="flex items-start justify-between">
        <div>
          <Text className="text-text-secondary text-xs block mb-1">{title}</Text>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text-primary">{value}</span>
            {hasTrend && (
              <span className={`flex items-center text-xs font-medium ${isPositiveTrend ? 'text-emerald-600' : 'text-red-600'}`}>
                {isPositiveTrend ? <ArrowUpOutlined className="mr-0.5" /> : <ArrowDownOutlined className="mr-0.5" />}
                {Math.abs(trend)}%
              </span>
            )}
          </div>
          {subtitle && <Text type="secondary" className="text-xs">{subtitle}</Text>}
        </div>
        {Icon && (
          <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${styles.icon}`}>
            <Icon className="text-lg" />
          </div>
        )}
      </div>
    </Card>
  );
};

const FeedbackFormManagementPage = () => {
  const dispatch = useDispatch();
  const { feedbackForms } = useSelector((state) => state.stateTraining);
  const { user } = useSelector((state) => state.auth);
  const [modalOpen, setModalOpen] = useState(false);
  const [responsesModalOpen, setResponsesModalOpen] = useState(false);
  const [responseDetailOpen, setResponseDetailOpen] = useState(false);
  const [selectedForm, setSelectedForm] = useState(null);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [responsesData, setResponsesData] = useState([]);
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [formsPagination, setFormsPagination] = useState({ current: 1, pageSize: 10 });
  const [responsesPagination, setResponsesPagination] = useState({ current: 1, pageSize: 10 });
  const [questions, setQuestions] = useState([]);
  const [form] = Form.useForm();

  const responseTrainingFilters = useMemo(() => {
    const uniqueTrainings = new Set(
      (responsesData || [])
        .map((item) => item?.training?.title)
        .filter(Boolean),
    );

    return Array.from(uniqueTrainings).map((value) => ({
      text: value,
      value,
    }));
  }, [responsesData]);

  const responseTeacherFilters = useMemo(() => {
    const uniqueTeachers = new Set(
      (responsesData || [])
        .map((item) => item?.user?.name)
        .filter(Boolean),
    );

    return Array.from(uniqueTeachers).map((value) => ({
      text: value,
      value,
    }));
  }, [responsesData]);

  const responseColumns = useMemo(
    () => [
      {
        title: 'Faculty',
        key: 'faculty',
        width: 200,
        filters: responseTeacherFilters,
        onFilter: (value, record) =>
          (record?.user?.name || '').toLowerCase().includes(String(value).toLowerCase()),
        render: (_, record) => (
          <div>
            <div className="font-medium text-slate-800 text-xs">{record.user?.name || 'Unknown'}</div>
            <div className="text-[10px] text-slate-500">{record.user?.email || '-'}</div>
          </div>
        ),
      },
      {
        title: 'Institution',
        key: 'institution',
        width: 160,
        render: (_, record) => (
          <div className="text-xs text-slate-700 truncate" title={record.user?.Institution?.name}>
            {record.user?.Institution?.shortName || record.user?.Institution?.name || 'N/A'}
          </div>
        ),
      },
      {
        title: 'Training',
        key: 'training',
        width: 220,
        filters: responseTrainingFilters,
        onFilter: (value, record) =>
          (record?.training?.title || '').toLowerCase().includes(String(value).toLowerCase()),
        render: (_, record) => (
          <div className="text-xs text-slate-700 truncate" title={record.training?.title}>
            {record.training?.title || 'N/A'}
          </div>
        ),
      },
      {
        title: 'Answered',
        key: 'answered',
        width: 90,
        render: (_, record) => (
          <span className="text-xs text-slate-600">
            {Object.keys(record?.responses || {}).length}
          </span>
        ),
      },
      {
        title: 'Submitted',
        dataIndex: 'submittedAt',
        key: 'submittedAt',
        width: 120,
        render: (value) => (
          <span className="text-xs text-slate-600">
            {value ? new Date(value).toLocaleDateString() : '-'}
          </span>
        ),
      },
      {
        title: 'Action',
        key: 'action',
        width: 80,
        render: (_, record) => (
          <Button
            size="small"
            type="link"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedResponse(record);
              setResponseDetailOpen(true);
            }}
            className="text-xs"
          >
            View
          </Button>
        ),
      },
    ],
    [responseTeacherFilters, responseTrainingFilters],
  );

  const QUESTION_TYPES = [
    { value: 'rating', label: 'Rating (1-5 stars)' },
    { value: 'multiChoice', label: 'Multiple Choice' },
    { value: 'checkbox', label: 'Checkbox (Multi-select)' },
    { value: 'yesNo', label: 'Yes/No' },
    { value: 'text', label: 'Text Answer' },
  ];

  useEffect(() => {
    dispatch(fetchStateFeedbackForms());
  }, [dispatch]);

  const isLoading = feedbackForms.loading && !feedbackForms.list;

  const createEmptyQuestion = () => ({
    id: `q${Date.now()}`,
    type: 'rating',
    question: '',
    required: true,
    options: { min: 1, max: 5 },
  });

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setQuestions([createEmptyQuestion()]);
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      title: record.title,
      description: record.description,
      purpose: record.purpose,
    });
    setQuestions(record.questions || [createEmptyQuestion()]);
    setModalOpen(true);
  };

  const addQuestion = () => {
    setQuestions([...questions, createEmptyQuestion()]);
  };

  const removeQuestion = (index) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const updateQuestion = (index, field, value) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };

    // Reset options when type changes
    if (field === 'type') {
      if (value === 'rating') {
        updated[index].options = { min: 1, max: 5 };
      } else if (value === 'multiChoice' || value === 'checkbox') {
        updated[index].options = { choices: ['', ''] };
      } else {
        updated[index].options = null;
      }
    }
    setQuestions(updated);
  };

  const addOption = (questionIndex) => {
    const updated = [...questions];
    updated[questionIndex].options.choices.push('');
    setQuestions(updated);
  };

  const removeOption = (questionIndex, optionIndex) => {
    const updated = [...questions];
    if (updated[questionIndex].options.choices.length > 2) {
      updated[questionIndex].options.choices.splice(optionIndex, 1);
      setQuestions(updated);
    }
  };

  const updateOption = (questionIndex, optionIndex, value) => {
    const updated = [...questions];
    updated[questionIndex].options.choices[optionIndex] = value;
    setQuestions(updated);
  };

  const handleViewResponses = async (record) => {
    setSelectedForm(record);
    setResponsesLoading(true);
    setResponsesModalOpen(true);

    try {
      const formDetails = await trainingAdminService.getFeedbackForm(record.id);
      const trainings = Array.isArray(formDetails?.trainings) ? formDetails.trainings : [];

      if (!trainings.length) {
        setResponsesData([]);
        return;
      }

      const trainingResponses = await Promise.all(
        trainings.map(async (training) => {
          const response = await trainingAdminService.getTrainingFeedbackResponses(training.id);
          const list = Array.isArray(response) ? response : response?.responses || [];

          return list
            .filter(
              (item) =>
                item?.feedbackForm?.id === record.id || item?.feedbackFormId === record.id,
            )
            .map((item) => ({
              ...item,
              training: item.training || { id: training.id, title: training.title },
            }));
        }),
      );

      setResponsesData(trainingResponses.flat());
    } catch (error) {
      message.error('Failed to load responses');
      setResponsesData([]);
    } finally {
      setResponsesLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      // Validate questions
      const validQuestions = questions.filter(q => q.question.trim());
      if (validQuestions.length === 0) {
        message.error('Please add at least one question');
        return;
      }

      // Clean up questions for storage
      const cleanedQuestions = validQuestions.map((q, idx) => ({
        id: q.id || `q${idx + 1}`,
        type: q.type,
        question: q.question.trim(),
        required: q.required,
        options: q.type === 'rating'
          ? { min: q.options?.min || 1, max: q.options?.max || 5 }
          : q.options?.choices?.filter(c => c.trim()).length > 0
            ? { choices: q.options.choices.filter(c => c.trim()) }
            : null,
      }));

      const payload = {
        title: values.title,
        description: values.description,
        purpose: values.purpose,
        questions: cleanedQuestions,
      };

      if (editing) {
        await dispatch(updateStateFeedbackForm({ id: editing.id, data: payload })).unwrap();
        message.success('Feedback form updated');
      } else {
        await dispatch(createStateFeedbackForm({ ...payload, publish: !!values.publish })).unwrap();
        message.success('Feedback form created');
      }
      setModalOpen(false);
    } catch (error) {
      message.error(error || 'Failed to save feedback form');
    }
  };

  const handlePublish = async (id) => {
    try {
      await dispatch(publishStateFeedbackForm(id)).unwrap();
      message.success('Feedback form published');
    } catch (error) {
      message.error(error || 'Failed to publish feedback form');
    }
  };

  const handleDelete = async (id) => {
    try {
      await dispatch(deleteStateFeedbackForm(id)).unwrap();
      message.success('Feedback form deleted');
    } catch (error) {
      message.error(error || 'Failed to delete feedback form');
    }
  };

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (text) => <span className="font-medium text-slate-800">{text}</span>,
    },
    {
      title: 'Purpose',
      dataIndex: 'purpose',
      key: 'purpose',
      render: (value) => value ? <Tag className="text-xs">{value}</Tag> : <Text type="secondary" className="text-xs">-</Text>,
    },
    {
      title: 'Responses',
      dataIndex: '_count',
      key: 'responses',
      render: (count) => <span className="text-sm">{count?.responses || 0}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'isPublished',
      key: 'isPublished',
      render: (value) => value
        ? <Tag color="green" icon={<CheckCircleOutlined />} className="text-xs">Published</Tag>
        : <Tag color="orange" className="text-xs">Draft</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 220,
      render: (_, record) => (
        <div className="flex gap-2">
          <Tooltip title="View Responses">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewResponses(record)}
            />
          </Tooltip>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          >
            Edit
          </Button>
          {!record.isPublished && (
            <Button
              size="small"
              type="primary"
              ghost
              onClick={() => handlePublish(record.id)}
            >
              Publish
            </Button>
          )}
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          />
        </div>
      ),
    },
  ];

  const stats = useMemo(() => {
    const list = feedbackForms.list || [];
    return {
      total: list.length,
      published: list.filter((item) => item.isPublished).length,
    };
  }, [feedbackForms.list]);

  const filteredForms = useMemo(() => {
    if (!searchText) return feedbackForms.list || [];
    const search = searchText.toLowerCase();
    return (feedbackForms.list || []).filter((item) =>
      (item.title || '').toLowerCase().includes(search) ||
      (item.purpose || '').toLowerCase().includes(search)
    );
  }, [feedbackForms.list, searchText]);

  useEffect(() => {
    setFormsPagination((prev) => ({ ...prev, current: 1 }));
  }, [searchText]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredForms.length / formsPagination.pageSize));
    if (formsPagination.current > maxPage) {
      setFormsPagination((prev) => ({ ...prev, current: maxPage }));
    }
  }, [filteredForms.length, formsPagination.current, formsPagination.pageSize]);

  useEffect(() => {
    setResponsesPagination((prev) => ({ ...prev, current: 1 }));
  }, [responsesData.length, responsesModalOpen]);

  const searchResultCount = searchText ? filteredForms.length : null;

  return (
    <div className="p-4 training-ui">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        <div>
          <Title level={4} className="mb-0.5! text-lg">
            Manage Feedback
          </Title>
          <Text type="secondary" className="text-xs">Manage evaluation and feedback surveys</Text>
        </div>
        <Button type="primary" size="middle" icon={<PlusOutlined />} onClick={openCreate}>
          New Form
        </Button>
      </div>

      {/* Forms Table */}
      <Card className="rounded-xl border-border shadow-none" styles={{ body: { padding: '12px' } }}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <Input
              placeholder="Search forms..."
              prefix={<SearchOutlined className="text-slate-400" />}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              className="lg:w-80"
              size="middle"
              allowClear
            />
            {searchResultCount !== null && (
              <Text type="secondary" className="text-xs">
                {searchResultCount} result{searchResultCount !== 1 ? 's' : ''}
              </Text>
            )}
          </div>
        </div>
        {isLoading ? (
          <TableRowSkeleton rows={5} columns={4} />
        ) : filteredForms.length > 0 ? (
          <div className="custom-scrollbar overflow-x-auto">
            <Table
              className="custom-table"
              rowKey="id"
              columns={columns}
              dataSource={filteredForms}
              loading={feedbackForms.loading}
              size="small"
              pagination={{
                current: formsPagination.current,
                pageSize: formsPagination.pageSize,
                total: filteredForms.length,
                size: 'small',
                showSizeChanger: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
              }}
              onChange={(pagination) => {
                setFormsPagination({
                  current: pagination.current,
                  pageSize: pagination.pageSize,
                });
              }}
              scroll={{ x: 'max-content' }}
            />
          </div>
        ) : (
          <TrainingEmptyState
            type={searchText ? 'search' : 'feedback'}
            message={searchText ? 'No forms found' : 'No forms yet'}
            description={searchText ? 'Try adjusting your search.' : 'Create your first feedback form.'}
            actionText={searchText ? 'Clear Search' : 'Create Form'}
            onAction={searchText ? () => setSearchText('') : openCreate}
          />
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={700}
        centered
        destroyOnClose
        closable={false}
        styles={{
          body: { padding: 0 },
          content: { borderRadius: 12 },
        }}
      >
        <div className="bg-white px-5 py-3 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-lg border-2 border-blue-600 flex items-center justify-center shrink-0">
                <FileTextOutlined className="text-blue-600 text-base" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-800 mb-0.5 truncate">
                  {editing ? 'Edit Feedback Form' : 'Create Feedback Form'}
                </h3>
                <Text className="text-xs text-slate-600 block truncate">
                  {editing ? 'Update form configuration' : 'Configure new feedback form'}
                </Text>
              </div>
            </div>
            <Button
              type="text"
              size="small"
              icon={<span className="text-xl text-slate-400 hover:text-slate-600">×</span>}
              onClick={() => setModalOpen(false)}
              className="hover:bg-slate-100 shrink-0"
            />
          </div>
        </div>
        <div className="p-4">
          <Form layout="vertical" form={form} size="small">
            <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Please enter form title' }]}>
              <Input placeholder="e.g., Training Feedback Survey" />
            </Form.Item>
            <Form.Item name="description" label="Description">
              <Input.TextArea rows={2} placeholder="Describe the purpose of this feedback form..." />
            </Form.Item>
            <Row gutter={12}>
              <Col xs={24} sm={12}>
                <Form.Item name="purpose" label="Purpose">
                  <Select
                    allowClear
                    placeholder="Select purpose"
                    options={[
                      { value: 'TRAINING', label: 'Training' },
                      { value: 'GENERAL', label: 'General' },
                      { value: 'SURVEY', label: 'Survey' },
                      { value: 'EVALUATION', label: 'Evaluation' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                {!editing ? (
                  <Form.Item name="publish" label="Publish Immediately" valuePropName="checked">
                    <Switch checkedChildren="Yes" unCheckedChildren="No" />
                  </Form.Item>
                ) : (
                  <Form.Item label="Publish">
                    <Text type="secondary" className="text-xs">
                      Use the Publish button from the table after saving changes.
                    </Text>
                  </Form.Item>
                )}
              </Col>
            </Row>
            {/* Question Builder */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-slate-700">
                  Questions <span className="text-red-500">*</span>
                </label>
                <Button
                  type="dashed"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={addQuestion}
                >
                  Add Question
                </Button>
              </div>

              <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-1">
                {questions.map((q, qIndex) => (
                  <div
                    key={q.id}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div className="flex items-start gap-2 mb-3">
                      <span className="text-xs font-semibold text-slate-500 bg-white px-2 py-1 rounded border mt-1">
                        Q{qIndex + 1}
                      </span>
                      <div className="flex-1 space-y-2">
                        <Input
                          placeholder="Enter your question..."
                          value={q.question}
                          onChange={(e) => updateQuestion(qIndex, 'question', e.target.value)}
                          size="small"
                        />
                        <Row gutter={8}>
                          <Col span={10}>
                            <Select
                              size="small"
                              className="w-full"
                              value={q.type}
                              onChange={(val) => updateQuestion(qIndex, 'type', val)}
                              options={QUESTION_TYPES}
                            />
                          </Col>
                          <Col span={8}>
                            <div className="flex items-center h-full">
                              <Switch
                                size="small"
                                checked={q.required}
                                onChange={(val) => updateQuestion(qIndex, 'required', val)}
                              />
                              <span className="text-xs text-slate-500 ml-1">Required</span>
                            </div>
                          </Col>
                          <Col span={6} className="text-right">
                            <Button
                              size="small"
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => removeQuestion(qIndex)}
                              disabled={questions.length === 1}
                            />
                          </Col>
                        </Row>
                      </div>
                    </div>

                    {/* Options for multiChoice and checkbox */}
                    {(q.type === 'multiChoice' || q.type === 'checkbox') && (
                      <div className="ml-8 mt-2 space-y-2">
                        <div className="text-xs text-slate-500 mb-1">Options</div>
                        {q.options?.choices?.map((opt, optIndex) => (
                          <div key={optIndex} className="flex items-center gap-2">
                            <Input
                              size="small"
                              placeholder={`Option ${optIndex + 1}`}
                              value={opt}
                              onChange={(e) => updateOption(qIndex, optIndex, e.target.value)}
                              className="flex-1"
                            />
                            <Button
                              size="small"
                              type="text"
                              icon={<MinusCircleOutlined />}
                              onClick={() => removeOption(qIndex, optIndex)}
                              disabled={q.options.choices.length <= 2}
                              className="text-slate-400 hover:text-red-500"
                            />
                          </div>
                        ))}
                        <Button
                          type="dashed"
                          size="small"
                          icon={<PlusCircleOutlined />}
                          onClick={() => addOption(qIndex)}
                          className="w-full mt-1"
                        >
                          Add Option
                        </Button>
                      </div>
                    )}

                    {/* Rating scale options */}
                    {q.type === 'rating' && (
                      <div className="ml-8 mt-2 flex items-center gap-3">
                        <span className="text-xs text-slate-500">Scale:</span>
                        <InputNumber
                          size="small"
                          min={1}
                          max={5}
                          value={q.options?.min || 1}
                          onChange={(val) => {
                            const updated = [...questions];
                            updated[qIndex].options = { ...updated[qIndex].options, min: val };
                            setQuestions(updated);
                          }}
                          className="w-16"
                        />
                        <span className="text-xs text-slate-500">to</span>
                        <InputNumber
                          size="small"
                          min={1}
                          max={10}
                          value={q.options?.max || 5}
                          onChange={(val) => {
                            const updated = [...questions];
                            updated[qIndex].options = { ...updated[qIndex].options, max: val };
                            setQuestions(updated);
                          }}
                          className="w-16"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Button onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="primary" onClick={handleSave} loading={feedbackForms.loading}>
                {editing ? 'Update Form' : 'Create Form'}
              </Button>
            </div>
          </Form>
        </div>
      </Modal>

      {/* Responses Modal */}
      <Modal
        open={responsesModalOpen}
        onCancel={() => setResponsesModalOpen(false)}
        footer={null}
        width={980}
        centered
        closable={false}
        styles={{
          body: { padding: 0 },
          content: { borderRadius: 12 },
        }}
      >
        {selectedForm && (
          <>
            {/* Header */}
            <div className="bg-white px-5 py-3 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-lg border-2 border-amber-600 flex items-center justify-center shrink-0">
                    <FileTextOutlined className="text-amber-600 text-base" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-slate-800 mb-1 truncate">
                      {selectedForm.title}
                    </h3>
                    <div className="flex items-center gap-2.5 text-xs text-slate-600">
                      <span>
                        <strong className="text-slate-800">{responsesData.length}</strong> responses
                      </span>
                      <span>•</span>
                      <span>Purpose: <strong className="text-slate-800">{selectedForm.purpose || 'General'}</strong></span>
                    </div>
                  </div>
                </div>
                <Button
                  type="text"
                  size="small"
                  icon={<span className="text-xl text-slate-400 hover:text-slate-600">&times;</span>}
                  onClick={() => setResponsesModalOpen(false)}
                  className="hover:bg-slate-100 shrink-0"
                />
              </div>
            </div>

            {/* Responses Table */}
            <div className="p-3">
              {responsesLoading ? (
                <div className="text-center py-12">
                  <Text type="secondary">Loading responses...</Text>
                </div>
              ) : responsesData.length > 0 ? (
                <div className="custom-scrollbar overflow-x-auto">
                  <Table
                    className="custom-table"
                    rowKey="id"
                    columns={responseColumns}
                    dataSource={responsesData}
                    pagination={{
                      current: responsesPagination.current,
                      pageSize: responsesPagination.pageSize,
                      total: responsesData.length,
                      size: 'small',
                      showSizeChanger: true,
                      showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
                    }}
                    onChange={(pagination) => {
                      setResponsesPagination({
                        current: pagination.current,
                        pageSize: pagination.pageSize,
                      });
                    }}
                    size="small"
                    scroll={{ x:  'max-content' }}
                  />
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-slate-300 mb-2">
                    <FileTextOutlined style={{ fontSize: 48 }} />
                  </div>
                  <Text className="text-slate-500">No responses yet</Text>
                </div>
              )}
            </div>
          </>
        )}
      </Modal>

      {/* Response Detail Modal */}
      <Modal
        open={responseDetailOpen}
        onCancel={() => setResponseDetailOpen(false)}
        footer={null}
        width={620}
        centered
        closable={false}
        styles={{
          body: { padding: 0 },
          content: { borderRadius: 12 },
        }}
      >
        {selectedResponse && (
          <>
            <div className="bg-white px-5 py-3 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-lg border-2 border-blue-600 flex items-center justify-center shrink-0">
                    <FileTextOutlined className="text-blue-600 text-base" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-slate-800 mb-0.5 truncate">
                      {selectedResponse.user?.name || 'Unknown'}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <span>{selectedResponse.user?.email || '-'}</span>
                      <span>•</span>
                      <span>{selectedResponse.training?.title || 'N/A'}</span>
                    </div>
                  </div>
                </div>
                <Button
                  type="text"
                  size="small"
                  icon={<span className="text-xl text-slate-400 hover:text-slate-600">&times;</span>}
                  onClick={() => setResponseDetailOpen(false)}
                  className="hover:bg-slate-100 shrink-0"
                />
              </div>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg text-xs mb-4">
                <div>
                  <span className="text-slate-500">Institution:</span>
                  <div className="font-medium text-slate-800">
                    {selectedResponse.user?.Institution?.name || 'N/A'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Submitted:</span>
                  <div className="font-medium text-slate-800">
                    {selectedResponse.submittedAt
                      ? new Date(selectedResponse.submittedAt).toLocaleString()
                      : 'N/A'}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-3">Responses</h4>
                <div className="space-y-3">
                  {(selectedForm?.questions || []).map((question, index) => {
                    const answer = selectedResponse.responses?.[question.id];

                    return (
                      <div
                        key={question.id || index}
                        className="p-3 bg-white border border-slate-200 rounded-lg"
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            Q{index + 1}
                          </span>
                          <span className="text-sm text-slate-700 flex-1">
                            {question.question}
                          </span>
                        </div>
                        <div className="ml-6">
                          <span className="text-xs text-slate-500">Answer: </span>
                          <span className="text-sm font-medium text-slate-800">
                            {Array.isArray(answer)
                              ? answer.join(', ')
                              : answer !== undefined && answer !== null && String(answer).trim() !== ''
                                ? String(answer)
                                : '-'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default FeedbackFormManagementPage;
