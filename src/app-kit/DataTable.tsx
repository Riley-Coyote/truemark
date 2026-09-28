import { useMemo, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Button, EmptyState, Skeleton } from "./components";

/**
 * How a cell behaves when the table stacks into rows below 720px:
 * primary and aside share the first line, secondary takes the second,
 * meta cells run together on the third, hidden cells drop out.
 */
export type MobileRole = "primary" | "aside" | "secondary" | "meta" | "hidden";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  /** Direction of the first click on this column. Dates and money read best newest or largest first. */
  sortFirst?: "asc" | "desc";
  align?: "start" | "end";
  /** Share of the table width, e.g. "14%". */
  width?: string;
  mobile?: MobileRole;
};

export type RowGroup<T> = { key: string; label: ReactNode; match: (row: T) => boolean };

type Sort = { key: string; dir: "asc" | "desc" };

const SKELETON_WIDTHS = ["72%", "54%", "80%", "46%", "64%", "58%", "40%"];

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  loading = false,
  error = null,
  onRetry,
  onRowClick,
  activeKey,
  empty,
  groups,
  defaultSort,
  skeletonRows = 6,
  stickyHeader = true,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  caption: string;
  loading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  activeKey?: string | null;
  empty: { title: string; note?: ReactNode; action?: ReactNode };
  groups?: RowGroup<T>[];
  defaultSort?: Sort;
  skeletonRows?: number;
  stickyHeader?: boolean;
}) {
  const [sort, setSort] = useState<Sort | null>(defaultSort ?? null);

  const sorted = useMemo(() => {
    const list = rows ? [...rows] : [];
    const column = sort && columns.find((c) => c.key === sort.key);
    if (!sort || !column?.sortValue) return list;
    const value = column.sortValue;
    const factor = sort.dir === "asc" ? 1 : -1;
    return list.sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const order = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return order * factor;
    });
  }, [rows, sort, columns]);

  function toggle(column: Column<T>) {
    setSort((current) =>
      current?.key === column.key
        ? { key: column.key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key: column.key, dir: column.sortFirst ?? "asc" },
    );
  }

  function rowProps(row: T) {
    if (!onRowClick) return {};
    return {
      className: "kit-row",
      tabIndex: 0,
      "data-active": activeKey === rowKey(row) ? "true" : undefined,
      onClick: () => onRowClick(row),
      onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onRowClick(row);
        }
      },
    };
  }

  const renderRow = (row: T) => (
    <tr key={rowKey(row)} {...rowProps(row)}>
      {columns.map((column) => {
        const content = column.cell(row);
        return (
          <td
            key={column.key}
            className={column.align === "end" ? "is-end" : undefined}
            data-mobile={column.mobile ?? "meta"}
            title={typeof content === "string" ? content : undefined}
          >
            {content}
          </td>
        );
      })}
    </tr>
  );

  const span = columns.length;
  let body: ReactNode;
  if (loading && !rows) {
    body = (
      <tbody aria-hidden="true">
        {Array.from({ length: skeletonRows }, (_, r) => (
          <tr key={r} className="kit-skeleton-row">
            {columns.map((column, c) => (
              <td key={column.key} className={column.align === "end" ? "is-end" : undefined} data-mobile={column.mobile ?? "meta"}>
                <Skeleton width={SKELETON_WIDTHS[(r + c) % SKELETON_WIDTHS.length]} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    );
  } else if (error) {
    body = (
      <tbody>
        <tr>
          <td className="kit-empty-cell" colSpan={span} data-mobile="secondary">
            <EmptyState
              compact
              title={`${caption} could not be loaded.`}
              note={error.message}
              action={onRetry && <Button onClick={onRetry}>Try again</Button>}
            />
          </td>
        </tr>
      </tbody>
    );
  } else if (!sorted.length) {
    body = (
      <tbody>
        <tr>
          <td className="kit-empty-cell" colSpan={span} data-mobile="secondary">
            <EmptyState compact title={empty.title} note={empty.note} action={empty.action} />
          </td>
        </tr>
      </tbody>
    );
  } else if (groups) {
    body = groups.map((group) => {
      const members = sorted.filter(group.match);
      if (!members.length) return null;
      return (
        <tbody key={group.key}>
          <tr className="kit-group-row">
            <th scope="rowgroup" colSpan={span} className="kit-group-cell">
              <span className="kit-group-label">
                {group.label}
                <span className="kit-group-count">{members.length}</span>
              </span>
            </th>
          </tr>
          {members.map(renderRow)}
        </tbody>
      );
    });
  } else {
    body = <tbody>{sorted.map(renderRow)}</tbody>;
  }

  return (
    <div className="kit-table-wrap">
      <table className={`kit-table${stickyHeader ? "" : " is-static"}`} aria-busy={loading || undefined}>
        <caption className="kit-sr">
          {caption}
          {onRowClick ? ". Select a row to open its details." : ""}
        </caption>
        <colgroup>
          {columns.map((column) => (
            <col key={column.key} style={column.width ? { width: column.width } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => {
              const active = sort?.key === column.key ? sort.dir : null;
              return (
                <th
                  key={column.key}
                  scope="col"
                  className={column.align === "end" ? "is-end" : undefined}
                  aria-sort={column.sortValue ? (active === "asc" ? "ascending" : active === "desc" ? "descending" : "none") : undefined}
                >
                  {column.sortValue ? (
                    <button type="button" className="kit-sort" onClick={() => toggle(column)}>
                      {column.header}
                      {active === "asc" ? (
                        <ArrowUp aria-hidden="true" strokeWidth={1.8} />
                      ) : active === "desc" ? (
                        <ArrowDown aria-hidden="true" strokeWidth={1.8} />
                      ) : (
                        <ChevronsUpDown aria-hidden="true" strokeWidth={1.8} />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        {body}
      </table>
    </div>
  );
}
