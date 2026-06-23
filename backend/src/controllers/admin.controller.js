const prisma = require("../config/db");
const catchAsync = require("../utils/catchAsync");

const getDashboardStats = catchAsync(async (req, res, next) => {
  // Aggregate real-time statistics across all our models
  const totalLeads = await prisma.lead.count();
  const totalChats = await prisma.chat.count();
  const uploadedDocuments = await prisma.uploadedDocument.count();
  const activeUsers = await prisma.user.count();

  // Return the dynamic statistical payload to the frontend
  res.status(200).json({
    status: "success",
    data: {
      totalLeads,
      totalChats,
      uploadedDocuments,
      activeUsers,
    },
  });
});

module.exports = {
  getDashboardStats,
};
