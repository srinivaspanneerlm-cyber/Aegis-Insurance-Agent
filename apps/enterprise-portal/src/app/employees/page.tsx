"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Empty, Panel, Skeleton } from "@/components/Cards";
import { consoleApi, type EmployeeRow } from "@/lib/api";

/**
 * Employee management.
 *
 * Shows load and lateness rather than a productivity score. A score would need
 * a quality signal the platform does not capture, and ranking people on volume
 * alone teaches an operation to close cases badly — which is the opposite of
 * what this console is for.
 */
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  ON_LEAVE: "On leave",
  SUSPENDED: "Suspended",
  EXITED: "Left",
};

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  ACTIVE: "success",
  ON_LEAVE: "warning",
  SUSPENDED: "danger",
  EXITED: "neutral",
};

export default function EmployeesPage() {
  const [data, setData] = useState<{
    employees: EmployeeRow[];
    departments: { department: string; count: number }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [department, setDepartment] = useState<string | null>(null);

  // A slower earlier request must not overwrite a later one, or the table ends
  // up disagreeing with the selected department.
  const ticket = useRef(0);

  const load = useCallback(async (dept: string | null) => {
    const mine = ++ticket.current;
    setError(null);
    try {
      const d = await consoleApi.employees(dept ?? undefined);
      if (mine === ticket.current) setData(d);
    } catch (e) {
      if (mine === ticket.current) setError(e instanceof Error ? e.message : "Failed.");
    }
  }, []);

  useEffect(() => {
    void load(department);
  }, [load, department]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Employee Management</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          Who is where, and how much they are carrying.
        </p>
      </header>

      {error ? <Empty icon="close">{error}</Empty> : null}

      {/* The endpoint has always taken ?department= and nothing sent it, so
          these counts were decoration. Filtering happens on the server, which
          is what keeps the 50-row cap meaningful. */}
      {data && data.departments.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDepartment(null)}
            aria-pressed={department === null}
            className={
              department === null
                ? "focus-ring rounded-control border border-brand/40 bg-brand/10 px-3 py-1 text-caption font-medium text-content"
                : "focus-ring rounded-control border border-line/50 px-3 py-1 text-caption text-content-secondary"
            }
          >
            Everyone
          </button>
          {data.departments.map((d) => (
            <button
              key={d.department}
              type="button"
              onClick={() => setDepartment(d.department)}
              aria-pressed={department === d.department}
              className={
                department === d.department
                  ? "focus-ring rounded-control border border-brand/40 bg-brand/10 px-3 py-1 text-caption font-medium text-content"
                  : "focus-ring rounded-control border border-line/50 px-3 py-1 text-caption text-content-secondary"
              }
            >
              {d.department} · {d.count}
            </button>
          ))}
        </div>
      ) : null}

      <Panel title={data ? `${data.employees.length} employee(s)` : "Loading"}>
        {data === null ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : data.employees.length === 0 ? (
          <Empty icon="briefcase">No employee profiles have been created yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line/50 text-caption uppercase tracking-wide text-content-muted">
                  <th scope="col" className="pb-2 pr-4 font-medium">
                    Employee
                  </th>
                  <th scope="col" className="pb-2 pr-4 font-medium">
                    Status
                  </th>
                  <th scope="col" className="pb-2 pr-4 font-medium">
                    Department
                  </th>
                  <th scope="col" className="pb-2 pr-4 font-medium">
                    Branch
                  </th>
                  <th scope="col" className="pb-2 pr-4 font-medium">
                    Load
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Overdue
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.employees.map((e) => (
                  <tr key={e.id} className="border-b border-line/30 last:border-0">
                    <td className="py-3 pr-4">
                      <p className="text-body-sm text-content">{e.user.name}</p>
                      <p className="break-words text-caption text-content-muted">
                        {e.employeeCode} · {e.designation} · {e.user.email}
                      </p>
                      {/* Somebody who has never signed in is a seat consumed
                          and a person who cannot be routed work. */}
                      <p className="text-caption text-content-muted">
                        {e.user.lastLoginAt
                          ? `Last signed in ${new Date(e.user.lastLoginAt).toLocaleDateString()}`
                          : "Has never signed in"}
                      </p>
                    </td>
                    <td className="py-3 pr-4">
                      {/* Status was in the payload and unrendered, so somebody
                          who has left the company sat in this table looking
                          like staff, with a workload beside their name. */}
                      <Badge tone={STATUS_TONE[e.status] ?? "neutral"}>
                        {STATUS_LABELS[e.status] ?? e.status}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-body-sm text-content-secondary">
                      {e.department}
                    </td>
                    <td className="py-3 pr-4 text-body-sm text-content-secondary">{e.branch}</td>
                    <td className="py-3 pr-4 text-body-sm tabular-nums text-content-secondary">
                      {e.openWork} / {e.workloadLimit}
                    </td>
                    <td className="py-3 text-body-sm tabular-nums">
                      <span
                        className={
                          e.overdue > 0 ? "font-semibold text-danger" : "text-content-secondary"
                        }
                      >
                        {e.overdue}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* The endpoint caps at 50. Above that the list is short and says so
          rather than reading as the whole workforce. */}
      {data && data.employees.length >= 50 ? (
        <p role="status" className="text-pretty text-caption text-content-muted">
          Showing the 50 most recently joined. Filter by department to see the rest.
        </p>
      ) : null}

      <p className="text-pretty text-caption text-content-muted">
        Training status is not shown because the platform does not record it. Capturing it would
        need a training or certification record against each employee.
      </p>
    </div>
  );
}
