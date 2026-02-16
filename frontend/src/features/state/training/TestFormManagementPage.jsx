import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  FileTextOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  CheckCircleFilled,
  ArrowUpOutlined,
  ArrowDownOutlined,
  EditOutlined,
  DeleteOutlined,
  FormOutlined,
  EyeOutlined,
  CloseCircleOutlined,
  MinusCircleOutlined,
  PlusCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import TrainingEmptyState from "../../../components/training/TrainingEmptyState";
import {
  TrainingStatSkeleton,
  TableRowSkeleton,
} from "../../../components/training/skeletons/TrainingSkeletons";
import {
  fetchStatePreTestForms,
  fetchStatePostTestForms,
  createStatePreTestForm,
  createStatePostTestForm,
  updateStatePreTestForm,
  updateStatePostTestForm,
  deleteStatePreTestForm,
  deleteStatePostTestForm,
  publishStatePreTestForm,
  publishStatePostTestForm,
} from "../../state/store/stateTrainingSlice";
import trainingAdminService from "../../../services/training-admin.service";

const { Text, Title } = Typography;

const TestFormManagementPage = () => {
  const dispatch = useDispatch();
  const { preTestForms, postTestForms } = useSelector(
    (state) => state.stateTraining,
  );
  const [activeTab, setActiveTab] = useState("pre-test");
  const [modalOpen, setModalOpen] = useState(false);
  const [responsesModalOpen, setResponsesModalOpen] = useState(false);
  const [responseDetailOpen, setResponseDetailOpen] = useState(false);
  const [selectedForm, setSelectedForm] = useState(null);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [responsesData, setResponsesData] = useState([]);
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [questions, setQuestions] = useState([]);
  const [form] = Form.useForm();

  const QUESTION_TYPES = [
    { value: "multiChoice", label: "Multiple Choice" },
    { value: "checkbox", label: "Checkbox (Multi-select)" },
    { value: "yesNo", label: "Yes/No" },
    { value: "text", label: "Text Answer" },
    { value: "number", label: "Number" },
  ];

  useEffect(() => {
    dispatch(fetchStatePreTestForms());
    dispatch(fetchStatePostTestForms());
  }, [dispatch]);

  const currentForms = activeTab === "pre-test" ? preTestForms : postTestForms;
  const isLoading = currentForms.loading && !currentForms.list;

  const createEmptyQuestion = () => ({
    id: `q${Date.now()}`,
    type: "multiChoice",
    question: "",
    required: true,
    options: { choices: ["", ""] },
    correctAnswer: "",
    points: 1,
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
      passingScore: record.passingScore,
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

    // Reset options and correctAnswer when type changes
    if (field === "type") {
      if (value === "multiChoice" || value === "checkbox") {
        updated[index].options = { choices: ["", ""] };
        updated[index].correctAnswer = value === "checkbox" ? [] : "";
      } else if (value === "yesNo") {
        updated[index].options = null;
        updated[index].correctAnswer = "";
      } else {
        updated[index].options = null;
        updated[index].correctAnswer = "";
      }
    }
    setQuestions(updated);
  };

  const addOption = (questionIndex) => {
    const updated = [...questions];
    updated[questionIndex].options.choices.push("");
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
      let data;
      if (activeTab === "pre-test") {
        data = await trainingAdminService.getPreTestFormResponses(record.id);
      } else {
        data = await trainingAdminService.getPostTestFormResponses(record.id);
      }
      setResponsesData(Array.isArray(data) ? data : data?.responses || []);
    } catch (error) {
      message.error("Failed to load responses");
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
        message.error("Please add at least one question");
        return;
      }

      // Clean up questions for storage
      const cleanedQuestions = validQuestions.map((q, idx) => ({
        id: q.id || `q${idx + 1}`,
        type: q.type,
        question: q.question.trim(),
        required: q.required,
        options: q.options?.choices?.filter(c => c.trim()).length > 0
          ? { choices: q.options.choices.filter(c => c.trim()) }
          : null,
        correctAnswer: q.correctAnswer || null,
        points: q.points || 1,
      }));

      const payload = {
        title: values.title,
        description: values.description,
        purpose: values.purpose,
        passingScore: values.passingScore,
        questions: cleanedQuestions,
        publish: values.publish,
      };

      if (editing) {
        if (activeTab === "pre-test") {
          await dispatch(
            updateStatePreTestForm({ id: editing.id, data: payload }),
          ).unwrap();
        } else {
          await dispatch(
            updateStatePostTestForm({ id: editing.id, data: payload }),
          ).unwrap();
        }
        message.success(
          `${activeTab === "pre-test" ? "Pre-test" : "Post-test"} form updated`,
        );
      } else {
        if (activeTab === "pre-test") {
          await dispatch(createStatePreTestForm(payload)).unwrap();
        } else {
          await dispatch(createStatePostTestForm(payload)).unwrap();
        }
        message.success(
          `${activeTab === "pre-test" ? "Pre-test" : "Post-test"} form created`,
        );
      }
      setModalOpen(false);
    } catch (error) {
      message.error(error || "Failed to save test form");
    }
  };

  const handlePublish = async (id) => {
    try {
      if (activeTab === "pre-test") {
        await dispatch(publishStatePreTestForm(id)).unwrap();
      } else {
        await dispatch(publishStatePostTestForm(id)).unwrap();
      }
      message.success(
        `${activeTab === "pre-test" ? "Pre-test" : "Post-test"} form published`,
      );
    } catch (error) {
      message.error(error || "Failed to publish test form");
    }
  };

  const handleDelete = async (id) => {
    try {
      if (activeTab === "pre-test") {
        await dispatch(deleteStatePreTestForm(id)).unwrap();
      } else {
        await dispatch(deleteStatePostTestForm(id)).unwrap();
      }
      message.success(
        `${activeTab === "pre-test" ? "Pre-test" : "Post-test"} form deleted`,
      );
    } catch (error) {
      message.error(error || "Failed to delete test form");
    }
  };

  const columns = [
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
      render: (text) => (
        <span className="font-medium text-slate-800">{text}</span>
      ),
    },
    {
      title: "Purpose",
      dataIndex: "purpose",
      key: "purpose",
      render: (value) =>
        value ? (
          <Tag className="text-xs">{value}</Tag>
        ) : (
          <Text type="secondary" className="text-xs">
            -
          </Text>
        ),
    },
    {
      title: "Passing Score",
      dataIndex: "passingScore",
      key: "passingScore",
      render: (value) =>
        value ? (
          <span className="text-sm">{value}%</span>
        ) : (
          <Text type="secondary" className="text-xs">
            No scoring
          </Text>
        ),
    },
    {
      title: "Responses",
      dataIndex: "_count",
      key: "responses",
      render: (count) => (
        <span className="text-sm">{count?.responses || 0}</span>
      ),
    },
    {
      title: "Status",
      dataIndex: "isPublished",
      key: "isPublished",
      render: (value) =>
        value ? (
          <Tag color="green" icon={<CheckCircleOutlined />} className="text-xs">
            Published
          </Tag>
        ) : (
          <Tag color="orange" className="text-xs">
            Draft
          </Tag>
        ),
    },
    {
      title: "Actions",
      key: "actions",
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
    const preList = preTestForms.list || [];
    const postList = postTestForms.list || [];
    return {
      preTotal: preList.length,
      prePublished: preList.filter((item) => item.isPublished).length,
      postTotal: postList.length,
      postPublished: postList.filter((item) => item.isPublished).length,
    };
  }, [preTestForms.list, postTestForms.list]);

  const filteredForms = useMemo(() => {
    const list = currentForms.list || [];
    if (!searchText) return list;
    const search = searchText.toLowerCase();
    return list.filter(
      (item) =>
        (item.title || "").toLowerCase().includes(search) ||
        (item.purpose || "").toLowerCase().includes(search),
    );
  }, [currentForms.list, searchText]);

  const searchResultCount = searchText ? filteredForms.length : null;

  const tabItems = [
    {
      key: "pre-test",
      label: (
        <span className="flex items-center gap-2">
          <FormOutlined />
          Pre-Test Forms
          <Tag className="ml-1">{stats.preTotal}</Tag>
        </span>
      ),
    },
    {
      key: "post-test",
      label: (
        <span className="flex items-center gap-2">
          <FileTextOutlined />
          Post-Test Forms
          <Tag className="ml-1">{stats.postTotal}</Tag>
        </span>
      ),
    },
  ];

  const handleViewResponseDetail = (record) => {
    setSelectedResponse(record);
    setResponseDetailOpen(true);
  };

  // Response table columns
  const responseColumns = [
    {
      title: "Faculty",
      key: "faculty",
      width: 180,
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-800 text-xs">
            {record.user?.name || "Unknown"}
          </div>
          <div className="text-[10px] text-slate-500">
            {record.user?.email || "-"}
          </div>
        </div>
      ),
    },
    {
      title: "Institution",
      key: "institution",
      width: 150,
      render: (_, record) => (
        <div className="text-xs text-slate-700 truncate" title={record.user?.Institution?.name}>
          {record.user?.Institution?.shortName || record.user?.Institution?.name || "N/A"}
        </div>
      ),
    },
    {
      title: "Training",
      key: "training",
      width: 180,
      render: (_, record) => (
        <div className="text-xs text-slate-700 truncate" title={record.training?.title}>
          {record.training?.title || "N/A"}
        </div>
      ),
    },
    {
      title: "Score",
      dataIndex: "score",
      key: "score",
      width: 70,
      render: (value, record) => {
        const passingScore = selectedForm?.passingScore;
        const passed = passingScore ? value >= passingScore : true;
        return value !== null && value !== undefined ? (
          <Tag color={passed ? "green" : "red"} className="text-xs">
            {value}%
          </Tag>
        ) : (
          <Text type="secondary" className="text-xs">-</Text>
        );
      },
    },
    {
      title: "Submitted",
      dataIndex: "submittedAt",
      key: "submittedAt",
      width: 100,
      render: (value) => (
        <span className="text-xs text-slate-600">
          {value ? dayjs(value).format("DD MMM YYYY") : "-"}
        </span>
      ),
    },
    {
      title: "Action",
      key: "action",
      width: 80,
      render: (_, record) => (
        <Button
          size="small"
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewResponseDetail(record)}
          className="text-xs"
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="p-6 training-ui">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <Title level={2} className="!mb-1 training-heading">
            Test Forms
          </Title>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreate}
        >
          New {activeTab === "pre-test" ? "Pre-Test" : "Post-Test"} Form
        </Button>
      </div>

      {/* Forms Tabs */}
      <Card className="rounded-xl border-border shadow-none">
        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key);
            setSearchText("");
          }}
          items={tabItems}
          className="mb-4"
        />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Input
              placeholder="Search by title or purpose"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              className="lg:w-80"
              allowClear
            />
            {searchResultCount !== null && (
              <Text type="secondary" className="text-sm">
                {searchResultCount} result{searchResultCount !== 1 ? "s" : ""} found
              </Text>
            )}
          </div>
        </div>

        {isLoading ? (
          <TableRowSkeleton rows={5} columns={6} />
        ) : filteredForms.length > 0 ? (
          <Table
            className="custom-table"
            rowKey="id"
            columns={columns}
            dataSource={filteredForms}
            loading={currentForms.loading}
            pagination={{ pageSize: 10 }}
          />
        ) : (
          <TrainingEmptyState
            type={searchText ? "search" : "feedback"}
            message={
              searchText
                ? "No test forms found"
                : `No ${activeTab === "pre-test" ? "pre-test" : "post-test"} forms yet`
            }
            description={
              searchText
                ? "Try adjusting your search terms."
                : `Create your first ${activeTab === "pre-test" ? "pre-test" : "post-test"} form to assess participants.`
            }
            actionText={searchText ? "Clear Search" : "Create Form"}
            onAction={searchText ? () => setSearchText("") : openCreate}
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
              <div
                className={`w-9 h-9 rounded-lg border-2 ${activeTab === "pre-test" ? "border-blue-600" : "border-amber-600"} flex items-center justify-center shrink-0`}
              >
                {activeTab === "pre-test" ? (
                  <FormOutlined className="text-blue-600 text-base" />
                ) : (
                  <FileTextOutlined className="text-amber-600 text-base" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-800 mb-0.5 truncate">
                  {editing
                    ? `Edit ${activeTab === "pre-test" ? "Pre-Test" : "Post-Test"} Form`
                    : `Create ${activeTab === "pre-test" ? "Pre-Test" : "Post-Test"} Form`}
                </h3>
                <Text className="text-xs text-slate-600 block truncate">
                  {editing
                    ? "Update form configuration"
                    : `Configure new ${activeTab === "pre-test" ? "pre-test (prerequisites)" : "post-test (assessment)"} form`}
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
            <Form.Item
              name="title"
              label="Title"
              rules={[{ required: true, message: "Please enter form title" }]}
            >
              <Input
                placeholder={
                  activeTab === "pre-test"
                    ? "e.g., Prerequisites Assessment"
                    : "e.g., Learning Assessment Quiz"
                }
              />
            </Form.Item>
            <Form.Item name="description" label="Description">
              <Input.TextArea
                rows={2}
                placeholder={`Describe the purpose of this ${activeTab === "pre-test" ? "pre-test" : "post-test"} form...`}
              />
            </Form.Item>
            <Row gutter={12}>
              <Col xs={24} sm={8}>
                <Form.Item name="purpose" label="Purpose">
                  <Select
                    allowClear
                    placeholder="Select purpose"
                    options={[
                      { value: "PRE_TEST", label: "Pre-Test" },
                      { value: "POST_TEST", label: "Post-Test" },
                      { value: "ASSESSMENT", label: "Assessment" },
                      { value: "QUIZ", label: "Quiz" },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="passingScore" label="Passing Score (%)">
                  <InputNumber
                    min={0}
                    max={100}
                    placeholder="e.g., 70"
                    className="w-full"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="publish"
                  label="Publish Immediately"
                  valuePropName="checked"
                >
                  <Switch checkedChildren="Yes" unCheckedChildren="No" />
                </Form.Item>
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
                          onChange={(e) => updateQuestion(qIndex, "question", e.target.value)}
                          size="small"
                        />
                        <Row gutter={8}>
                          <Col span={8}>
                            <Select
                              size="small"
                              className="w-full"
                              value={q.type}
                              onChange={(val) => updateQuestion(qIndex, "type", val)}
                              options={QUESTION_TYPES}
                            />
                          </Col>
                          <Col span={5}>
                            <InputNumber
                              size="small"
                              className="w-full"
                              min={1}
                              max={10}
                              value={q.points}
                              onChange={(val) => updateQuestion(qIndex, "points", val)}
                              addonAfter="pts"
                            />
                          </Col>
                          <Col span={6}>
                            <div className="flex items-center h-full">
                              <Switch
                                size="small"
                                checked={q.required}
                                onChange={(val) => updateQuestion(qIndex, "required", val)}
                              />
                              <span className="text-xs text-slate-500 ml-1">Required</span>
                            </div>
                          </Col>
                          <Col span={5} className="text-right">
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
                    {(q.type === "multiChoice" || q.type === "checkbox") && (
                      <div className="ml-8 mt-2 space-y-2">
                        <div className="text-xs text-slate-500 mb-1">
                          Options {q.type === "multiChoice" ? "(select correct answer)" : "(select all correct answers)"}
                        </div>
                        {q.options?.choices?.map((opt, optIndex) => (
                          <div key={optIndex} className="flex items-center gap-2">
                            {q.type === "multiChoice" ? (
                              <input
                                type="radio"
                                name={`correct-${q.id}`}
                                checked={q.correctAnswer === opt && opt.trim() !== ""}
                                onChange={() => updateQuestion(qIndex, "correctAnswer", opt)}
                                className="accent-blue-600"
                              />
                            ) : (
                              <input
                                type="checkbox"
                                checked={Array.isArray(q.correctAnswer) && q.correctAnswer.includes(opt) && opt.trim() !== ""}
                                onChange={(e) => {
                                  const current = Array.isArray(q.correctAnswer) ? q.correctAnswer : [];
                                  const newVal = e.target.checked
                                    ? [...current, opt]
                                    : current.filter(a => a !== opt);
                                  updateQuestion(qIndex, "correctAnswer", newVal);
                                }}
                                className="accent-blue-600"
                              />
                            )}
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

                    {/* Yes/No correct answer */}
                    {q.type === "yesNo" && (
                      <div className="ml-8 mt-2">
                        <div className="text-xs text-slate-500 mb-1">Correct Answer</div>
                        <Select
                          size="small"
                          className="w-32"
                          value={q.correctAnswer || undefined}
                          placeholder="Select"
                          allowClear
                          onChange={(val) => updateQuestion(qIndex, "correctAnswer", val)}
                          options={[
                            { value: "yes", label: "Yes" },
                            { value: "no", label: "No" },
                          ]}
                        />
                      </div>
                    )}

                    {/* Text/Number correct answer */}
                    {(q.type === "text" || q.type === "number") && (
                      <div className="ml-8 mt-2">
                        <div className="text-xs text-slate-500 mb-1">
                          Correct Answer (optional)
                        </div>
                        {q.type === "text" ? (
                          <Input
                            size="small"
                            placeholder="Expected answer..."
                            value={q.correctAnswer || ""}
                            onChange={(e) => updateQuestion(qIndex, "correctAnswer", e.target.value)}
                            className="w-48"
                          />
                        ) : (
                          <InputNumber
                            size="small"
                            placeholder="Expected number..."
                            value={q.correctAnswer || undefined}
                            onChange={(val) => updateQuestion(qIndex, "correctAnswer", val)}
                            className="w-32"
                          />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Button onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="primary" onClick={handleSave} loading={currentForms.loading}>
                {editing ? "Update Form" : "Create Form"}
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
        width={900}
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
                  <div className={`w-9 h-9 rounded-lg border-2 ${activeTab === "pre-test" ? "border-purple-600" : "border-green-600"} flex items-center justify-center shrink-0`}>
                    {activeTab === "pre-test" ? (
                      <FormOutlined className="text-purple-600 text-base" />
                    ) : (
                      <FileTextOutlined className="text-green-600 text-base" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-slate-800 mb-1 truncate">
                      {selectedForm.title}
                    </h3>
                    <div className="flex items-center gap-2.5 text-xs text-slate-600">
                      <span>
                        <strong className="text-slate-800">{responsesData.length}</strong> responses
                      </span>
                      {selectedForm.passingScore && (
                        <>
                          <span>•</span>
                          <span>
                            Passing: <strong className="text-slate-800">{selectedForm.passingScore}%</strong>
                          </span>
                        </>
                      )}
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

            {/* Responses Table */}
            <div className="p-3">
              <style>{`
                .responses-table .ant-table-thead > tr > th {
                  background: #f8fafc;
                  font-size: 11px;
                  font-weight: 600;
                  color: #334155;
                  padding: 8px 12px;
                }
                .responses-table .ant-table-tbody > tr > td {
                  padding: 8px 12px;
                }
              `}</style>

              {responsesLoading ? (
                <div className="text-center py-12">
                  <Text type="secondary">Loading responses...</Text>
                </div>
              ) : responsesData.length > 0 ? (
                <Table
                  className="responses-table"
                  rowKey="id"
                  columns={responseColumns}
                  dataSource={responsesData}
                  pagination={{ pageSize: 10, size: "small" }}
                  size="small"
                  scroll={{ x: 800 }}
                />
              ) : (
                <div className="text-center py-12">
                  <div className="text-slate-300 mb-2">
                    <FileTextOutlined style={{ fontSize: 48 }} />
                  </div>
                  <Text className="text-slate-500">No responses yet</Text>
                </div>
              )}

              {/* Legend */}
              {responsesData.length > 0 && selectedForm.passingScore && (
                <div className="mt-2.5 pt-2.5 border-t border-slate-200 flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <CheckCircleFilled className="text-sm text-green-500" />
                    <span className="text-slate-600">Passed</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CloseCircleOutlined className="text-sm text-red-400" />
                    <span className="text-slate-600">Failed</span>
                  </div>
                  <span className="text-slate-400 ml-auto">
                    Passing score: {selectedForm.passingScore}%
                  </span>
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
        width={600}
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
                      {selectedResponse.user?.name || "Unknown"}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <span>{selectedResponse.user?.email}</span>
                      {selectedResponse.score !== null && (
                        <>
                          <span>•</span>
                          <Tag
                            color={selectedResponse.passed ? "green" : "red"}
                            className="text-xs m-0"
                          >
                            Score: {selectedResponse.score}%
                          </Tag>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  type="text"
                  size="small"
                  icon={<span className="text-xl text-slate-400 hover:text-slate-600">&times;</span>}
                  onClick={() => setResponseDetailOpen(false)}
                  className="hover:bg-slate-100 flex-shrink-0"
                />
              </div>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-4">
                {/* Response Info */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg text-xs">
                  <div>
                    <span className="text-slate-500">Institution:</span>
                    <div className="font-medium text-slate-800">
                      {selectedResponse.user?.Institution?.name || "N/A"}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Training:</span>
                    <div className="font-medium text-slate-800">
                      {selectedResponse.training?.title || "N/A"}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Submitted:</span>
                    <div className="font-medium text-slate-800">
                      {selectedResponse.submittedAt
                        ? dayjs(selectedResponse.submittedAt).format("DD MMM YYYY, hh:mm A")
                        : "N/A"}
                    </div>
                  </div>
                  {selectedResponse.passed !== null && (
                    <div>
                      <span className="text-slate-500">Status:</span>
                      <div className="font-medium">
                        {selectedResponse.passed ? (
                          <span className="text-green-600">Passed</span>
                        ) : (
                          <span className="text-red-600">Failed</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Questions & Answers */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-800 mb-3">Responses</h4>
                  <div className="space-y-3">
                    {selectedForm?.questions?.map((question, index) => {
                      const answer = selectedResponse.responses?.[question.id];
                      const correctAnswer = question.correctAnswer;
                      const isCorrect = correctAnswer !== undefined && answer === correctAnswer;

                      return (
                        <div
                          key={question.id}
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
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500">Answer:</span>
                              <span className="text-sm font-medium text-slate-800">
                                {Array.isArray(answer)
                                  ? answer.join(", ")
                                  : answer !== undefined && answer !== null
                                  ? String(answer)
                                  : "-"}
                              </span>
                              {correctAnswer !== undefined && (
                                <Tag
                                  color={isCorrect ? "green" : "red"}
                                  className="text-[10px] m-0"
                                >
                                  {isCorrect ? "Correct" : "Wrong"}
                                </Tag>
                              )}
                            </div>
                            {correctAnswer !== undefined && !isCorrect && (
                              <div className="mt-1 text-xs text-slate-500">
                                Correct answer:{" "}
                                <span className="text-green-600 font-medium">
                                  {Array.isArray(correctAnswer)
                                    ? correctAnswer.join(", ")
                                    : String(correctAnswer)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default TestFormManagementPage;
