"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { hasAllPermissions, hasAnyPermission, type Permission } from "@/lib/permissions";

interface CanProps {
  /** Render the children only if the session holds this capability. */
  permission?: Permission;
  /** Or several. `mode` decides whether all of them are needed. */
  permissions?: readonly Permission[];
  /** `"all"` (default) requires every listed capability; `"any"` requires one. */
  mode?: "all" | "any";
  /**
   * What to show instead. Defaults to nothing — an absent control asks no
   * questions, whereas "you do not have permission" tells a customer about a
   * part of the product that is not theirs and invites them to wonder why.
   */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Show a control only to someone who can use it.
 *
 * This is a **rendering** decision and nothing more. The API authorises every
 * request independently, so nothing here is what keeps anyone out — it is what
 * keeps a screen honest. Offering a button that answers 403 wastes the time of
 * the person clicking it and, on the accessibility end of our audience, reads
 * as the product being broken rather than as a boundary being enforced.
 *
 *   <Can permission="lead.delete">
 *     <DeleteLeadButton id={lead.id} />
 *   </Can>
 */
export default function Can({
  permission,
  permissions,
  mode = "all",
  fallback = null,
  children,
}: CanProps) {
  const { permissions: granted } = useAuth();

  const required: readonly Permission[] = permissions ?? (permission ? [permission] : []);

  // Asking for nothing grants nothing. An empty `<Can>` is a mistake at the
  // call site, and the safe reading of a mistake is to show less, not more.
  const allowed =
    required.length > 0 &&
    (mode === "any" ? hasAnyPermission(granted, required) : hasAllPermissions(granted, required));

  return <>{allowed ? children : fallback}</>;
}
