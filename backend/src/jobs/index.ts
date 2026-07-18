/**
 * Job registry — wires background job handlers to the queue at boot.
 *
 * Controllers enqueue jobs by type; the handlers live here, decoupled from the
 * request path. Adding notification / email / analytics / recommendation jobs
 * later means registering another handler — no controller or transport change.
 */
import jobQueue from "../services/jobQueue.service";
import { leadRepository } from "../repositories";

export const JOB_TYPES = Object.freeze({
  LEAD_AUTO_QUALIFY: "lead.autoQualify",
  // Future: NOTIFICATION_SEND, EMAIL_SEND, RECOMMENDATION_GENERATE,
  //         CONVERSATION_SUMMARIZE, ANALYTICS_ROLLUP, REPORT_GENERATE
});

export function registerJobs(): typeof jobQueue {
  // Preserves the previous in-request setTimeout behaviour exactly: after the
  // configured delay, move the lead to "approved".
  jobQueue.register(JOB_TYPES.LEAD_AUTO_QUALIFY, async ({ leadId }: { leadId: string }) => {
    await leadRepository.update(leadId, { status: "approved" });
    console.log(`Lead ${leadId} status successfully qualified & approved.`);
  });

  return jobQueue;
}
