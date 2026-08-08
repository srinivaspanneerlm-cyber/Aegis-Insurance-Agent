"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { usePurchase, CustomerDetails } from "@/context/PurchaseContext";
import {
  User, Calendar, Briefcase, IndianRupee, Heart, Phone, Mail,
  CreditCard, MapPin, Upload, ArrowRight, AlertCircle, ChevronDown,
} from "lucide-react";

type FieldDef = {
  key: keyof CustomerDetails;
  label: string;
  placeholder: string;
  type?: string;
  icon: React.ComponentType<{ className?: string }>;
  required?: boolean;
  options?: string[];
  pattern?: string;
  maxLength?: number;
};

const FIELDS: FieldDef[][] = [
  // Row: Personal
  [
    { key: "firstName",  label: "First Name",       placeholder: "Ravi",           icon: User,         required: true },
    { key: "lastName",   label: "Last Name",         placeholder: "Shankar",        icon: User,         required: true },
  ],
  [
    { key: "dob",        label: "Date of Birth",     placeholder: "",               icon: Calendar,     required: true, type: "date" },
    { key: "gender",     label: "Gender",            placeholder: "Select",         icon: User,         required: true,
      options: ["Male", "Female", "Other", "Prefer not to say"] },
  ],
  [
    { key: "occupation", label: "Occupation",        placeholder: "Software Engineer", icon: Briefcase,  required: true },
    { key: "annualIncome", label: "Annual Income (₹)", placeholder: "800000",        icon: IndianRupee,  required: true, type: "number" },
  ],
  [
    { key: "maritalStatus", label: "Marital Status", placeholder: "Select",         icon: Heart,        required: true,
      options: ["Single", "Married", "Divorced", "Widowed"] },
    { key: "mobile",     label: "Mobile Number",     placeholder: "9876543210",     icon: Phone,        required: true,
      pattern: "^[6-9]\\d{9}$", maxLength: 10 },
  ],
  [
    { key: "email",      label: "Email Address",     placeholder: "ravi@email.com", icon: Mail,         required: true, type: "email" },
    { key: "pan",        label: "PAN Number",        placeholder: "ABCDE1234F",     icon: CreditCard,   required: true,
      pattern: "[A-Z]{5}[0-9]{4}[A-Z]{1}", maxLength: 10 },
  ],
  [
    { key: "aadhaar",    label: "Aadhaar Number",    placeholder: "1234 5678 9012", icon: CreditCard,   required: true,
      maxLength: 12 },
    { key: "nomineeName", label: "Nominee Name",     placeholder: "Priya Shankar",  icon: User,         required: true },
  ],
  [
    { key: "nomineeRelation", label: "Nominee Relationship", placeholder: "Select", icon: Heart,        required: true,
      options: ["Spouse", "Parent", "Child", "Sibling", "Other"] },
    { key: "address",    label: "Address",           placeholder: "123 MG Road",    icon: MapPin,       required: true },
  ],
  [
    { key: "city",       label: "City",              placeholder: "Bengaluru",      icon: MapPin,       required: true },
    { key: "state",      label: "State",             placeholder: "Select",         icon: MapPin,       required: true,
      options: ["Andhra Pradesh","Assam","Bihar","Chhattisgarh","Delhi","Goa","Gujarat",
        "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
        "Maharashtra","Manipur","Meghalaya","Odisha","Punjab","Rajasthan","Tamil Nadu",
        "Telangana","Uttar Pradesh","Uttarakhand","West Bengal"] },
  ],
  [
    { key: "pinCode",    label: "PIN Code",          placeholder: "560001",         icon: MapPin,       required: true,
      maxLength: 6 },
  ],
];

const EMPTY: CustomerDetails = {
  firstName:"", lastName:"", dob:"", gender:"", occupation:"", annualIncome:"",
  maritalStatus:"", mobile:"", email:"", pan:"", aadhaar:"", nomineeName:"",
  nomineeRelation:"", address:"", city:"", state:"", pinCode:"",
};

function Field({ def, value, onChange, error }: {
  def: FieldDef; value: string; onChange: (v: string) => void; error?: string;
}) {
  const Icon = def.icon;
  const base = `w-full bg-white/[0.03] border rounded-xl px-10 py-3 text-white text-sm
    placeholder-white/20 outline-none transition-all duration-200
    focus:bg-white/[0.06] focus:ring-1 focus:ring-cyan-500/50
    ${error ? "border-red-500/50" : "border-white/10 hover:border-white/20 focus:border-cyan-500/40"}`;

  return (
    <div className="relative">
      <label className="text-xs text-white/50 font-medium mb-1.5 block">
        {def.label}{def.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
        {def.options ? (
          <div className="relative">
            <select value={value} onChange={e => onChange(e.target.value)} className={base + " appearance-none pr-8 cursor-pointer"}>
              <option value="" disabled className="bg-[#0b0f19]">Select…</option>
              {def.options.map(o => <option key={o} value={o} className="bg-[#0b0f19]">{o}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
          </div>
        ) : (
          <input
            type={def.type || "text"}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={def.placeholder}
            maxLength={def.maxLength}
            className={base}
          />
        )}
      </div>
      {error && (
        <p className="flex items-center gap-1 text-red-400 text-xs mt-1">
          <AlertCircle className="w-3 h-3" />{error}
        </p>
      )}
    </div>
  );
}

export default function DetailsPage() {
  const router = useRouter();
  const { state, setCustomerDetails } = usePurchase();
  const [form, setForm] = useState<CustomerDetails>(state.customerDetails || EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerDetails, string>>>({});
  const [saving, setSaving] = useState(false);

  const set = (key: keyof CustomerDetails, val: string) => {
    setForm(prev => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (!form.firstName.trim()) errs.firstName = "Required";
    if (!form.lastName.trim()) errs.lastName = "Required";
    if (!form.dob) errs.dob = "Required";
    if (!form.gender) errs.gender = "Required";
    if (!form.occupation.trim()) errs.occupation = "Required";
    if (!form.annualIncome) errs.annualIncome = "Required";
    if (!form.maritalStatus) errs.maritalStatus = "Required";
    if (!/^[6-9]\d{9}$/.test(form.mobile)) errs.mobile = "Enter valid 10-digit mobile";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Enter valid email";
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.pan.toUpperCase())) errs.pan = "PAN format: ABCDE1234F";
    if (!/^\d{12}$/.test(form.aadhaar.replace(/\s/g, ""))) errs.aadhaar = "Enter 12-digit Aadhaar";
    if (!form.nomineeName.trim()) errs.nomineeName = "Required";
    if (!form.nomineeRelation) errs.nomineeRelation = "Required";
    if (!form.address.trim()) errs.address = "Required";
    if (!form.city.trim()) errs.city = "Required";
    if (!form.state) errs.state = "Required";
    if (!/^\d{6}$/.test(form.pinCode)) errs.pinCode = "Enter 6-digit PIN code";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    setCustomerDetails({ ...form, pan: form.pan.toUpperCase() });
    router.push("/purchase/policy");
  };

  const sections = [
    { title: "Personal Details", icon: User, rows: [0, 1, 2, 3] },
    { title: "Contact & Identity", icon: CreditCard, rows: [4, 5] },
    { title: "Nominee Details", icon: Heart, rows: [6] },
    { title: "Address", icon: MapPin, rows: [7, 8] },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Customer Details</h1>
        <p className="text-white/40 text-sm">Complete your application. This is a demonstration — nothing is submitted.</p>
      </div>

      {sections.map((section) => {
        const SIcon = section.icon;
        return (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-4"
          >
            <div className="flex items-center gap-2 pb-2 border-b border-white/5">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <SIcon className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">{section.title}</h3>
            </div>
            {section.rows.map(ri => (
              <div key={ri} className={`grid gap-4 ${FIELDS[ri].length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
                {FIELDS[ri].map(def => (
                  <Field
                    key={def.key}
                    def={def}
                    value={form[def.key]}
                    onChange={v => set(def.key, v)}
                    error={errors[def.key]}
                  />
                ))}
              </div>
            ))}
          </motion.div>
        );
      })}

      {/* Document Upload (UI only) */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-white/5">
          <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Upload className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <h3 className="text-sm font-semibold text-white">Document Upload</h3>
          <span className="text-xs text-white/30 ml-1">(optional — can be uploaded later)</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {["Government Photo ID", "Address Proof", "Photograph"].map(doc => (
            <label key={doc} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-dashed border-white/10 hover:border-cyan-500/30 cursor-pointer transition-colors group">
              <Upload className="w-5 h-5 text-white/20 group-hover:text-cyan-400 transition-colors" />
              <span className="text-xs text-white/30 text-center group-hover:text-white/50 transition-colors">{doc}</span>
              <input type="file" className="hidden" accept="image/*,.pdf" />
            </label>
          ))}
        </div>
      </div>

      <motion.button
        type="submit"
        disabled={saving}
        whileHover={{ scale: saving ? 1 : 1.01 }}
        whileTap={{ scale: saving ? 1 : 0.99 }}
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm
          flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-200
          disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {saving ? (
          <>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
            Saving details…
          </>
        ) : (
          <>Save & Continue <ArrowRight className="w-4 h-4" /></>
        )}
      </motion.button>
    </form>
  );
}
