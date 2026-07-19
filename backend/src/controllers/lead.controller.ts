import { leadRepository } from "../repositories";
import jobQueue from "../services/jobQueue.service";
import { JOB_TYPES } from "../jobs";
import { LEADS } from "../config/constants";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { parsePageParams } from "../utils/pagination";
import { sendSuccess } from "../utils/apiResponse";

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

  sendSuccess(res, 201, { lead: newLead });
});

const getLeads = catchAsync(async (req, res) => {
  const { page, limit } = parsePageParams(req.query);
  const { items, ...pagination } = await leadRepository.paginate(
    {},
    { page, limit, orderBy: { createdAt: "desc" } }
  );

  sendSuccess(res, 200, { leads: items }, { results: items.length, pagination });
});

const getLeadById = catchAsync(async (req, res, next) => {
  const { id } = req.params as { id: string };

  const lead = await leadRepository.findById(id);

  if (!lead) {
    return next(new AppError("No qualified lead found with that ID.", 404));
  }

  sendSuccess(res, 200, { lead });
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

  sendSuccess(res, 200, { lead: updatedLead });
});

const deleteLead = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };

  await leadRepository.delete(id);

  sendSuccess(res, 204, null);
});

export { createLead, getLeads, getLeadById, updateLead, deleteLead };
