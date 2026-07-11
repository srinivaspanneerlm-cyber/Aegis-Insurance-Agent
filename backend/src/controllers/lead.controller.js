const { leadRepository } = require("../repositories");
const jobQueue = require("../services/jobQueue.service");
const { JOB_TYPES } = require("../jobs");
const { LEADS } = require("../config/constants");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

const createLead = catchAsync(async (req, res, next) => {
  const { customerName, email, phone, insuranceType, budget } = req.body;

  const newLead = await leadRepository.create({
    customerName,
    email,
    phone,
    insuranceType,
    budget,
    status: "pending",
  });

  // Simulate machine-learning risk evaluation and move the lead to "approved".
  // Deferred to the background job queue (durable-ready) instead of an
  // in-request setTimeout — same effect and delay, but survives scale-out.
  jobQueue.schedule(
    JOB_TYPES.LEAD_AUTO_QUALIFY,
    { leadId: newLead.id },
    LEADS.AUTO_QUALIFY_DELAY_MS
  );

  res.status(201).json({
    status: "success",
    data: {
      lead: newLead,
    },
  });
});

const getLeads = catchAsync(async (req, res, next) => {
  const leads = await leadRepository.findMany({}, { orderBy: { createdAt: "desc" } });

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

  const lead = await leadRepository.findById(id);

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

  const updatedLead = await leadRepository.update(id, {
    customerName,
    email,
    phone,
    insuranceType,
    budget,
    status,
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

  await leadRepository.delete(id);

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
