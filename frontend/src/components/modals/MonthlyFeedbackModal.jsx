// src/components/industry/MonthlyFeedbackModal.jsx
import React, { useState, useEffect } from "react";
import { Form, Input, Card, Row, Col } from "antd";
import { toast } from "react-hot-toast";
import API from "../../services/api";
import BaseFeedbackModal from "./BaseFeedbackModal";

const { TextArea } = Input;

const MonthlyFeedbackModal = ({
  visible,
  onCancel,
  onSuccess,
  preSelectedApplicationId = null,
  preSelectedStudentName = null,
  editingFeedback = null,
}) => {
  const [loading, setLoading] = useState(false);
  const [applications, setApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchApplications();
    }
  }, [visible]);

  useEffect(() => {
    if (preSelectedStudentName && preSelectedApplicationId) {
      toast.info(`Creating monthly feedback for ${preSelectedStudentName}`);
    }
  }, [preSelectedApplicationId, preSelectedStudentName]);

  const fetchApplications = async () => {
    setApplicationsLoading(true);
    try {
      const res = await API.get("/internships/my-internships");
      const internships = res.data || [];

      const allApplications = internships.flatMap((internship) =>
        (internship.applications || []).map((app) => ({
          ...app,
          internshipTitle: internship.title,
          internshipId: internship.id,
        }))
      );

      const activeApplications = allApplications.filter((app) =>
        ["JOINED", "SELECTED"].includes(app.status)
      );

      setApplications(activeApplications);
    } catch (e) {
      toast.error("Failed to fetch applications");
    } finally {
      setApplicationsLoading(false);
    }
  };

  const handleSubmit = async (values, isEditing) => {
    setLoading(true);
    try {
      if (isEditing) {
        await API.patch(`/monthly-feedback/${editingFeedback.id}`, values);
        toast.success("Monthly feedback updated successfully!");
      } else {
        await API.post("/monthly-feedback", values);
        toast.success("Monthly feedback created successfully!");
      }

      onSuccess && onSuccess();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseFeedbackModal
      visible={visible}
      onCancel={onCancel}
      onSuccess={onSuccess}
      onSubmit={handleSubmit}
      loading={loading}
      title={editingFeedback ? "Edit Monthly Feedback" : "Add Monthly Feedback"}
      type="monthly"
      applications={applications}
      applicationsLoading={applicationsLoading}
      editingFeedback={editingFeedback}
      preSelectedApplicationId={preSelectedApplicationId}
      preSelectedStudentName={preSelectedStudentName}
    >
      {/* Detailed Feedback Section */}
      <Card className="rounded-xl mb-6 border-border">
        <h4 className="font-semibold mb-4 text-text-primary">
          📝 Detailed Feedback
        </h4>

        <Form.Item
          name="strengths"
          label="Key Strengths"
          tooltip="Highlight the intern's strong points and positive qualities"
        >
          <TextArea
            rows={3}
            placeholder="Describe the intern's key strengths and positive attributes..."
            maxLength={400}
            showCount
          />
        </Form.Item>

        <Form.Item
          name="areasForImprovement"
          label="Areas for Improvement"
          tooltip="Constructive feedback on areas that need development"
        >
          <TextArea
            rows={3}
            placeholder="Mention specific areas where the intern can improve..."
            maxLength={400}
            showCount
          />
        </Form.Item>

        <Form.Item
          name="overallComments"
          label="Overall Comments"
          tooltip="General feedback and observations"
          rules={[
            {
              required: true,
              message: "Please provide overall comments",
            },
          ]}
        >
          <TextArea
            rows={4}
            placeholder="Enter your overall feedback, observations, and suggestions..."
            maxLength={500}
            showCount
          />
        </Form.Item>
      </Card>

      {/* Tasks Section */}
      <Card className="rounded-xl mb-6 border-border">
        <h4 className="font-semibold mb-4 text-text-primary">
          📋 Task Management
        </h4>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Form.Item
              name="tasksAssigned"
              label="Tasks Assigned"
              tooltip="List the tasks that were assigned to the intern this month"
            >
              <TextArea
                rows={4}
                placeholder="List the tasks assigned to the intern this month..."
                maxLength={400}
                showCount
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              name="tasksCompleted"
              label="Tasks Completed"
              tooltip="List the tasks that were successfully completed"
            >
              <TextArea
                rows={4}
                placeholder="List the tasks completed by the intern..."
                maxLength={400}
                showCount
              />
            </Form.Item>
          </Col>
        </Row>
      </Card>
    </BaseFeedbackModal>
  );
};

export default MonthlyFeedbackModal;