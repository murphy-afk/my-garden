import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { areaKeys, listAreas } from '../api/areas';
import { messageFor } from '../api/client';
import { unitLabel } from '../api/harvests';
import { issueLabel, issueSeverities, severityLabel, type IssueSeverity } from '../api/issues';
import { speciesKeys, listSpecies } from '../api/species';
import {
  careFrequency,
  harvestsOverTime,
  issueStats,
  monthRange,
  periodLabel,
  statsKeys,
  survival,
  timing,
  yieldByArea,
  yieldBySpecies,
  type PeriodYield,
  type StatsFilters,
} from '../api/stats';
import { BarChart, type ChartRow, type ChartTone } from '../components/stats/BarChart';
import { ColumnChart } from '../components/stats/ColumnChart';
import { StatPanel } from '../components/stats/StatPanel';
import '../styles/stats.css';

/** The name shown for a species, with the variety when it has one. */
function speciesLine(species: { name: string; variety: string | null }): string {
  return species.variety === null ? species.name : `${species.name} ${species.variety}`;
}

/** One chart row from a yield figure, labelled by whatever produced it. */
function yieldRow(label: string, row: { unit: string; total: number; harvestCount: number }): ChartRow {
  return {
    label,
    bars: [{ label: unitLabel(row.unit), value: row.total, tone: 'accent' }],
    meta: `${row.harvestCount} ${row.harvestCount === 1 ? 'harvest' : 'harvests'}`,
  };
}

/** Yield arrives in every unit at once, and kilograms and pieces do not add up. */
function groupByUnit<T extends { unit: string }>(rows: T[]): { unit: string; rows: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const existing = groups.get(row.unit);
    if (existing === undefined) groups.set(row.unit, [row]);
    else existing.push(row);
  }
  return [...groups.entries()].map(([unit, groupRows]) => ({ unit, rows: groupRows }));
}

/** Columns for one unit, over the months every unit spans, so gaps show too. */
function monthlyColumns(rows: PeriodYield[], months: string[]): { label: string; value: number; title: string }[] {
  const totals = new Map<string, number>(rows.map((row) => [row.period, row.total]));

  return months.map((period) => ({
    label: periodLabel(period),
    value: totals.get(period) ?? 0,
    title: periodLabel(period),
  }));
}

/** Every month from the first harvest to the last, whichever unit it was in. */
function monthSpan(rows: PeriodYield[]): string[] {
  if (rows.length === 0) return [];
  const periods = rows.map((row) => row.period).sort();
  return monthRange(periods[0] ?? '', periods[periods.length - 1] ?? '');
}

/** Severity reads as a scale, so the three always appear in the same order. */
const severityTones: Record<IssueSeverity, ChartTone> = {
  low: 'muted',
  medium: 'warning',
  high: 'danger',
};

/** The sample behind an average, written so one sample never reads as a trend. */
function sampleLine(count: number, subject: string): string {
  return `average of ${count} ${count === 1 ? subject : `${subject}s`}`;
}

export function StatsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [speciesId, setSpeciesId] = useState<number | ''>('');
  const [areaId, setAreaId] = useState<number | ''>('');

  const filters: StatsFilters = {
    from: from === '' ? undefined : from,
    to: to === '' ? undefined : to,
    speciesId: speciesId === '' ? undefined : speciesId,
    areaId: areaId === '' ? undefined : areaId,
  };
  const hasFilters = from !== '' || to !== '' || speciesId !== '' || areaId !== '';
  const rangeInverted = from !== '' && to !== '' && from > to;

  // The two filter menus offer more than the dashboard shows: an archived
  // species or bed still has statistics worth reading.
  const speciesQuery = useQuery({ queryKey: speciesKeys.all, queryFn: () => listSpecies(true) });
  const areasQuery = useQuery({ queryKey: areaKeys.all, queryFn: () => listAreas(true) });

  const yieldSpeciesQuery = useQuery({
    queryKey: [...statsKeys.all, 'yield-by-species', filters],
    queryFn: () => yieldBySpecies(filters),
  });
  const yieldAreaQuery = useQuery({
    queryKey: [...statsKeys.all, 'yield-by-area', filters],
    queryFn: () => yieldByArea(filters),
  });
  const overTimeQuery = useQuery({
    queryKey: [...statsKeys.all, 'harvests-over-time', filters],
    queryFn: () => harvestsOverTime(filters),
  });
  const timingQuery = useQuery({
    queryKey: [...statsKeys.all, 'timing', filters],
    queryFn: () => timing(filters),
  });
  const careQuery = useQuery({
    queryKey: [...statsKeys.all, 'care-frequency', filters],
    queryFn: () => careFrequency(filters),
  });
  const survivalQuery = useQuery({
    queryKey: [...statsKeys.all, 'survival', filters],
    queryFn: () => survival(filters),
  });
  const issuesQuery = useQuery({
    queryKey: [...statsKeys.all, 'issues', filters],
    queryFn: () => issueStats(filters),
  });

  function clearFilters(): void {
    setFrom('');
    setTo('');
    setSpeciesId('');
    setAreaId('');
  }

  const speciesRows = yieldSpeciesQuery.data ?? [];
  const areaRows = yieldAreaQuery.data ?? [];
  const periodRows = overTimeQuery.data ?? [];
  const careRows = careQuery.data ?? [];
  const issueRows = issuesQuery.data ?? [];
  const timingData = timingQuery.data;
  const survivalData = survivalQuery.data;
  const spanOfPeriods = monthSpan(periodRows);

  const flower = timingData?.firstFlower ?? { averageDays: null, count: 0 };
  const fruit = timingData?.firstFruit ?? { averageDays: null, count: 0 };
  const timingIsEmpty = flower.count === 0 && fruit.count === 0;

  const careChart: ChartRow[] = careRows.map((row) => ({
    label: speciesLine(row.species),
    bars: [
      { label: 'Watered', value: row.watered, tone: 'accent' },
      { label: 'Pruned', value: row.pruned, tone: 'muted' },
    ],
    meta: `${row.watered + row.pruned} visits`,
  }));

  const issuesTotal = issueRows.reduce((sum, row) => sum + row.count, 0);
  const issueKindChart: ChartRow[] = issueRows.map((row) => ({
    label: issueLabel(row.kind),
    bars: [{ label: issueLabel(row.kind), value: row.count, tone: 'danger' }],
  }));
  const countsBySeverity = new Map<IssueSeverity, number>(
    issueRows.map((row) => [row.severity, row.count] as const),
  );
  const issueSeverityChart: ChartRow[] = issueSeverities.map((severity) => ({
    label: severityLabel(severity),
    bars: [{ label: severityLabel(severity), value: countsBySeverity.get(severity) ?? 0, tone: severityTones[severity] }],
  }));

  const diedShare =
    survivalData !== undefined && survivalData.total > 0
      ? `${survivalData.died} of ${survivalData.total} plantings died`
      : null;

  let panels: ReactNode = null;
  if (!rangeInverted) {
    panels = (
      <div className="stats__grid">
        <StatPanel
          title="Yield by species"
          note="Totals are kept per unit, so a kilogram is never added to a piece."
          query={yieldSpeciesQuery}
          isEmpty={speciesRows.length === 0}
          emptyText="No harvests match these filters yet.">
          {groupByUnit(speciesRows).map((group) => (
            <div className="stats__group" key={group.unit}>
              <h3 className="stats__group-title">{unitLabel(group.unit)}</h3>
              <BarChart rows={group.rows.map((row) => yieldRow(speciesLine(row.species), row))} />
            </div>
          ))}
        </StatPanel>

        <StatPanel
          title="Yield by area"
          note="What each bed, pot or border produced."
          query={yieldAreaQuery}
          isEmpty={areaRows.length === 0}
          emptyText="No harvests match these filters yet.">
          {groupByUnit(areaRows).map((group) => (
            <div className="stats__group" key={group.unit}>
              <h3 className="stats__group-title">{unitLabel(group.unit)}</h3>
              <BarChart rows={group.rows.map((row) => yieldRow(row.area.name, row))} />
            </div>
          ))}
        </StatPanel>

        <StatPanel
          title="Harvests over time"
          note="What came out, month by month, with the empty months shown too."
          query={overTimeQuery}
          isEmpty={periodRows.length === 0}
          emptyText="No harvests match these filters yet."
          wide>
          {groupByUnit(periodRows).map((group) => (
            <div className="stats__group" key={group.unit}>
              <h3 className="stats__group-title">{unitLabel(group.unit)}</h3>
              <ColumnChart columns={monthlyColumns(group.rows, spanOfPeriods)} caption={unitLabel(group.unit)} />
            </div>
          ))}
        </StatPanel>

        <StatPanel
          title="Days to flower and fruit"
          note="Counted from the sowing date when one was recorded, otherwise from the planting date."
          query={timingQuery}
          isEmpty={timingIsEmpty}
          emptyText="No flowering or fruiting has been recorded against these plantings yet.">
          <div className="timing">
            <div className="timing__stat">
              <p className="timing__value">{flower.averageDays === null ? 0 : Math.round(flower.averageDays)}</p>
              <p className="timing__label">days to first flower</p>
              <p className="timing__sample">{sampleLine(flower.count, 'planting')}</p>
            </div>
            <div className="timing__stat">
              <p className="timing__value">{fruit.averageDays === null ? 0 : Math.round(fruit.averageDays)}</p>
              <p className="timing__label">days to first fruit</p>
              <p className="timing__sample">{sampleLine(fruit.count, 'planting')}</p>
            </div>
          </div>
        </StatPanel>

        <StatPanel
          title="Watering and pruning"
          note="Care visits recorded per species inside the chosen dates."
          query={careQuery}
          isEmpty={careRows.length === 0}
          emptyText="No care was recorded in this range.">
          <BarChart rows={careChart} />
        </StatPanel>

        <StatPanel
          title="Plantings and survival"
          note="A planting counts as died only when the died milestone was recorded, not simply because it ended."
          query={survivalQuery}
          isEmpty={survivalData !== undefined && survivalData.total === 0}
          emptyText="No plantings match these filters yet.">
          <BarChart
            rows={[
              { label: 'Still growing', bars: [{ label: 'Active', value: survivalData?.active ?? 0, tone: 'accent' }] },
              { label: 'Ended', bars: [{ label: 'Ended', value: survivalData?.ended ?? 0, tone: 'muted' }] },
              { label: 'Died', bars: [{ label: 'Died', value: survivalData?.died ?? 0, tone: 'danger' }] },
            ]} />
          {diedShare !== null && <p className="stats__footnote">{diedShare}</p>}
        </StatPanel>

        <StatPanel
          title="Issues by type"
          note="Every issue opened inside the chosen dates."
          query={issuesQuery}
          isEmpty={issuesTotal === 0}
          emptyText="No issues were opened in this range.">
          <BarChart rows={issueKindChart} />
        </StatPanel>

        <StatPanel
          title="Issues by severity"
          query={issuesQuery}
          isEmpty={issuesTotal === 0}
          emptyText="No issues were opened in this range.">
          <BarChart rows={issueSeverityChart} />
        </StatPanel>
      </div>
    );
  }

  return (
    <section className="stats" aria-labelledby="stats-heading">
      <header className="stats__header">
        <div>
          <h1 id="stats-heading">Statistics</h1>
          <p className="stats__intro">
            How the plants are performing: yield, timing, care, survival and problems.
          </p>
        </div>
      </header>

      {(speciesQuery.isError || areasQuery.isError) && (
        <p className="alert" role="alert">
          The filter menus could not be loaded: {messageFor(speciesQuery.error ?? areasQuery.error)}
        </p>
      )}

      <div className="stats__filters">
        <div className="field stats__filter">
          <label className="field__label" htmlFor="stats-from">From</label>
          <input
            id="stats-from"
            className="input"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)} />
        </div>

        <div className="field stats__filter">
          <label className="field__label" htmlFor="stats-to">To</label>
          <input
            id="stats-to"
            className="input"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)} />
        </div>

        <div className="field stats__filter">
          <label className="field__label" htmlFor="stats-species">Species</label>
          <select
            id="stats-species"
            className="select"
            value={speciesId === '' ? '' : String(speciesId)}
            onChange={(event) => setSpeciesId(event.target.value === '' ? '' : Number(event.target.value))}>
            <option value="">All species</option>
            {(speciesQuery.data ?? []).map((species) => (
              <option key={species.id} value={species.id}>{speciesLine(species)}</option>
            ))}
          </select>
        </div>

        <div className="field stats__filter">
          <label className="field__label" htmlFor="stats-area">Area</label>
          <select
            id="stats-area"
            className="select"
            value={areaId === '' ? '' : String(areaId)}
            onChange={(event) => setAreaId(event.target.value === '' ? '' : Number(event.target.value))}>
            <option value="">All areas</option>
            {(areasQuery.data ?? []).map((area) => (
              <option key={area.id} value={area.id}>{area.name}</option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <button type="button" className="button button--secondary stats__clear" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {rangeInverted ? (
        <div className="state">
          <h2 className="state__title">The start date is after the end date</h2>
          <p className="state__text">Nothing can fall inside that range, so change one of the two dates.</p>
          <button type="button" className="button button--secondary" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      ) : (
        panels
      )}
    </section>
  );
}
