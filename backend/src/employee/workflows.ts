/**
 * The workflows an employee moves work through.
 *
 * These are definitions in reviewed code, not rows in a table. A claim that was
 * approved in March has to be explainable in September, and a workflow anybody
 * could edit at runtime cannot be reasoned about after the fact — "which steps
 * did this claim actually go through" would have no stable answer. Changing a
 * definition here is a code review, which is the correct weight for changing
 * how claims get decided.
 *
 * Two properties every definition must hold, and both are enforced below:
 *
 *  1. **A decision step is always a person.** The assistant may analyse, weigh
 *     and recommend; it never approves. That is not caution about model
 *     quality, it is that somebody must be answerable for the outcome, and
 *     "the software decided" is not an answer a regulator or a customer will
 *     accept.
 *  2. **Every run ends somewhere.** A definition whose last step is not
 *     terminal would leave work sitting in a queue nobody owns.
 */

export const WORKFLOW_DEFINITIONS = [
  "CLAIM_APPROVAL",
  "KYC",
  "RENEWAL",
  "COMPLAINT",
] as const;
export type WorkflowDefinition = (typeof WORKFLOW_DEFINITIONS)[number];

export const isWorkflowDefinition = (value: unknown): value is WorkflowDefinition =>
  typeof value === "string" && (WORKFLOW_DEFINITIONS as readonly string[]).includes(value);

/** Who is expected to complete a step. */
export type ActorKind = "SYSTEM" | "ASSISTANT" | "EMPLOYEE";

export const DECISIONS = ["APPROVE", "REJECT", "ESCALATE", "REQUEST_INFO"] as const;
export type Decision = (typeof DECISIONS)[number];

export interface StepDefinition {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly actorKind: ActorKind;
  /**
   * A step that cannot be completed without a decision. Only ever EMPLOYEE —
   * asserted at module load, so a definition that tried to let the assistant
   * decide would fail to boot rather than fail in production.
   */
  readonly requiresDecision?: boolean;
  /** Which capability an employee needs to complete it. */
  readonly permission?: "workflow.advance" | "workflow.approve";
}

interface WorkflowSpec {
  readonly definition: WorkflowDefinition;
  readonly label: string;
  /** The work item kind this workflow belongs to. */
  readonly kind: string;
  readonly steps: readonly StepDefinition[];
}

const CLAIM_APPROVAL: WorkflowSpec = {
  definition: "CLAIM_APPROVAL",
  label: "Claim approval",
  kind: "CLAIM",
  steps: [
    {
      key: "intake",
      name: "Intake",
      description: "The claim is registered and the customer's cover is located.",
      actorKind: "SYSTEM",
    },
    {
      key: "document_validation",
      name: "Document validation",
      description:
        "Every required document is present, legible and consistent with the claim.",
      actorKind: "ASSISTANT",
    },
    {
      key: "risk_analysis",
      name: "Risk analysis",
      description:
        "Consistency and pattern signals across the claim, the policy and the history behind it.",
      actorKind: "ASSISTANT",
    },
    {
      key: "recommendation",
      name: "Recommendation",
      description: "A suggested outcome, with the reasoning that produced it.",
      actorKind: "ASSISTANT",
    },
    {
      key: "human_approval",
      name: "Human approval",
      description:
        "An employee decides. The recommendation is advice; this is the decision, and it is theirs.",
      actorKind: "EMPLOYEE",
      requiresDecision: true,
      permission: "workflow.approve",
    },
    {
      key: "settlement",
      name: "Settlement",
      description: "The approved outcome is actioned and the customer is told.",
      actorKind: "EMPLOYEE",
      permission: "workflow.advance",
    },
  ],
};

const KYC: WorkflowSpec = {
  definition: "KYC",
  label: "KYC verification",
  kind: "KYC",
  steps: [
    {
      key: "collection",
      name: "Document collection",
      description: "Identity and address documents are gathered from the customer.",
      actorKind: "SYSTEM",
    },
    {
      key: "document_validation",
      name: "Document validation",
      description: "Documents are checked for legibility, expiry and tampering.",
      actorKind: "ASSISTANT",
    },
    {
      key: "identity_match",
      name: "Identity match",
      description: "Details on the documents are matched against the application.",
      actorKind: "ASSISTANT",
    },
    {
      key: "human_verification",
      name: "Employee verification",
      description: "An employee confirms the identity is established.",
      actorKind: "EMPLOYEE",
      requiresDecision: true,
      permission: "workflow.approve",
    },
  ],
};

const RENEWAL: WorkflowSpec = {
  definition: "RENEWAL",
  label: "Policy renewal",
  kind: "RENEWAL",
  steps: [
    {
      key: "expiry_detection",
      name: "Expiry detection",
      description: "The policy is approaching its end date and enters the renewal queue.",
      actorKind: "SYSTEM",
    },
    {
      key: "customer_analysis",
      name: "Customer analysis",
      description:
        "What has changed since the last term — cover held, claims made, circumstances.",
      actorKind: "ASSISTANT",
    },
    {
      key: "offer_recommendation",
      name: "Offer recommendation",
      description: "A suggested renewal, with what changed and why it is suggested.",
      actorKind: "ASSISTANT",
    },
    {
      key: "employee_review",
      name: "Employee review",
      description: "An employee checks the offer is right for this customer before it is made.",
      actorKind: "EMPLOYEE",
      requiresDecision: true,
      permission: "workflow.advance",
    },
    {
      key: "customer_contact",
      name: "Customer contact",
      description: "The customer is contacted with the renewal.",
      actorKind: "EMPLOYEE",
      permission: "workflow.advance",
    },
  ],
};

const COMPLAINT: WorkflowSpec = {
  definition: "COMPLAINT",
  label: "Customer complaint",
  kind: "COMPLAINT",
  steps: [
    {
      key: "classification",
      name: "Classification",
      description: "What the complaint is actually about, in the platform's own categories.",
      actorKind: "ASSISTANT",
    },
    {
      key: "priority_assignment",
      name: "Priority assignment",
      description: "How quickly this needs answering, and against which promise.",
      actorKind: "ASSISTANT",
    },
    {
      key: "suggested_resolution",
      name: "Suggested resolution",
      description: "A proposed remedy, drawn from how comparable complaints were resolved.",
      actorKind: "ASSISTANT",
    },
    {
      key: "employee_response",
      name: "Employee response",
      description: "An employee answers the customer in their own words.",
      actorKind: "EMPLOYEE",
      requiresDecision: true,
      permission: "workflow.advance",
    },
    {
      key: "closure",
      name: "Closure",
      description: "The complaint is closed once the customer has been answered.",
      actorKind: "EMPLOYEE",
      permission: "workflow.advance",
    },
  ],
};

const SPECS: Record<WorkflowDefinition, WorkflowSpec> = {
  CLAIM_APPROVAL,
  KYC,
  RENEWAL,
  COMPLAINT,
};

export const workflowSpec = (definition: WorkflowDefinition): WorkflowSpec => SPECS[definition];

/** The workflow a kind of work runs, or null for work that has no process. */
export function definitionForKind(kind: string): WorkflowDefinition | null {
  const found = Object.values(SPECS).find((spec) => spec.kind === kind);
  return found ? found.definition : null;
}

/** The step after this one, or null when the run is finished. */
export function nextStep(
  definition: WorkflowDefinition,
  currentKey: string | null
): StepDefinition | null {
  const { steps } = SPECS[definition];
  if (currentKey === null) return steps[0] ?? null;
  const index = steps.findIndex((step) => step.key === currentKey);
  if (index === -1) return null;
  return steps[index + 1] ?? null;
}

export function stepAt(definition: WorkflowDefinition, key: string): StepDefinition | null {
  return SPECS[definition].steps.find((step) => step.key === key) ?? null;
}

/**
 * Enforced at module load rather than trusted.
 *
 * A definition that let the assistant approve something would be a silent,
 * catastrophic change — the kind that looks fine in review because it is one
 * word. Refusing to boot is the right response.
 */
for (const spec of Object.values(SPECS)) {
  if (spec.steps.length === 0) {
    throw new Error(`Workflow "${spec.definition}" has no steps.`);
  }
  for (const step of spec.steps) {
    if (step.requiresDecision && step.actorKind !== "EMPLOYEE") {
      throw new Error(
        `Workflow "${spec.definition}" step "${step.key}" asks a ${step.actorKind} for a decision. ` +
          "Only a person may decide — somebody has to be answerable for the outcome."
      );
    }
  }
  const decisions = spec.steps.filter((step) => step.requiresDecision);
  if (decisions.length === 0) {
    throw new Error(
      `Workflow "${spec.definition}" has no human decision step. Every process that ` +
        "affects a customer must pass through a person."
    );
  }
}
