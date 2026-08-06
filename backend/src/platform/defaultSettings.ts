/**
 * The settings the console can change, and what they mean.
 *
 * Declared in code and seeded into the database, rather than created ad hoc by
 * whoever first needed one. A settings table anybody can insert into becomes a
 * table nobody can reason about — half the rows read by nothing, and no way to
 * tell which.
 *
 * Nothing here is a secret. Secrets stay in environment, where they are not
 * readable by a console, not written to an audit trail, and not one SQL
 * injection away from being disclosed.
 */
export interface SettingDefinition {
  readonly key: string;
  readonly value: string;
  readonly type: "string" | "number" | "boolean" | "json";
  readonly category: "auth" | "security" | "email" | "storage" | "ai" | "branding" | "general";
  readonly label: string;
  readonly description: string;
}

export const DEFAULT_SETTINGS: readonly SettingDefinition[] = [
  {
    key: "auth.customer_email_verification_required",
    value: "false",
    type: "boolean",
    category: "auth",
    label: "Require customers to verify their email before signing in",
    description:
      "Off by default. Stopping somebody at a mail client before they can read about cover is how a customer is lost; the verification gate belongs in front of actions that matter.",
  },
  {
    key: "auth.session_idle_timeout_minutes",
    value: "30",
    type: "number",
    category: "auth",
    label: "Customer idle timeout (minutes)",
    description:
      "How long a customer's session survives without activity. Shorter is safer on shared devices and more annoying everywhere else.",
  },
  {
    key: "security.lockout_threshold",
    value: "8",
    type: "number",
    category: "security",
    label: "Failed sign-ins before an account locks",
    description:
      "Counted per account. Lower is safer against password-list attacks and easier for somebody to use as a denial of service against a known address.",
  },
  {
    key: "security.audit_retention_days",
    value: "365",
    type: "number",
    category: "security",
    label: "Audit retention (days)",
    description:
      "How long audit entries are kept. Regulatory obligations usually set a floor here; check before lowering it.",
  },
  {
    key: "email.from_name",
    value: "Aegis AI",
    type: "string",
    category: "email",
    label: "Sender name on platform email",
    description: "Shown to customers in their inbox.",
  },
  {
    key: "storage.max_upload_mb",
    value: "50",
    type: "number",
    category: "storage",
    label: "Maximum upload size (MB)",
    description:
      "Per file. Raising it raises the memory a single request can consume, so raise it deliberately.",
  },
  {
    key: "ai.customer_assistant_enabled",
    value: "true",
    type: "boolean",
    category: "ai",
    label: "Customer AI assistant enabled",
    description:
      "A kill switch, not a feature flag. Turning this off stops the customer-facing assistant across the platform without a deployment — which is what you want at 3am and cannot get from a code change.",
  },
  {
    key: "ai.employee_assistant_enabled",
    value: "true",
    type: "boolean",
    category: "ai",
    label: "Employee assistant enabled",
    description:
      "Off, employees complete workflow steps themselves. The human decision steps are unaffected either way — they were never the assistant's to complete.",
  },
  {
    key: "branding.support_email",
    value: "support@aegis.ai",
    type: "string",
    category: "branding",
    label: "Support address shown to users",
    description: "Used on access-denied screens and in platform email.",
  },
  {
    key: "general.maintenance_banner",
    value: "",
    type: "string",
    category: "general",
    label: "Maintenance banner",
    description:
      "Shown across every portal when set. Empty means no banner. Use it before planned work rather than after somebody notices.",
  },
];

/**
 * Ensure every declared setting exists, without overwriting one an operator has
 * already changed.
 *
 * An upsert that reset values on boot would silently undo the last incident's
 * configuration change every time the process restarted.
 */
export async function seedSettings(prisma: {
  platformSetting: {
    findUnique: (args: { where: { key: string } }) => Promise<unknown>;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
}): Promise<number> {
  let created = 0;
  for (const setting of DEFAULT_SETTINGS) {
    const existing = await prisma.platformSetting.findUnique({ where: { key: setting.key } });
    if (existing) continue;
    await prisma.platformSetting.create({ data: { ...setting } });
    created += 1;
  }
  return created;
}
