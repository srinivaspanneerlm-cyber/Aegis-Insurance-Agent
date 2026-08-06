"use client";

import { useState } from "react";

export interface ProfileValues {
  age?: number | null;
  occupation?: string | null;
  incomeRange?: string | null;
  city?: string | null;
  state?: string | null;
  maritalStatus?: string | null;
  familyMembers?: number | null;
  dependents?: number | null;
  parentsDependent?: boolean | null;
  travelFrequency?: string | null;
  smoker?: boolean | null;
  riskPreference?: string | null;
  vehicles?: Array<{ kind: string; year?: number; commercial?: boolean }>;
  properties?: Array<{ kind: string; ownership: string }>;
  financialGoals?: string[];
  healthConditions?: string[];
}

export interface ProfileFormProps {
  initial: ProfileValues;
  onSave: (values: ProfileValues) => Promise<void> | void;
  saving?: boolean;
}

const INCOME_OPTIONS = [
  { value: "BELOW_3L", label: "Under ₹3 lakh a year" },
  { value: "3L_6L", label: "₹3–6 lakh" },
  { value: "6L_12L", label: "₹6–12 lakh" },
  { value: "12L_25L", label: "₹12–25 lakh" },
  { value: "ABOVE_25L", label: "Over ₹25 lakh" },
];

const TRAVEL_OPTIONS = [
  { value: "NEVER", label: "I do not travel" },
  { value: "RARE", label: "Rarely, within India" },
  { value: "OCCASIONAL", label: "A few times a year" },
  { value: "FREQUENT", label: "Often" },
  { value: "INTERNATIONAL", label: "Including abroad" },
];

const GOAL_OPTIONS = [
  { value: "INCOME_PROTECTION", label: "Protecting my family's income" },
  { value: "CHILD_EDUCATION", label: "My children's education" },
  { value: "RETIREMENT", label: "Retirement" },
  { value: "HOME_PURCHASE", label: "Buying a home" },
  { value: "DEBT_FREEDOM", label: "Clearing my loans" },
];

/**
 * The insurance profile, as a form.
 *
 * Nothing is required. The engine reports its own confidence and names the
 * facts that would raise it, so a half-answered form produces useful and
 * honestly-hedged advice — and a form that refuses to submit until every field
 * is filled produces no advice at all, which is worse.
 *
 * Health questions are last and explicitly optional, with the reason stated. A
 * platform that opens by asking about illnesses reads as an underwriter rather
 * than an adviser, and the people it most needs to reach will close the tab.
 */
export function ProfileForm({ initial, onSave, saving }: ProfileFormProps) {
  const [values, setValues] = useState<ProfileValues>(initial);

  const set = <K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const toggleGoal = (goal: string) =>
    setValues((v) => {
      const current = v.financialGoals ?? [];
      return {
        ...v,
        financialGoals: current.includes(goal)
          ? current.filter((g) => g !== goal)
          : [...current, goal],
      };
    });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(values);
      }}
      className="flex flex-col gap-8"
    >
      <Fieldset legend="About you" hint="Age and income shape almost everything else.">
        <Field label="Your age" htmlFor="age">
          <input
            id="age"
            type="number"
            min={18}
            max={100}
            value={values.age ?? ""}
            onChange={(e) => set("age", e.target.value ? Number(e.target.value) : null)}
            className={INPUT}
          />
        </Field>

        <Field label="Annual household income" htmlFor="income">
          <select
            id="income"
            value={values.incomeRange ?? ""}
            onChange={(e) => set("incomeRange", e.target.value || null)}
            className={INPUT}
          >
            <option value="">Prefer not to say</option>
            {INCOME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="What you do for a living" htmlFor="occupation">
          <input
            id="occupation"
            type="text"
            value={values.occupation ?? ""}
            onChange={(e) => set("occupation", e.target.value || null)}
            className={INPUT}
          />
        </Field>

        <Field label="City" htmlFor="city">
          <input
            id="city"
            type="text"
            value={values.city ?? ""}
            onChange={(e) => set("city", e.target.value || null)}
            className={INPUT}
          />
        </Field>
      </Fieldset>

      <Fieldset
        legend="Your household"
        hint="How many people depend on your income decides how much life cover you actually need — it is the single most useful thing you can tell us."
      >
        <Field label="People in your household" htmlFor="family">
          <input
            id="family"
            type="number"
            min={1}
            max={20}
            value={values.familyMembers ?? ""}
            onChange={(e) => set("familyMembers", e.target.value ? Number(e.target.value) : null)}
            className={INPUT}
          />
        </Field>

        <Field
          label="How many depend on your income"
          htmlFor="dependents"
          hint="Not the same as household size — a household with two earners is different."
        >
          <input
            id="dependents"
            type="number"
            min={0}
            max={20}
            value={values.dependents ?? ""}
            onChange={(e) => set("dependents", e.target.value ? Number(e.target.value) : null)}
            className={INPUT}
          />
        </Field>

        <Checkbox
          id="parents"
          label="I support my parents"
          checked={values.parentsDependent ?? false}
          onChange={(v) => set("parentsDependent", v)}
        />
      </Fieldset>

      <Fieldset legend="What you own and do">
        <Checkbox
          id="vehicle"
          label="I own a vehicle"
          checked={(values.vehicles?.length ?? 0) > 0}
          onChange={(v) => set("vehicles", v ? [{ kind: "CAR" }] : [])}
        />
        <Checkbox
          id="property"
          label="I own my home"
          checked={(values.properties?.length ?? 0) > 0}
          onChange={(v) => set("properties", v ? [{ kind: "HOUSE", ownership: "OWNED" }] : [])}
        />

        <Field label="How often you travel" htmlFor="travel">
          <select
            id="travel"
            value={values.travelFrequency ?? ""}
            onChange={(e) => set("travelFrequency", e.target.value || null)}
            className={INPUT}
          >
            <option value="">Not sure</option>
            {TRAVEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </Fieldset>

      <Fieldset legend="What you are saving for" hint="Choose any that apply.">
        <div className="flex flex-col gap-2">
          {GOAL_OPTIONS.map((goal) => (
            <Checkbox
              key={goal.value}
              id={`goal-${goal.value}`}
              label={goal.label}
              checked={(values.financialGoals ?? []).includes(goal.value)}
              onChange={() => toggleGoal(goal.value)}
            />
          ))}
        </div>
      </Fieldset>

      <Fieldset
        legend="Health (optional)"
        hint="You never have to answer this to get advice. It only helps us judge health cover, and we never treat a blank as a clean bill of health."
      >
        <Checkbox
          id="smoker"
          label="I smoke"
          checked={values.smoker ?? false}
          onChange={(v) => set("smoker", v)}
        />
      </Fieldset>

      <div>
        <button
          type="submit"
          disabled={saving}
          className="focus-ring rounded-control bg-brand text-brand-fg hover:bg-brand-hover text-body-sm px-5 py-2.5 font-semibold transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save and see my advice"}
        </button>
        <p className="text-caption text-content-muted mt-2">
          You can leave anything blank. We will tell you how sure we are, and what would help.
        </p>
      </div>
    </form>
  );
}

const INPUT =
  "h-10 w-full rounded-control border border-line/60 bg-surface-raised/40 px-3 text-body-sm text-content focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40";

function Fieldset({
  legend,
  hint,
  children,
}: {
  legend: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="text-body text-content font-semibold">{legend}</legend>
      {hint ? (
        <p className="text-caption text-content-secondary -mt-2 text-pretty">{hint}</p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-body-sm text-content font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-caption text-content-muted text-pretty">{hint}</p> : null}
    </div>
  );
}

function Checkbox({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="focus-ring border-line/60 h-4 w-4 rounded"
      />
      <label htmlFor={id} className="text-body-sm text-content">
        {label}
      </label>
    </div>
  );
}
