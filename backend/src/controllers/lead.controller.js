const prisma = require("../config/db");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

const createLead = catchAsync(async (req, res, next) => {
  const { customerName, email, phone, insuranceType, budget } = req.body;

  const newLead = await prisma.lead.create({
    data: {
      customerName,
      email,
      phone,
      insuranceType,
      budget,
      status: "pending",
    },
  });

  // Simulate machine-learning risk evaluation and update status to approved
  setTimeout(async () => {
    try {
      await prisma.lead.update({
        where: { id: newLead.id },
        data: { status: "approved" },
      });
      console.log(`Lead ${newLead.id} status successfully qualified & approved.`);
    } catch (err) {
      console.error("Async underwriting update failed", err);
    }
  }, 5000);

  res.status(201).json({
    status: "success",
    data: {
      lead: newLead,
    },
  });
});

const getLeads = catchAsync(async (req, res, next) => {
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
  });

  res.status(200).json({
    status: "success",
    results: leads.length,
    data: {
      leads,
    },
  });
});

const getLeadById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const lead = await prisma.lead.findUnique({
    where: { id },
  });

  if (!lead) {
    return next(new AppError("No qualified lead found with that ID.", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      lead,
    },
  });
});

const updateLead = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { customerName, email, phone, insuranceType, budget, status } = req.body;

  const updatedLead = await prisma.lead.update({
    where: { id },
    data: {
      customerName,
      email,
      phone,
      insuranceType,
      budget,
      status,
    },
  });

  res.status(200).json({
    status: "success",
    data: {
      lead: updatedLead,
    },
  });
});

const deleteLead = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  await prisma.lead.delete({
    where: { id },
  });

  res.status(204).json({
    status: "success",
    data: null,
  });
});

module.exports = {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  deleteLead,
};
