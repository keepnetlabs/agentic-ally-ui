/**
 * Report Types — mirrors agent's report-schema.ts
 * Used by FE components to render report JSON.
 */

export interface ReportBranding {
  logoUrl: string
  primaryColor: string
  companyName: string
}

export interface ReportMeta {
  title: string
  subtitle?: string
  author: string
  generatedAt: string
  language: string
  pageTarget: number
  branding?: ReportBranding
}

// Section types
export interface CoverSection {
  type: 'cover'
  id: string
  title: string
  subtitle?: string
  date: string
  weight: number
}

export interface ExecutiveSummarySection {
  type: 'executive_summary'
  id: string
  title: string
  content: string
  keyFindings?: string[]
  weight: number
}

export interface KpiItem {
  label: string
  value: string
  trend: 'up' | 'down' | 'stable' | 'flat' | 'neutral'
  delta?: string
}

export interface KpiDashboardSection {
  type: 'kpi_dashboard'
  id: string
  title: string
  kpis: KpiItem[]
  weight: number
}

export interface ChartDataset {
  label: string
  data: number[]
  backgroundColor?: string | string[]
  borderColor?: string | string[]
  yAxisID?: string
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'polarArea' | 'scatter'
  data: {
    labels: string[]
    datasets: ChartDataset[]
  }
  options?: Record<string, unknown>
}

export interface ChartSection {
  type: 'chart'
  id: string
  title: string
  description?: string
  chartConfig: ChartConfig
  weight: number
}

export interface TableSection {
  type: 'table'
  id: string
  title: string
  columns: string[]
  rows: string[][]
  highlightColumn?: number
  weight: number
}

export interface ContentSection {
  type: 'content'
  id: string
  title: string
  content: string
  weight: number
}

export interface RecommendationItem {
  priority: 'critical' | 'high' | 'medium' | 'low'
  text: string
  detail?: string
}

export interface RecommendationsSection {
  type: 'recommendations'
  id: string
  title: string
  items: RecommendationItem[]
  weight: number
}

export interface TimelineItem {
  date: string
  event: string
  detail?: string
  status?: 'completed' | 'in_progress' | 'planned'
}

export interface TimelineSection {
  type: 'timeline'
  id: string
  title: string
  items: TimelineItem[]
  weight: number
}

export interface ComparisonSection {
  type: 'comparison'
  id: string
  title: string
  left: { label: string; points: string[] }
  right: { label: string; points: string[] }
  weight: number
}

export type ReportSection =
  | CoverSection
  | ExecutiveSummarySection
  | KpiDashboardSection
  | ChartSection
  | TableSection
  | ContentSection
  | RecommendationsSection
  | TimelineSection
  | ComparisonSection

export interface Report {
  meta: ReportMeta
  sections: ReportSection[]
}

export interface ReportResponse {
  reportId: string
  version: number
  report: Report
}
