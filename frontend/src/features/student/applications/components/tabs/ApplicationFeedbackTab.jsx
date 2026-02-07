import React from 'react';
import { Card, Button, Typography, Empty } from 'antd';
import { TrophyOutlined, BankOutlined, MessageOutlined } from '@ant-design/icons';
import StarRating from '../StarRating';

const { Text, Paragraph } = Typography;

const ApplicationFeedbackTab = ({ application, completionFeedback, onOpenFeedbackModal }) => (
  <div className="space-y-4">
    {/* Completion Feedback */}
    <Card
      className="rounded-xl"
      title={
        <div className="flex items-center gap-2">
          <TrophyOutlined className="text-yellow-500" />
          Internship Feedback
        </div>
      }
      extra={
        application.status === 'COMPLETED' && !completionFeedback?.studentFeedback && (
          <Button
            type="primary"
            icon={<MessageOutlined />}
            onClick={() => onOpenFeedbackModal(application)}
            className="bg-green-600"
          >
            Submit Feedback
          </Button>
        )
      }
    >
      {completionFeedback?.studentFeedback ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Text strong>Your Rating:</Text>
            <StarRating rating={completionFeedback.studentRating || 0} />
          </div>
          <div>
            <Text strong>Your Feedback:</Text>
            <Paragraph className="mt-1 text-gray-600">
              {completionFeedback.studentFeedback}
            </Paragraph>
          </div>
          {completionFeedback.skillsLearned && (
            <div>
              <Text strong>Skills Learned:</Text>
              <Paragraph className="mt-1 text-gray-600">
                {completionFeedback.skillsLearned}
              </Paragraph>
            </div>
          )}
        </div>
      ) : (
        <Empty
          description={
            application.status === 'COMPLETED'
              ? 'Submit your feedback about this internship'
              : 'Feedback can be submitted after internship completion'
          }
        />
      )}
    </Card>

    {/* Industry Feedback */}
    {completionFeedback?.industryFeedback && (
      <Card
        className="rounded-xl"
        title={
          <div className="flex items-center gap-2">
            <BankOutlined className="text-blue-500" />
            Industry Feedback
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Text strong>Rating:</Text>
            <StarRating rating={completionFeedback.industryRating || 0} />
          </div>
          <div>
            <Text strong>Feedback:</Text>
            <Paragraph className="mt-1 text-gray-600">
              {completionFeedback.industryFeedback}
            </Paragraph>
          </div>
        </div>
      </Card>
    )}
  </div>
);

export default ApplicationFeedbackTab;
