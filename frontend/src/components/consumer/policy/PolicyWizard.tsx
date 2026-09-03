"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { localise } from "@/lib/documents/localise";
import type { DocumentLocale } from "@/types/documents";
import {
  EMPTY_DRAFT,
  FORM_STEPS,
  REVIEW_STEP_INDEX,
  hasErrors,
  toCreatePayload,
  toUpdatePayload,
  validateDraft,
  validateStep,
  type DraftErrors,
  type DraftField,
  type FormMode,
  type PolicyDraft,
} from "@/lib/consumer/policyForm";
import {
  POLICY_TYPE_CHOICES,
  VEHICLE_TYPE_CHOICES,
  policyTypeChoice,
  type PolicyType,
  type VehicleType,
} from "@/lib/consumer/vocabulary";
import { ChoiceField, DateField, TextField } from "./fields";

/**
 * The manual policy form.
 *
 * Six short screens rather than one long one. The reason is the audience: a
 * single form asking nine questions at once is where a first-time buyer on a
 * phone gives up — no visible progress, errors that scroll the question out of
 * view, and no point at which stopping feels safe.
 *
 * Errors appear when a step is left, not while somebody is still typing. A
 * field that turns red on the second character tells a nervous user they are
 * failing at something they have not finished doing.
 *
 * The whole draft is re-validated before submitting, not just the last step.
 * Someone who goes back and clears their vehicle number would otherwise reach
 * the API on the strength of a step that passed ten screens ago.
 */

export interface PolicyWizardProps {
  locale?: DocumentLocale;
  /**
   * Adding a policy, or correcting one that is already saved.
   *
   * The screens are the same either way, deliberately. Somebody fixing a wrong
   * expiry date should not have to learn a second layout to do it, and the one
   * rule that genuinely differs — a blank policy number means "keep the one you
   * have" — is stated on the screen it appears on rather than assumed.
   */
  mode?: FormMode;
  /** What the form starts with. Defaults to an empty one. */
  initialDraft?: PolicyDraft;
  /**
   * The masked number already stored, shown while editing so the customer can
   * see we still hold it. Never editable — it is not the real value.
   */
  policyNumberMasked?: string | null;
  /** Persists the policy. Rejects with a message the customer can read. */
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  onCancel?: () => void;
}

export function PolicyWizard({
  locale = "en",
  mode = "create",
  initialDraft,
  policyNumberMasked,
  onSubmit,
  onCancel,
}: PolicyWizardProps) {
  const isEdit = mode === "edit";
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<PolicyDraft>(initialDraft ?? EMPTY_DRAFT);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const step = FORM_STEPS[stepIndex];
  const isReview = stepIndex === REVIEW_STEP_INDEX;

  const set = (field: DraftField) => (value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    // Clear this field's error as soon as it is touched. Leaving it up while
    // somebody corrects it makes the form feel like it is still complaining.
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const goBack = () => {
    setErrors({});
    setSubmitError(null);
    if (stepIndex === 0) onCancel?.();
    else setStepIndex((index) => index - 1);
  };

  const goNext = () => {
    const stepErrors = validateStep(stepIndex, draft, mode);
    if (hasErrors(stepErrors)) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    setStepIndex((index) => index + 1);
  };

  const submit = async () => {
    const allErrors = validateDraft(draft, mode);
    if (hasErrors(allErrors)) {
      setErrors(allErrors);
      // Send them back to the first screen that has a problem, rather than
      // reporting an error about a field they cannot see.
      const firstBad = FORM_STEPS.findIndex((s) => s.fields.some((f) => allErrors[f]));
      if (firstBad >= 0) setStepIndex(firstBad);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(isEdit ? toUpdatePayload(draft) : toCreatePayload(draft));
    } catch (error) {
      // Whatever went wrong, the customer keeps everything they typed. Losing a
      // filled-in form to a network blip is how people stop coming back.
      setSubmitError(
        error instanceof Error && error.message
          ? error.message
          : "We could not save that just now. Please try again."
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <ProgressBar current={stepIndex} total={FORM_STEPS.length} />

      <header className="flex flex-col gap-1.5">
        <h2 className="text-xl font-bold leading-snug text-content">
          {localise(step.title, locale)}
        </h2>
        <p className="text-sm font-medium leading-relaxed text-content-muted">
          {localise(step.help, locale)}
        </p>
      </header>

      <div className="flex flex-col gap-5">
        {step.id === "vehicle" && (
          <>
            <TextField
              name="registrationNumber"
              label={{ en: "Vehicle number", ta: "வாகன எண்", taEn: "Vandi number" }}
              hint={{
                en: "As it appears on your number plate, for example TN 09 AB 1234.",
                ta: "உங்கள் பதிவு எண் தகட்டில் உள்ளபடி, உதாரணமாக TN 09 AB 1234.",
                taEn: "Ungal number plate-la irukkura maadhiri, example TN 09 AB 1234.",
              }}
              required
              autoCapitalize="characters"
              placeholder="TN 09 AB 1234"
              locale={locale}
              value={draft.registrationNumber}
              onChange={set("registrationNumber")}
              error={errors.registrationNumber}
            />
            <ChoiceField<VehicleType>
              name="vehicleType"
              legend={{ en: "What kind of vehicle?", ta: "எந்த வகை வாகனம்?", taEn: "Enna vagai vandi?" }}
              options={VEHICLE_TYPE_CHOICES}
              locale={locale}
              value={draft.vehicleType}
              onChange={(value) => set("vehicleType")(value)}
              error={errors.vehicleType}
            />
          </>
        )}

        {step.id === "insurer" && (
          <>
            <TextField
              name="insurer"
              label={{ en: "Insurance company", ta: "காப்பீட்டு நிறுவனம்", taEn: "Insurance company" }}
              required
              locale={locale}
              value={draft.insurer}
              onChange={set("insurer")}
              error={errors.insurer}
            />
            <TextField
              name="policyNumber"
              label={{ en: "Policy number", ta: "பாலிசி எண்", taEn: "Policy number" }}
              hint={
                isEdit
                  ? {
                      // Said plainly, because a box that looks empty next to a
                      // number we claim to hold otherwise reads as data loss.
                      en: `We already hold this one${policyNumberMasked ? ` (${policyNumberMasked})` : ""}. Leave it blank to keep it, or type it again to change it.`,
                      ta: `இது எங்களிடம் ஏற்கனவே உள்ளது${policyNumberMasked ? ` (${policyNumberMasked})` : ""}. அப்படியே வைத்திருக்க காலியாக விடுங்கள், மாற்ற வேண்டுமானால் மீண்டும் தட்டச்சு செய்யுங்கள்.`,
                      taEn: `Idhu engakitta already irukku${policyNumberMasked ? ` (${policyNumberMasked})` : ""}. Adhaye vechukka kaaliya vidunga, illa maathanumna thirumba type pannunga.`,
                    }
                  : {
                      en: "We store this so you have it when you need it, and only ever show you the last few digits.",
                      ta: "தேவைப்படும்போது உங்களுக்குக் கிடைக்க இதைச் சேமிக்கிறோம்; கடைசி சில இலக்கங்களை மட்டுமே காண்பிப்போம்.",
                      taEn: "Thevaipadumbodhu ungalukku kidaikka idha save panrom; kadaisi konjam digits mattum thaan kaatuvom.",
                    }
              }
              required={!isEdit}
              locale={locale}
              value={draft.policyNumber}
              onChange={set("policyNumber")}
              error={errors.policyNumber}
            />
          </>
        )}

        {step.id === "type" && (
          <ChoiceField<PolicyType>
            name="policyType"
            legend={{ en: "What kind of cover do you have?", ta: "உங்களிடம் எந்த வகை பாதுகாப்பு உள்ளது?", taEn: "Ungakitta enna vagai cover irukku?" }}
            options={POLICY_TYPE_CHOICES}
            locale={locale}
            value={draft.policyType}
            onChange={(value) => set("policyType")(value)}
            error={errors.policyType}
          />
        )}

        {step.id === "dates" && (
          <>
            <DateField
              name="expiryDate"
              label={{ en: "Expiry date", ta: "காலாவதி தேதி", taEn: "Expiry date" }}
              hint={{
                en: "The date your cover runs out. It is printed on your certificate.",
                ta: "உங்கள் பாதுகாப்பு முடியும் தேதி. இது உங்கள் சான்றிதழில் அச்சிடப்பட்டிருக்கும்.",
                taEn: "Ungal cover mudiyura date. Idhu certificate-la print aagi irukkum.",
              }}
              required
              locale={locale}
              value={draft.expiryDate}
              onChange={set("expiryDate")}
              error={errors.expiryDate}
            />
            <DateField
              name="startDate"
              label={{ en: "Start date", ta: "தொடக்க தேதி", taEn: "Start date" }}
              locale={locale}
              value={draft.startDate}
              onChange={set("startDate")}
              error={errors.startDate}
            />
          </>
        )}

        {step.id === "extras" && (
          <>
            <TextField
              name="idv"
              label={{ en: "Vehicle value (IDV)", ta: "வாகன மதிப்பு (IDV)", taEn: "Vandi value (IDV)" }}
              hint={{
                en: "The amount your vehicle is insured for. Leave it blank if you cannot find it.",
                ta: "உங்கள் வாகனம் எவ்வளவு தொகைக்கு காப்பீடு செய்யப்பட்டுள்ளது. கண்டுபிடிக்க முடியவில்லை என்றால் காலியாக விடுங்கள்.",
                taEn: "Ungal vandi evvalavu amount-ku insure aagi irukku. Kandupidikka mudiyalana kaaliya vidunga.",
              }}
              inputMode="numeric"
              locale={locale}
              value={draft.idv}
              onChange={set("idv")}
              error={errors.idv}
            />
            <TextField
              name="ncbPercent"
              label={{ en: "No-claim bonus (%)", ta: "நோ-கிளைம் போனஸ் (%)", taEn: "No-claim bonus (%)" }}
              hint={{
                en: "The discount you have earned for not claiming. Often 20, 25 or 50.",
                ta: "கிளைம் செய்யாததற்காக நீங்கள் பெற்ற தள்ளுபடி. பொதுவாக 20, 25 அல்லது 50.",
                taEn: "Claim pannaadhadhukku kidacha discount. Usually 20, 25 illa 50.",
              }}
              inputMode="numeric"
              locale={locale}
              value={draft.ncbPercent}
              onChange={set("ncbPercent")}
              error={errors.ncbPercent}
            />
          </>
        )}

        {isReview && (
          <ReviewList draft={draft} locale={locale} mode={mode} onEdit={setStepIndex} />
        )}
      </div>

      {submitError && (
        <p
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {submitError}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={submitting}
          className="inline-flex min-h-[52px] items-center gap-2 rounded-2xl border border-line bg-surface-raised px-5 text-sm font-bold text-content transition-colors hover:bg-surface-sunken disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {stepIndex === 0 ? "Cancel" : "Back"}
        </button>

        <button
          type="button"
          onClick={isReview ? submit : goNext}
          disabled={submitting}
          data-testid={isReview ? "wizard-submit" : "wizard-next"}
          className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-brand px-5 text-sm font-bold text-white transition-colors hover:bg-brand-strong disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isReview
            ? submitting
              ? "Saving…"
              : isEdit
                ? "Save these changes"
                : "Save my policy"
            : step.optional
              ? "Skip or continue"
              : "Continue"}
          {!isReview && !submitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const step = current + 1;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold uppercase tracking-widest text-content-subtle">
        Step {step} of {total}
      </p>
      <div
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label="How far through the form you are"
        className="flex gap-1.5"
      >
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              index <= current ? "bg-brand" : "bg-surface-sunken"
            )}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * The review screen.
 *
 * Every row is editable in place — pressing one goes back to the step it came
 * from. A review that can only be accepted or abandoned is not a review.
 */
function ReviewList({
  draft,
  locale,
  mode,
  onEdit,
}: {
  draft: PolicyDraft;
  locale: DocumentLocale;
  mode: FormMode;
  onEdit: (stepIndex: number) => void;
}) {
  const typeChoice = policyTypeChoice((draft.policyType || null) as PolicyType | null);

  const rows: { label: string; value: string; step: number }[] = [
    { label: "Vehicle number", value: draft.registrationNumber, step: 0 },
    { label: "Insurer", value: draft.insurer, step: 1 },
    {
      label: "Policy number",
      // A blank box on a correction means "keep it", so the review has to say
      // that rather than showing a dash, which reads as "we lost it".
      value: mode === "edit" && !draft.policyNumber ? "Kept as it is" : draft.policyNumber,
      step: 1,
    },
    {
      label: "Cover type",
      value: typeChoice ? localise(typeChoice.label, locale) : "",
      step: 2,
    },
    { label: "Runs out on", value: draft.expiryDate, step: 3 },
  ];

  if (draft.startDate) rows.push({ label: "Started on", value: draft.startDate, step: 3 });
  if (draft.idv) rows.push({ label: "Vehicle value", value: `₹${draft.idv}`, step: 4 });
  if (draft.ncbPercent) rows.push({ label: "No-claim bonus", value: `${draft.ncbPercent}%`, step: 4 });

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.label}>
          <button
            type="button"
            onClick={() => onEdit(row.step)}
            className="flex min-h-[56px] w-full items-center justify-between gap-4 rounded-2xl border border-line bg-surface-raised px-4 py-3 text-left transition-colors hover:border-brand/40"
          >
            <span className="min-w-0">
              <span className="block text-xs font-bold uppercase tracking-wide text-content-subtle">
                {row.label}
              </span>
              <span className="mt-0.5 block break-words text-sm font-semibold text-content">
                {row.value || "—"}
              </span>
            </span>
            <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-brand">
              Change
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
