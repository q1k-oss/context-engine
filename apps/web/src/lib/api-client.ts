const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const apiClient = {
  // Sessions
  async createSession(title?: string) {
    const res = await fetch(`${API_URL}/api/chat/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    return res.json();
  },

  async getSession(sessionId: string) {
    const res = await fetch(`${API_URL}/api/chat/sessions/${sessionId}`);
    return res.json();
  },

  async listSessions() {
    const res = await fetch(`${API_URL}/api/chat/sessions`);
    return res.json();
  },

  async deleteSession(sessionId: string) {
    const res = await fetch(`${API_URL}/api/chat/sessions/${sessionId}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  // Messages - returns EventSource for SSE streaming
  sendMessage(sessionId: string, content: string, fileIds?: string[]) {
    return fetch(`${API_URL}/api/chat/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, fileIds }),
    });
  },

  // Files
  async uploadFile(sessionId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sessionId', sessionId);

    const res = await fetch(`${API_URL}/api/files/upload`, {
      method: 'POST',
      body: formData,
    });
    return res.json();
  },

  async getFile(fileId: string) {
    const res = await fetch(`${API_URL}/api/files/${fileId}`);
    return res.json();
  },

  async getFileContent(fileId: string) {
    const res = await fetch(`${API_URL}/api/files/${fileId}/content`);
    return res.json();
  },

  // Graph
  async getGraph(sessionId: string) {
    const res = await fetch(`${API_URL}/api/graph/${sessionId}`);
    return res.json();
  },

  async getGraphVersions(sessionId: string) {
    const res = await fetch(`${API_URL}/api/graph/${sessionId}/versions`);
    return res.json();
  },

  async getGraphVersion(sessionId: string, version: number) {
    const res = await fetch(`${API_URL}/api/graph/${sessionId}/versions/${version}`);
    return res.json();
  },

  async getDeltas(sessionId: string) {
    const res = await fetch(`${API_URL}/api/graph/${sessionId}/deltas`);
    return res.json();
  },

  async getDelta(sessionId: string, deltaId: string) {
    const res = await fetch(`${API_URL}/api/graph/${sessionId}/deltas/${deltaId}`);
    return res.json();
  },
};
