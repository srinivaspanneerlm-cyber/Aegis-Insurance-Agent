"use client";

import { useEffect, useState } from "react";
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
export default function EmployeesPage() {
  const [data, setData] = useState<{
    employees: EmployeeRow[];
    departments: { department: string; count: number }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    consoleApi
      .employees()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-h1 font-bold tracking-tight text-content">Employee Management</h1>
        <p className="mt-1 text-body-sm text-content-secondary">
          Who is where, and how much they are carrying.
        </p>
      </header>

      {error ? <Empty icon="close">{error}</Empty> : null}

      {data && data.departments.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {data.departments.map((d) => (
            <Badge key={d.department}>
              {d.department} · {d.count}
            </Badge>
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
                      <p className="text-caption text-content-muted">
                        {e.employeeCode} · {e.designation}
                      </p>
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

      <p className="text-pretty text-caption text-content-muted">
        Training status is not shown because the platform does not record it. Capturing it would
        need a training or certification record against each employee.
      </p>
    </div>
  );
}
