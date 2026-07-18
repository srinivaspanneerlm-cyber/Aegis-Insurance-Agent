import { leadRepository } from "../repositories";
import jobQueue from "../services/jobQueue.service";
import { JOB_TYPES } from "../jobs";
import { LEADS } from "../config/constants";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";

const createLead = catchAsync(async (req, res) => {
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

const getLeads = catchAsync(async (req, res) => {
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
  const { id } = req.params as { id: string };

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

const updateLead = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
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

const deleteLead = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };

  await leadRepository.delete(id);

  res.status(204).json({
    status: "success",
    data: null,
  });
});

export { createLead, getLeads, getLeadById, updateLead, deleteLead };
