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
  const [selectedForm, setSelectedForm] = useState(null);
  const [responsesData, setResponsesData] = useState([]);
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [questions, setQuestions] = useState([]);
  const [form] = Form.useForm();

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
      const data = await trainingAdminService.getFeedbackResponses(record.id);
      // Data is in aggregated format: { form, totalResponses, aggregated }
      setResponsesData(data || { totalResponses: 0, aggregated: {} });
    } catch (error) {
      message.error('Failed to load responses');
      setResponsesData({ totalResponses: 0, aggregated: {} });
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

  const searchResultCount = searchText ? filteredForms.length : null;

  return (
    <div className="p-4 training-ui">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        <div>
          <Title level={4} className="!mb-0.5 text-lg">
            Feedback Forms
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
              pagination={{ pageSize: 10, size: 'small' }}
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

      {/* Responses Modal - Aggregated View */}
      <Modal
        open={responsesModalOpen}
        onCancel={() => setResponsesModalOpen(false)}
        footer={null}
        width={700}
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
                      {responsesData?.form?.title || selectedForm.title}
                    </h3>
                    <div className="flex items-center gap-2.5 text-xs text-slate-600">
                      <span>
                        <strong className="text-slate-800">{responsesData?.totalResponses || 0}</strong> responses
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
                  className="hover:bg-slate-100 flex-shrink-0"
                />
              </div>
            </div>

            {/* Aggregated Responses */}
            <div className="p-4 max-h-[70vh] overflow-y-auto">
              {responsesLoading ? (
                <div className="text-center py-12">
                  <Text type="secondary">Loading responses...</Text>
                </div>
              ) : responsesData?.totalResponses > 0 ? (
                <div className="space-y-4">
                  {Object.entries(responsesData?.aggregated || {}).map(([questionId, data], index) => (
                    <div key={questionId} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-start gap-2 mb-3">
                        <span className="text-xs font-medium text-slate-500 bg-white px-1.5 py-0.5 rounded border">
                          Q{index + 1}
                        </span>
                        <div className="flex-1">
                          <span className="text-sm font-medium text-slate-800">
                            {data.question}
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <Tag className="text-[10px]">{data.type}</Tag>
                            <span className="text-xs text-slate-500">
                              {data.totalResponses} responses
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Rating Type - Show Distribution */}
                      {data.type === 'rating' && (
                        <div className="mt-3">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-2xl font-bold text-blue-600">
                              {data.average?.toFixed(1) || '0.0'}
                            </span>
                            <span className="text-xs text-slate-500">/ 5 average</span>
                          </div>
                          <div className="space-y-1.5">
                            {[5, 4, 3, 2, 1].map((rating) => {
                              const count = data.distribution?.[rating] || 0;
                              const percentage = data.totalResponses > 0
                                ? (count / data.totalResponses) * 100
                                : 0;
                              return (
                                <div key={rating} className="flex items-center gap-2">
                                  <span className="text-xs text-slate-600 w-3">{rating}</span>
                                  <div className="flex-1 h-4 bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-blue-500 rounded-full transition-all"
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-slate-500 w-8 text-right">{count}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Text Type - Show Responses */}
                      {data.type === 'text' && (
                        <div className="mt-3">
                          {data.responses?.length > 0 ? (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {data.responses.map((response, idx) => (
                                <div
                                  key={idx}
                                  className="p-2 bg-white rounded border border-slate-200 text-xs text-slate-700"
                                >
                                  "{response}"
                                </div>
                              ))}
                            </div>
                          ) : (
                            <Text type="secondary" className="text-xs">No text responses</Text>
                          )}
                        </div>
                      )}

                      {/* MultiChoice/Checkbox - Show Distribution */}
                      {(data.type === 'multiChoice' || data.type === 'checkbox') && data.distribution && (
                        <div className="mt-3 space-y-1.5">
                          {Object.entries(data.distribution).map(([option, count]) => {
                            const percentage = data.totalResponses > 0
                              ? (count / data.totalResponses) * 100
                              : 0;
                            return (
                              <div key={option} className="flex items-center gap-2">
                                <span className="text-xs text-slate-600 truncate flex-1 max-w-[150px]" title={option}>
                                  {option}
                                </span>
                                <div className="flex-1 h-4 bg-slate-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-emerald-500 rounded-full transition-all"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                <span className="text-xs text-slate-500 w-12 text-right">
                                  {count} ({percentage.toFixed(0)}%)
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Yes/No Type */}
                      {data.type === 'yesNo' && data.distribution && (
                        <div className="mt-3 flex gap-4">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                            <span className="text-xs text-slate-600">Yes: {data.distribution.yes || 0}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            <span className="text-xs text-slate-600">No: {data.distribution.no || 0}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
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
    </div>
  );
};

export default FeedbackFormManagementPage;
