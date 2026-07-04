import { type ReactElement } from 'react'
import { type LensResult } from '@/api/lens'
import {
  CautionScoreWidget,
  TotalEquityWidget,
  SharpeWidget,
  CompositionWidget,
  PositionsWidget,
  PortfolioVectorWidget,
  BetaWidget,
  DividendCalendarWidget,
} from '@/components/widgets/DashboardWidgets'

/*
  Widget registry - the single source of truth every grid phase reads from.

  Each entry pairs a stable id with a render function and its grid metadata. The
  render map keeps the widget components untouched: the grid only ever wraps
  render(result); it never reaches into a widget's internals.

  Fields that this (static-placement) phase does not use yet - title, minSpan,
  maxSpan, defaultVisible - are declared now so the later add-menu and resize
  phases are data-ready without another migration.

  defaultSpan is in grid-cell units { w (columns), h (rows) }. w is the
  authoritative width intent. h is a MINIMUM FLOOR only: the widget never renders
  shorter than this (so intentional shapes like the caution-score square stay
  prominent even when their content is small), but WidgetGrid measures each
  widget's real rendered height at runtime and raises h via fitSpan() whenever
  content needs more rows. Floors are set low on purpose; measurement does the
  clip-avoidance work, so spans never need manual tuning again. See CLAUDE.md §5.

  Note (oxlint react/only-export-components): this file intentionally exports
  data + a render map, never a React component, so fast refresh is unaffected.
*/

export interface WidgetSpan {
  w: number
  h: number
}

export interface WidgetRegistryEntry {
  id: string
  title: string
  render: (result: LensResult) => ReactElement
  defaultSpan: WidgetSpan
  minSpan?: WidgetSpan
  maxSpan?: WidgetSpan
  defaultVisible: boolean
}

// Registry order == default dashboard order (fed to the first-fit packer). The
// widths below tile 12 columns into three full-width bands (each band's row
// height is set by measurement, not the floors here):
//   caution (3) | total-equity (6) | sharpe (3)
//   composition (4) | positions (5) | portfolio-momentum (3)
//   beta (3) | dividend-calendar (4)
export const WIDGET_REGISTRY: WidgetRegistryEntry[] = [
  {
    id: 'caution-score',
    title: 'Caution Score',
    render: (r) => <CautionScoreWidget result={r} />,
    defaultSpan: { w: 3, h: 3 },
    minSpan: { w: 3, h: 3 },
    maxSpan: { w: 6, h: 6 },
    defaultVisible: true,
  },
  {
    id: 'total-equity',
    title: 'Total Equity',
    render: (r) => <TotalEquityWidget result={r} />,
    defaultSpan: { w: 6, h: 2 },
    minSpan: { w: 4, h: 3 },
    maxSpan: { w: 12, h: 5 },
    defaultVisible: true,
  },
  {
    id: 'sharpe',
    title: 'Sharpe Ratio',
    render: (r) => <SharpeWidget result={r} />,
    defaultSpan: { w: 3, h: 2 },
    minSpan: { w: 3, h: 3 },
    maxSpan: { w: 4, h: 4 },
    defaultVisible: true,
  },
  {
    id: 'composition',
    title: 'Composition',
    render: (r) => <CompositionWidget result={r} />,
    defaultSpan: { w: 4, h: 3 },
    minSpan: { w: 4, h: 4 },
    maxSpan: { w: 6, h: 6 },
    defaultVisible: true,
  },
  {
    id: 'positions',
    title: 'Positions',
    render: (r) => <PositionsWidget result={r} />,
    defaultSpan: { w: 5, h: 3 },
    minSpan: { w: 4, h: 4 },
    maxSpan: { w: 8, h: 6 },
    defaultVisible: true,
  },
  {
    id: 'portfolio-momentum',
    title: 'Portfolio Momentum',
    render: (r) => <PortfolioVectorWidget result={r} />,
    defaultSpan: { w: 3, h: 3 },
    minSpan: { w: 3, h: 4 },
    maxSpan: { w: 4, h: 6 },
    defaultVisible: true,
  },
  {
    id: 'beta',
    title: 'Beta',
    render: (r) => <BetaWidget result={r} />,
    defaultSpan: { w: 3, h: 2 },
    minSpan: { w: 3, h: 3 },
    maxSpan: { w: 4, h: 4 },
    defaultVisible: true,
  },
  {
    id: 'dividend-calendar',
    title: 'Dividend Calendar',
    render: (r) => <DividendCalendarWidget result={r} />,
    defaultSpan: { w: 4, h: 2 },
    minSpan: { w: 4, h: 3 },
    maxSpan: { w: 8, h: 4 },
    defaultVisible: true,
  },
]

export function getWidget(id: string): WidgetRegistryEntry | undefined {
  return WIDGET_REGISTRY.find((w) => w.id === id)
}
