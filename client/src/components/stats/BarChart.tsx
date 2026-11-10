/**
 * A horizontal bar chart built from plain CSS: one track per bar, its width
 * set as a share of the largest value. Rows can hold more than one bar, which
 * is how two series (such as watered and pruned) sit side by side.
 */

/** Which design token paints a bar, so several series stay tellable apart. */
export type ChartTone = 'accent' | 'muted' | 'danger' | 'warning';

export type ChartBar = {
  label: string;
  value: number;
  tone?: ChartTone;
};

export type ChartRow = {
  label: string;
  bars: ChartBar[];
  /** Small print beside the label, such as how many harvests it came from. */
  meta?: string;
};

type BarChartProps = {
  rows: ChartRow[];
  /** Shown after every value, such as a unit. */
  suffix?: string;
  /** Below this a real value still shows as a sliver rather than nothing. */
  minBarPercent?: number;
};

export function BarChart({ rows, suffix = '', minBarPercent = 4 }: BarChartProps) {
  let largest = 0;
  for (const row of rows) {
    for (const bar of row.bars) {
      if (bar.value > largest) largest = bar.value;
    }
  }

  function widthOf(value: number): string {
    if (value <= 0) return '0';
    const share = largest > 0 ? (value / largest) * 100 : 0;
    return `${Math.max(share, minBarPercent)}%`;
  }

  // The series legend comes from the first row that has more than one bar,
  // because every row in a multi-series chart shares the same series.
  const series = rows.find((row) => row.bars.length > 1)?.bars ?? [];

  return (
    <div className="chart">
      {series.length > 0 && (
        <ul className="chart__legend">
          {series.map((bar) => (
            <li className="chart__legend-item" key={bar.label}>
              <span className={`chart__swatch chart__swatch--${bar.tone ?? 'accent'}`} aria-hidden="true" />
              {bar.label}
            </li>
          ))}
        </ul>
      )}

      <ul className="chart__rows">
        {rows.map((row) => (
          <li className="chart__row" key={row.label}>
            <span className="chart__row-label">
              {row.label}
              {row.meta !== undefined && <span className="chart__row-meta">{row.meta}</span>}
            </span>
            <span className="chart__row-bars">
              {row.bars.map((bar) => (
                <span className="chart__bar-line" key={bar.label}>
                  <span className="chart__track">
                    <span
                      className={`chart__bar chart__bar--${bar.tone ?? 'accent'}`}
                      style={{ width: widthOf(bar.value) }} />
                  </span>
                  <span className="chart__value">
                    {bar.value}
                    {suffix}
                  </span>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
