import { leadService } from "../services/lead.service";
import catchAsync from "../utils/catchAsync";
import { parsePageParams } from "../utils/pagination";
import { sendSuccess } from "../utils/apiResponse";

const createLead = catchAsync(async (req, res) => {
  const lead = await leadService.create(req.body, req.user?.id);
  sendSuccess(res, 201, { lead });
});

const getLeads = catchAsync(async (req, res) => {
  const { items, ...pagination } = await leadService.list(parsePageParams(req.query));
  sendSuccess(res, 200, { leads: items }, { results: items.length, pagination });
});

const getLeadById = catchAsync(async (req, res) => {
  const lead = await leadService.getById((req.params as { id: string }).id);
  sendSuccess(res, 200, { lead });
});

const updateLead = catchAsync(async (req, res) => {
  const lead = await leadService.update((req.params as { id: string }).id, req.body, req.user?.id);
  sendSuccess(res, 200, { lead });
});

const deleteLead = catchAsync(async (req, res) => {
  await leadService.remove((req.params as { id: string }).id, req.user?.id);
  sendSuccess(res, 204, null);
});

export { createLead, getLeads, getLeadById, updateLead, deleteLead };
