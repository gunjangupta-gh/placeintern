// src/components/industry/CompletionFeedbackModal.jsx
import React, { useState, useEffect } from "react";
import { Form, Input, Row, Col, Switch, Card } from "antd";
import { toast } from "react-hot-toast";
import API from "../../services/api";
import BaseFeedbackModal from "./BaseFeedbackModal";

const { TextArea } = Input;

const CompletionFeedbackModal = ({
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
  const [submittedFeedbacks, setSubmittedFeedbacks] = useState([]);

  useEffect(() => {
    if (visible) {
      fetchSubmittedFeedbacks().then(() => {
        fetchApplications();
      });
    }
  }, [visible]);

  useEffect(() => {
    if (preSelectedStudentName && preSelectedApplicationId) {
      toast.success(`Creating completion feedback for ${preSelectedStudentName}`);
    }
  }, [preSelectedApplicationId, preSelectedStudentName]);

  const fetchSubmittedFeedbacks = async () => {
    try {
      const res = await API.get("/completion-feedback/industry/my-feedbacks");
      const feedbackData = res.data?.data || res.data || [];
      setSubmittedFeedbacks(Array.isArray(feedbackData) ? feedbackData : []);
    } catch (e) {
      console.error("Failed to fetch submitted feedbacks:", e);
    }
  };

  const fetchApplications = async () => {
    setApplicationsLoading(true);
    try {
      const res = await API.get("/internships/my-internships");
      const internships = Array.isArray(res.data)
        ? res.data
        : res.data?.data || [];

      // Get submitted feedback application IDs
      const submittedApplicationIds = submittedFeedbacks.map(
        (f) => f.applicationId
      );

      // Flatten applications that are eligible for completion feedback
      const allEligibleApps = internships.flatMap((internship) =>
        (internship.applications || [])
          .filter(
            (app) =>
              ["SELECTED", "JOINED", "COMPLETED"].includes(app.status) &&
              (!submittedApplicationIds.includes(app.id) ||
                (editingFeedback && editingFeedback?.applicationId === app.id))
          )
          .map((app) => ({
            ...app,
            internshipTitle: internship.title,
            internshipDuration: internship.duration,
            internship: internship,
          }))
      );

      setApplications(allEligibleApps);
    } catch (e) {
      setApplications([]);
      toast.error("Failed to fetch applications");
    } finally {
      setApplicationsLoading(false);
    }
  };

  const handleSubmit = async (values, isEditing) => {
    setLoading(true);
    try {
      const payload = {
        industryFeedback: values.industryFeedback,
        industryRating: values.industryRating,
        finalPerformance: values.finalPerformance || null,
        recommendForHire: values.recommendForHire || false,
        completionCertificate: values.completionCertificate || null,
        isCompleted: values.isCompleted !== false,
      };

      let response;
      if (isEditing) {
        response = await API.put(
          `/completion-feedback/industry/${values.applicationId}`,
          payload
        );
      } else {
        response = await API.post(
          `/completion-feedback/industry/${values.applicationId}`,
          payload
        );
      }

      if (response.status === 200 || response.status === 201) {
        toast.success(
          isEditing
            ? "Completion feedback updated successfully!"
            : "Completion feedback submitted successfully!"
        );

        onSuccess && onSuccess();
      }
    } catch (e) {
      console.error("Feedback submission error:", e);
      const errorMessage =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        `Failed to ${isEditing ? "update" : "submit"} feedback`;
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Custom formatter for completion feedback showing internship details
  const formatApplicationOption = (app) => (
    <div className="flex flex-col">
      <span className="font-medium text-text-primary">{app.internshipTitle} <span className="text-xs text-text-secondary font-normal">({app.internshipDuration})</span></span>
      <span className="text-xs text-primary font-medium mt-0.5">
        Student: {app.student?.user?.name || app.student?.name} ({app.student?.user?.rollNumber || app.student?.rollNumber})
      </span>
      <span className="text-xs text-text-tertiary">
        Branch: {app.student?.user?.branchName || app.student?.branchName}
      </span>
    </div>
  );

  // Initial values for completion feedback
  const initialValues = {
    isCompleted: true,
    recommendForHire: false,
  };

  return (
    <BaseFeedbackModal
      visible={visible}
      onCancel={onCancel}
      onSuccess={onSuccess}
      onSubmit={handleSubmit}
      loading={loading}
      title={editingFeedback ? "Edit Completion Feedback" : "Submit Completion Feedback"}
      type="completion"
      applications={applications}
      applicationsLoading={applicationsLoading}
      editingFeedback={editingFeedback}
      preSelectedApplicationId={preSelectedApplicationId}
      preSelectedStudentName={preSelectedStudentName}
      formatApplicationOption={formatApplicationOption}
      initialValues={initialValues}
    >
      {/* Industry Feedback Section */}
      <Card className="rounded-xl mb-4 border-border">
        <h4 className="font-semibold mb-4 flex items-center text-text-primary">
          🏢 Industry Feedback Section
        </h4>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Form.Item
              name="recommendForHire"
              label="Recommend for Future Employment"
              valuePropName="checked"
            >
              <Switch checkedChildren="Yes" unCheckedChildren="No" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="industryFeedback"
          label="Detailed Industry Feedback"
          rules={[
            {
              required: true,
              message: "Please provide detailed feedback",
            },
          ]}
        >
          <TextArea
            rows={4}
            placeholder="Provide comprehensive feedback about the student's performance, work quality, and overall contribution during the internship..."
            maxLength={1000}
            showCount
          />
        </Form.Item>

        <Form.Item
          name="finalPerformance"
          label="Final Performance Assessment"
        >
          <TextArea
            rows={3}
            placeholder="Summarize the student's final performance, achievements, and key contributions..."
            maxLength={500}
            showCount
          />
        </Form.Item>
      </Card>

      {/* Completion Details */}
      <Card className="rounded-xl mb-6 border-border">
        <h4 className="font-semibold mb-4 flex items-center text-text-primary">
          📜 Completion Details
        </h4>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Form.Item
              name="completionCertificate"
              label="Completion Certificate Reference"
            >
              <Input
                placeholder="Certificate ID, file path, or document reference"
                maxLength={200}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="isCompleted"
              label="Mark as Completed"
              valuePropName="checked"
            >
              <Switch
                checkedChildren="Completed"
                unCheckedChildren="In Progress"
              />
            </Form.Item>
          </Col>
        </Row>
      </Card>
    </BaseFeedbackModal>
  );
};

export default CompletionFeedbackModal;