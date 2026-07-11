/**
 * Job registry — wires background job handlers to the queue at boot.
 *
 * Controllers enqueue jobs by type; the handlers live here, decoupled from the
 * request path. Adding notification / email / analytics / recommendation jobs
 * later means registering another handler — no controller or transport change.
 */
const jobQueue = require("../services/jobQueue.service");
const { leadRepository } = require("../repositories");

const JOB_TYPES = Object.freeze({
  LEAD_AUTO_QUALIFY: "lead.autoQualify",
  // Future: NOTIFICATION_SEND, EMAIL_SEND, RECOMMENDATION_GENERATE,
  //         CONVERSATION_SUMMARIZE, ANALYTICS_ROLLUP, REPORT_GENERATE
});

function registerJobs() {
  // Preserves the previous in-request setTimeout behaviour exactly: after the
  // configured delay, move the lead to "approved".
  jobQueue.register(JOB_TYPES.LEAD_AUTO_QUALIFY, async ({ leadId }) => {
    await leadRepository.update(leadId, { status: "approved" });
    // eslint-disable-next-line no-console
    console.log(`Lead ${leadId} status successfully qualified & approved.`);
  });

  return jobQueue;
}

module.exports = { registerJobs, JOB_TYPES };
