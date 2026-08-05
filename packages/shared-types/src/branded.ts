/**
 * Identifiers that cannot be confused with each other.
 *
 * Every id in this platform is a string, which means the compiler is perfectly
 * happy to let a `policyId` be passed where a `customerId` belongs. In an
 * insurance system that mistake reads another person's record — the exact
 * cross-tenant leak the charter calls a critical defect — and no test will
 * catch it because both values are valid strings.
 *
 * A brand costs nothing at runtime (it erases entirely) and makes that swap a
 * compile error.
 */

declare const brand: unique symbol;

export type Brand<T, TBrand extends string> = T & { readonly [brand]: TBrand };

export type CustomerId = Brand<string, "CustomerId">;
export type StaffId = Brand<string, "StaffId">;
export type OrganizationId = Brand<string, "OrganizationId">;
export type SessionId = Brand<string, "SessionId">;
export type RequestId = Brand<string, "RequestId">;

/**
 * Enter the branded world.
 *
 * Deliberately explicit: every call is a place where an unchecked string is
 * being asserted to be a particular kind of id, and that is worth being able to
 * grep for.
 */
export const asCustomerId = (value: string): CustomerId => value as CustomerId;
export const asStaffId = (value: string): StaffId => value as StaffId;
export const asOrganizationId = (value: string): OrganizationId => value as OrganizationId;
export const asSessionId = (value: string): SessionId => value as SessionId;
export const asRequestId = (value: string): RequestId => value as RequestId;
