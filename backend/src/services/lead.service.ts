import { leadRepository } from "../repositories";
import jobQueue from "./jobQueue.service";
import { JOB_TYPES } from "../jobs";
import { LEADS } from "../config/constants";
import AppError from "../utils/appError";
import type { PageParams } from "../utils/pagination";

interface LeadInput {
  customerName: string;
  email: string;
  phone: string;
  insuranceType: string;
  budget: string;
}

/** Business logic for underwriting leads. Controllers stay thin. */
export const leadService = {
  async create(input: LeadInput) {
    const lead = await leadRepository.create({ ...input, status: "pending" });

    // Simulate ML risk evaluation and move the lead to "approved" — deferred to
    // the durable-ready job queue instead of an in-request setTimeout.
    jobQueue.schedule(
      JOB_TYPES.LEAD_AUTO_QUALIFY,
      { leadId: lead.id },
      LEADS.AUTO_QUALIFY_DELAY_MS
    );
    return lead;
  },

  list({ page, limit }: PageParams) {
    return leadRepository.paginate({}, { page, limit, orderBy: { createdAt: "desc" } });
  },

  async getById(id: string) {
    const lead = await leadRepository.findById(id);
    if (!lead) throw new AppError("No qualified lead found with that ID.", 404);
    return lead;
  },

  update(id: string, input: Partial<LeadInput> & { status?: string }) {
    return leadRepository.update(id, { ...input });
  },

  remove(id: string) {
    return leadRepository.delete(id);
  },
};
