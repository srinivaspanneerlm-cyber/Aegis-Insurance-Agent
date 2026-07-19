import {
  leadRepository,
  chatRepository,
  documentRepository,
  userRepository,
} from "../repositories";
import catchAsync from "../utils/catchAsync";
import { sendSuccess } from "../utils/apiResponse";

const getDashboardStats = catchAsync(async (req, res) => {
  // Aggregate real-time statistics across all our models (parallelised).
  const [totalLeads, totalChats, uploadedDocuments, activeUsers] = await Promise.all([
    leadRepository.count(),
    chatRepository.count(),
    documentRepository.count(),
    userRepository.count(),
  ]);

  // Return the dynamic statistical payload to the frontend
  sendSuccess(res, 200, { totalLeads, totalChats, uploadedDocuments, activeUsers });
});

export { getDashboardStats };
