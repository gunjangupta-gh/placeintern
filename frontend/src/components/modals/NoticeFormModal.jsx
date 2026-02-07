// === src/components/NoticeFormModal.jsx ===
import React, { useEffect } from "react";
import { Modal, Form, Input, message } from "antd";
import API from "../../services/api";
import { toast } from "react-hot-toast";

const NoticeFormModal = ({ open, onClose, onSuccess, editingNotice }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      if (editingNotice) {
        form.setFieldsValue(editingNotice);
      } else {
        form.resetFields();
      }
    }
  }, [open, editingNotice, form]);

  const handleSubmit = async (values) => {
    try {
      // Get institution ID from localStorage
      const loginData = localStorage.getItem("loginResponse");
      const parsed = JSON.parse(loginData);
      const institutionId = parsed?.user?.institutionId;

      // Include institutionId in the payload
      const payload = {
        ...values,
        institutionId
      };

      if (editingNotice) {
        await API.put(`/notice/${editingNotice.id}`, payload);
        toast.success("Notice updated successfully");
      } else {
        await API.post("/notice", payload);
        toast.success("Notice created successfully");
      }
      onSuccess();
      onClose();
    } catch {
      toast.error("Failed to submit notice");
    }
  };

  return (
    <Modal
      title={editingNotice ? "Edit Notice" : "Add Notice"}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={editingNotice ? "Update" : "Create"}
      className="rounded-xl"
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="title"
          label="Title"
          rules={[{ required: true, message: "Please enter the notice title" }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="message"
          label="Message"
          rules={[{ required: true, message: "Please enter the message" }]}
        >
          <Input.TextArea rows={4} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default NoticeFormModal;