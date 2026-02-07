export interface NotificationPayload {
  id: string;
  title: string;
  body: string;
  type: string | null;
  data: any;
  read: boolean;
  createdAt: Date;
}

export interface UnreadCountPayload {
  count: number;
}

export interface MarkAsReadPayload {
  notificationId: string;
}
