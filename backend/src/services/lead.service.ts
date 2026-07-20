import { leadRepository } from "../repositories";
import jobQueue from "./jobQueue.service";
import { auditService } from "./audit.service";
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
  async create(input: LeadInput, actorId?: string) {
    const lead = await leadRepository.create({ ...input, status: "pending" });

    // Simulate ML risk evaluation and move the lead to "approved" — deferred to
    // the durable-ready job queue instead of an in-request setTimeout.
    jobQueue.schedule(
      JOB_TYPES.LEAD_AUTO_QUALIFY,
      { leadId: lead.id },
      LEADS.AUTO_QUALIFY_DELAY_MS
    );
    auditService.record({ actorId, action: "lead.created", entity: "Lead", entityId: lead.id });
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

  async update(id: string, input: Partial<LeadInput> & { status?: string }, actorId?: string) {
    const lead = await leadRepository.update(id, { ...input });
    auditService.record({ actorId, action: "lead.updated", entity: "Lead", entityId: id, metadata: { status: input.status } });
    return lead;
  },

  async remove(id: string, actorId?: string) {
    await leadRepository.delete(id);
    auditService.record({ actorId, action: "lead.deleted", entity: "Lead", entityId: id });
  },
};
