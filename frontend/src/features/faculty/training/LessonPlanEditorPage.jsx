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

  return (
    <div className="p-6 training-ui">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div>
            <h2 className="text-lg font-semibold mb-0">
              {id ? "Edit Lesson Plan" : "Create Lesson Plan"}
            </h2>
          </div>
        </div>
      </div>

      <Card className="rounded-xl border-border shadow-none">
        <Form layout="vertical" form={form}>
          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>
              <Form.Item
                name="trainingId"
                label={<span className="text-xs font-medium">Training</span>}
                rules={[
                  { required: true, message: "Please select a training" },
                ]}
                extra={
                  <Text type="secondary" className="text-xs">
                    Only completed trainings are available for lesson plans
                  </Text>
                }
              >
                <Select
                  options={trainingOptions}
                  placeholder={
                    myTrainings.loading
                      ? "Loading trainings..."
                      : trainingOptions.length === 0
                        ? "No completed trainings available"
                        : "Select a completed training"
                  }
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? "")
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  loading={myTrainings.loading}
                  notFoundContent={
                    myTrainings.loading
                      ? "Loading..."
                      : "No completed trainings found. You can only create lesson plans for trainings that have ended."
                  }
                  disabled={myTrainings.loading || trainingOptions.length === 0}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="courseOrSemester"
                label={
                  <span className="text-xs font-medium">
                    Course or Semester
                  </span>
                }
              >
                <Input placeholder="Course or semester" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="title"
            label={
              <span className="text-xs font-medium">Lesson Plan Title</span>
            }
            rules={[{ required: true, message: "Please enter a title" }]}
          >
            <Input placeholder="Lesson plan title" />
          </Form.Item>

          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>
              <Form.Item
                name="connectionToTraining"
                label={
                  <span className="text-xs font-medium">
                    Connection to Training
                  </span>
                }
              >
                <Input.TextArea
                  rows={3}
                  placeholder="How does the training connect?"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="learningObjectives"
                label={
                  <span className="text-xs font-medium">
                    Learning Objectives
                  </span>
                }
              >
                <Select
                  mode="tags"
                  tokenSeparators={[","]}
                  placeholder="Add objectives (press Enter or comma to add)"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>
              <Form.Item
                name="newSkillsTechnologies"
                label={
                  <span className="text-xs font-medium">
                    New Skills or Technologies
                  </span>
                }
              >
                <Input.TextArea rows={3} placeholder="Describe new skills" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="deliveryMethods"
                label={
                  <span className="text-xs font-medium">Delivery Methods</span>
                }
              >
                <Input.TextArea
                  rows={3}
                  placeholder="Describe delivery methods"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>
              <Form.Item
                name="handsOnActivities"
                label={
                  <span className="text-xs font-medium">
                    Hands-on Activities
                  </span>
                }
              >
                <Input.TextArea rows={3} placeholder="Describe activities" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="assessmentMethods"
                label={
                  <span className="text-xs font-medium">
                    Assessment Methods
                  </span>
                }
              >
                <Input.TextArea
                  rows={3}
                  placeholder="Describe assessment methods"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>
              <Form.Item
                name="industryConnections"
                label={
                  <span className="text-xs font-medium">
                    Industry Connections
                  </span>
                }
              >
                <Input.TextArea
                  rows={3}
                  placeholder="Describe industry connections"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="resourceRequirements"
                label={
                  <span className="text-xs font-medium">
                    Resource Requirements
                  </span>
                }
              >
                <Input.TextArea rows={3} placeholder="Resources needed" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>
              <Form.Item
                name="implementationTimeline"
                label={
                  <span className="text-xs font-medium">
                    Implementation Timeline
                  </span>
                }
              >
                <Input placeholder="Timeline" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="expectedOutcomes"
                label={
                  <span className="text-xs font-medium">Expected Outcomes</span>
                }
              >
                <Input.TextArea rows={2} placeholder="Expected outcomes" />
              </Form.Item>
            </Col>
          </Row>

          <div className="flex gap-2 pt-3 border-t border-slate-200">
            <Button type="primary" onClick={handleSave}>
              Save
            </Button>
            <Button onClick={handleSubmit} disabled={!id}>
              Submit for Review
            </Button>
            <Button onClick={() => navigate("/app/training/lesson-plans")}>
              Cancel
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default LessonPlanEditorPage;
