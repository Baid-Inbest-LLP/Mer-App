import api from './axios';

export const notificationApi = {
  getDueConfig: () => api.get('/notifications/due'),
  updateDueConfig: (data) => api.put('/notifications/due', data),
  sendToRecipient: (recipientId) => api.post(`/notifications/due/recipients/${recipientId}/send`),
};
