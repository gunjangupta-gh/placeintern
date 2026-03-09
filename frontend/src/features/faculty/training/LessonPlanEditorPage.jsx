import React, { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Select,
  Space,
  Typography,
  message,
} from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { BookOutlined } from "@ant-design/icons";
import {
  createLessonPlan,
  fetchLessonPlanById,
  updateLessonPlan,
  submitLessonPlan,
} from "../store/facultyTrainingSlice";
import { fetchMyTrainings } from "../store/facultyTrainingSlice";

const { Text } = Typography;

const LessonPlanEditorPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id, trainingId } = useParams();
  const [form] = Form.useForm();

  const { lessonPlans, myTrainings } = useSelector(
    (state) => state.facultyTraining,
  );

  useEffect(() => {
    dispatch(fetchMyTrainings());
    if (id) {
      dispatch(fetchLessonPlanById(id));
    }
  }, [dispatch, id]);

  useEffect(() => {
    if (lessonPlans.current) {
      // Extract trainingId from training object if needed
      const formData = {
        ...lessonPlans.current,
        trainingId:
          lessonPlans.current.training?.id || lessonPlans.current.trainingId,
      };
      form.setFieldsValue(formData);
    } else if (trainingId) {
      form.setFieldsValue({ trainingId });
    }
  }, [lessonPlans.current, trainingId, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (id) {
        await dispatch(updateLessonPlan({ id, data: values })).unwrap();
        message.success("Lesson plan updated");
      } else {
        await dispatch(createLessonPlan(values)).unwrap();
        message.success("Lesson plan created");
      }
      navigate("/app/training/lesson-plans");
    } catch (error) {
      message.error(error || "Failed to save lesson plan");
    }
  };

  const handleSubmit = async () => {
    if (!id) {
      message.warning("Save the lesson plan before submitting");
      return;
    }

    try {
      await dispatch(submitLessonPlan(id)).unwrap();
      message.success("Lesson plan submitted");
      navigate("/app/training/lesson-plans");
    } catch (error) {
      message.error(error || "Failed to submit lesson plan");
    }
  };

  const trainingOptions = useMemo(() => {
    let options = (myTrainings.list || [])
      .filter((item) => {
        // Handle both direct training objects and nested training objects
        const training = item.training || item;

        // Only show approved trainings
        if (item.applicationStatus && item.applicationStatus !== "APPROVED") {
          return false;
        }

        // Only show completed trainings (endDate has passed)
        if (!training.endDate) return false;
        const trainingEndDate = new Date(training.endDate);
        const now = new Date();
        return trainingEndDate < now;
      })
      .map((item) => {
        // Handle both direct training objects and nested training objects
        const training = item.training || item;
        return {
          value: training.id,
          label: training.title,
        };
      });

    // When editing, ensure the current training is in the options
    if (
      lessonPlans.current?.training &&
      !options.find((opt) => opt.value === lessonPlans.current.training.id)
    ) {
      options = [
        {
          value: lessonPlans.current.training.id,
          label: lessonPlans.current.training.title,
        },
        ...options,
      ];
    }

    return options;
  }, [myTrainings.list, lessonPlans.current]);

  const courseSemesterOptions = useMemo(() => {
    const baseOptions = [
      { value: "Semester 1", label: "Semester 1" },
      { value: "Semester 2", label: "Semester 2" },
      { value: "Semester 3", label: "Semester 3" },
      { value: "Semester 4", label: "Semester 4" },
      { value: "Semester 5", label: "Semester 5" },
      { value: "Semester 6", label: "Semester 6" },
      { value: "Semester 7", label: "Semester 7" },
      { value: "Semester 8", label: "Semester 8" },
    ];

    const currentValue = lessonPlans.current?.courseOrSemester;
    if (
      currentValue &&
      !baseOptions.some((option) => option.value === currentValue)
    ) {
      return [{ value: currentValue, label: currentValue }, ...baseOptions];
    }

    return baseOptions;
  }, [lessonPlans.current?.courseOrSemester]);

  return (
    <div className="p-4 training-ui">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div>
            <h2 className="text-lg font-semibold mb-0">
              {id ? "Edit Lesson Plan" : "Create Lesson Plan"}
            </h2>
          </div>
        </div>
      </div>

      <Card className="rounded-xl border-border shadow-none" styles={{ body: { padding: '16px' } }}>
        <Form layout="vertical" form={form} size="small">
          <Row gutter={[12, 8]}>
            <Col xs={24} md={12}>
              <Form.Item
                name="trainingId"
                label={<span className="text-[10px] uppercase font-semibold text-slate-500">Training</span>}
                rules={[
                  { required: true, message: "Please select a training" },
                ]}
                className="mb-3"
                extra={
                  <Text type="secondary" className="text-[10px]">
                    Only completed trainings are available
                  </Text>
                }
              >
                <Select
                  options={trainingOptions}
                  placeholder={
                    myTrainings.loading
                      ? "Loading..."
                      : "Select training"
                  }
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? "")
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  loading={myTrainings.loading}
                  disabled={myTrainings.loading || trainingOptions.length === 0}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="courseOrSemester"
                label={
                  <span className="text-[10px] uppercase font-semibold text-slate-500">
                    Course or Semester
                  </span>
                }
                className="mb-3"
              >
                <Select
                  options={courseSemesterOptions}
                  placeholder="Select semester"
                  allowClear
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? "")
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="title"
            label={
              <span className="text-[10px] uppercase font-semibold text-slate-500">Lesson Plan Title</span>
            }
            rules={[{ required: true, message: "Please enter a title" }]}
            className="mb-3"
          >
            <Input placeholder="Lesson plan title" />
          </Form.Item>

          <Row gutter={[12, 8]}>
            <Col xs={24} md={12}>
              <Form.Item
                name="connectionToTraining"
                label={
                  <span className="text-[10px] uppercase font-semibold text-slate-500">
                    Connection to Training
                  </span>
                }
                className="mb-3"
              >
                <Input.TextArea
                  rows={2}
                  placeholder="How does the training connect?"
                  className="custom-scrollbar"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="learningObjectives"
                label={
                  <span className="text-[10px] uppercase font-semibold text-slate-500">
                    Learning Objectives
                  </span>
                }
                className="mb-3"
              >
                <Select
                  mode="tags"
                  tokenSeparators={[","]}
                  placeholder="Add objectives"
                  className="custom-scrollbar"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[12, 8]}>
            <Col xs={24} md={12}>
              <Form.Item
                name="newSkillsTechnologies"
                label={
                  <span className="text-[10px] uppercase font-semibold text-slate-500">
                    New Skills or Technologies
                  </span>
                }
                className="mb-3"
              >
                <Input.TextArea rows={2} placeholder="Describe new skills" className="custom-scrollbar" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="deliveryMethods"
                label={
                  <span className="text-[10px] uppercase font-semibold text-slate-500">Delivery Methods</span>
                }
                className="mb-3"
              >
                <Input.TextArea
                  rows={2}
                  placeholder="Describe delivery methods"
                  className="custom-scrollbar"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[12, 8]}>
            <Col xs={24} md={12}>
              <Form.Item
                name="handsOnActivities"
                label={
                  <span className="text-[10px] uppercase font-semibold text-slate-500">
                    Hands-on Activities
                  </span>
                }
                className="mb-3"
              >
                <Input.TextArea rows={2} placeholder="Describe activities" className="custom-scrollbar" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="assessmentMethods"
                label={
                  <span className="text-[10px] uppercase font-semibold text-slate-500">
                    Assessment Methods
                  </span>
                }
                className="mb-3"
              >
                <Input.TextArea
                  rows={2}
                  placeholder="Describe assessment methods"
                  className="custom-scrollbar"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[12, 8]}>
            <Col xs={24} md={12}>
              <Form.Item
                name="industryConnections"
                label={
                  <span className="text-[10px] uppercase font-semibold text-slate-500">
                    Industry Connections
                  </span>
                }
                className="mb-3"
              >
                <Input.TextArea
                  rows={2}
                  placeholder="Describe industry connections"
                  className="custom-scrollbar"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="resourceRequirements"
                label={
                  <span className="text-[10px] uppercase font-semibold text-slate-500">
                    Resource Requirements
                  </span>
                }
                className="mb-3"
              >
                <Input.TextArea rows={2} placeholder="Resources needed" className="custom-scrollbar" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[12, 8]}>
            <Col xs={24} md={12}>
              <Form.Item
                name="implementationTimeline"
                label={
                  <span className="text-[10px] uppercase font-semibold text-slate-500">
                    Implementation Timeline
                  </span>
                }
                className="mb-3"
              >
                <Input placeholder="Timeline" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="expectedOutcomes"
                label={
                  <span className="text-[10px] uppercase font-semibold text-slate-500">Expected Outcomes</span>
                }
                className="mb-3"
              >
                <Input.TextArea rows={2} placeholder="Expected outcomes" className="custom-scrollbar" />
              </Form.Item>
            </Col>
          </Row>

          <div className="flex gap-2 pt-3 border-t border-slate-100">
            <Button type="primary" onClick={handleSave} size="middle">
              Save
            </Button>
            <Button onClick={handleSubmit} disabled={!id} size="middle">
              Submit
            </Button>
            <Button onClick={() => navigate("/app/training/lesson-plans")} size="middle">
              Cancel
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default LessonPlanEditorPage;
