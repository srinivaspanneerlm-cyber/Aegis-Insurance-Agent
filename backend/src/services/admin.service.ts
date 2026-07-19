import {
  leadRepository,
  chatRepository,
  documentRepository,
  userRepository,
} from "../repositories";

export const adminService = {
  /** Real-time dashboard counts across the core models (parallelised). */
  async getStats() {
    const [totalLeads, totalChats, uploadedDocuments, activeUsers] = await Promise.all([
      leadRepository.count(),
      chatRepository.count(),
      documentRepository.count(),
      userRepository.count(),
    ]);
    return { totalLeads, totalChats, uploadedDocuments, activeUsers };
  },
};
