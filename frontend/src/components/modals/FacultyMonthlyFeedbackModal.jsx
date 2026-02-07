// src/components/FacultyMonthlyFeedbackModal.jsx
import React, { useState, useEffect } from "react";
import { Form, Input, Card, Row, Col } from "antd";
import { toast } from "react-hot-toast";
import API from "../../services/api";
import BaseFeedbackModal from "./BaseFeedbackModal";

const { TextArea } = Input;

const FacultyMonthlyFeedbackModal = ({
  visible,
  onCancel,
  onSuccess,
  preSelectedApplicationId = null,
  preSelectedStudentName = null,
  editingFeedback = null,
  assignedStudents = [],
}) => {
  const [loading, setLoading] = useState(false);

  // Extract all applications from assigned students
  const allApplications = React.useMemo(() => {
    if (!Array.isArray(assignedStudents)) return [];

    return assignedStudents.flatMap((mentorAssignment) => {
      const student = mentorAssignment.student;
      const applications = student?.internshipApplications || [];

      return applications
        .filter((app) => app.internshipPhase === "ACTIVE" || app.status === "SELECTED" || app.status === "ACTIVE")
        .map((app) => ({
          ...app,
          studentName: student?.user?.name || student.name,
          studentRollNumber: student?.user?.rollNumber || student.rollNumber,
          studentId: student.id,
        }));
    });
  }, [assignedStudents]);

  useEffect(() => {
    if (preSelectedStudentName && preSelectedApplicationId) {
      toast.info(`Creating monthly feedback for ${preSelectedStudentName}`);
    }
  }, [preSelectedApplicationId, preSelectedStudentName]);

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

  // Custom formatter for faculty view showing student info first
  const formatApplicationOption = (app) => (
    <div className="flex flex-col">
      <span className="font-medium text-text-primary">
        {app.studentName} ({app.studentRollNumber})
      </span>
      <span className="text-xs text-text-secondary">
        {app.internship?.title || "N/A"}
      </span>
      <span className="text-xs text-primary font-medium">
        Company: {app.internship?.industry?.companyName || app.companyName || "N/A"}
      </span>
    </div>
  );

  return (
    <BaseFeedbackModal
      visible={visible}
      onCancel={onCancel}
      onSuccess={onSuccess}
      onSubmit={handleSubmit}
      loading={loading}
      title={editingFeedback ? "Edit Monthly Feedback" : "Add Monthly Feedback"}
      type="monthly"
      applications={allApplications}
      applicationsLoading={false}
      editingFeedback={editingFeedback}
      preSelectedApplicationId={preSelectedApplicationId}
      preSelectedStudentName={preSelectedStudentName}
      formatApplicationOption={formatApplicationOption}
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

export default FacultyMonthlyFeedbackModal;