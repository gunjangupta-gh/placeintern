import React, { useState } from 'react';
import { Modal, Button, Alert } from 'antd';
import { toast } from 'react-hot-toast';
import { CalendarOutlined, SendOutlined, UploadOutlined } from '@ant-design/icons';

const MonthlyFeedbackModal = ({
  visible,
  onCancel,
  onSubmit,
  loading,
}) => {
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
      ];

      if (!validTypes.includes(file.type)) {
        toast.error('Please upload a valid image file (JPEG, PNG, GIF, or WebP)');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }

      setImageFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    if (!imageFile) {
      toast('Please select an image', { icon: '⚠️' });
      return;
    }
    onSubmit(imageFile);
  };

  const handleClose = () => {
    setImageFile(null);
    setImagePreview(null);
    onCancel();
  };

  return (
    <Modal
      title={
        <div className="flex items-center text-green-700">
          <CalendarOutlined className="mr-2" />
          Upload Monthly Progress
        </div>
      }
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={600}
      className="rounded-2xl"
    >
      <div className="mt-6">
        <Alert
          title="Share Your Monthly Progress"
          description="Upload an image showing your work, achievements, or progress during this month."
          type="info"
          showIcon
          className="mb-6"
        />

        <div className="space-y-6">
          {/* Image Upload Section */}
          <div>
            <label className="block text-gray-700 font-medium mb-3">
              Select Progress Image *
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-500 transition-colors">
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleImageChange}
                className="hidden"
                id="progress-image-input"
              />
              <label
                htmlFor="progress-image-input"
                className="cursor-pointer block"
              >
                {imagePreview ? (
                  <div>
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-h-48 mx-auto rounded-lg mb-3"
                    />
                    <p className="text-sm text-gray-500">
                      Click to change image
                    </p>
                  </div>
                ) : (
                  <div className="py-8">
                    <UploadOutlined className="text-4xl text-gray-400 mb-3" />
                    <p className="text-gray-600">Click to upload image</p>
                    <p className="text-sm text-gray-400 mt-1">
                      JPEG, PNG, GIF, WebP (max 5MB)
                    </p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4 pt-4 border-t">
            <Button onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="primary"
              onClick={handleSubmit}
              loading={loading}
              disabled={!imageFile}
              className="bg-green-600 border-0"
              icon={<SendOutlined />}
            >
              Upload Progress
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default MonthlyFeedbackModal;
