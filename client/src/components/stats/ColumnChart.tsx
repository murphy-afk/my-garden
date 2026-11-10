/**
 * A column chart for a run of months, built from plain CSS: each column's
 * height is its share of the tallest one. Columns come with their month
 * already labelled, so an empty month can be drawn too.
 */

type ColumnChartProps = {
  columns: { label: string; value: number; /** Full text for a screen reader and a tooltip. */ title?: string }[];
  /** Shown under the chart, such as the unit the values are in. */
  caption?: string;
};

export function ColumnChart({ columns, caption }: ColumnChartProps) {
  let largest = 0;
  for (const column of columns) {
    if (column.value > largest) largest = column.value;
  }

  function heightOf(value: number): string {
    if (value <= 0) return '0';
    const share = largest > 0 ? (value / largest) * 100 : 0;
    return `${Math.max(share, 3)}%`;
  }

  return (
    <div className="columns">
      <ul className="columns__list">
        {columns.map((column) => (
          <li className="columns__item" key={column.label}>
            <span className="columns__track">
              <span className="columns__value">{column.value}</span>
              <span className="columns__bar" style={{ height: heightOf(column.value) }} />
            </span>
            <span className="columns__label" title={column.title ?? column.label}>
              {column.label}
            </span>
          </li>
        ))}
      </ul>
      {caption !== undefined && <p className="columns__caption">{caption}</p>}
    </div>
  );
}
