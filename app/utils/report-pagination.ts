/**
 * Report Pagination — distributes sections into A4 pages
 * Uses weight + content length heuristic to avoid overflow
 */
import type { ReportSection } from '../types/report'

export interface ReportPage {
  number: number
  sections: ReportSection[]
}

/**
 * Estimate effective weight based on actual content size.
 * AI's weight often underestimates — long text gets bumped up.
 */
function effectiveWeight(section: ReportSection): number {
  const baseWeight = Math.abs(section.weight) || 0.5

  // Estimate content length
  let contentLength = 0
  if ('content' in section && typeof section.content === 'string') {
    contentLength = section.content.length
  }
  if ('items' in section && Array.isArray(section.items)) {
    contentLength = JSON.stringify(section.items).length
  }
  if ('left' in section && 'right' in section) {
    // Comparison — both sides
    contentLength = JSON.stringify(section.left).length + JSON.stringify(section.right).length
  }
  if ('kpis' in section && Array.isArray(section.kpis)) {
    contentLength = section.kpis.length * 200 // ~200 chars per KPI card
  }
  if ('rows' in section && Array.isArray(section.rows)) {
    contentLength = section.rows.length * section.columns.length * 50
  }

  // Heuristic: ~1500 chars fits in weight 0.5 on A4
  // If content is longer, bump up the weight
  const estimatedWeight = Math.max(baseWeight, contentLength / 3000)

  // Cap at 1.0 — if bigger, it gets its own page anyway
  return Math.min(1.0, Math.round(estimatedWeight * 4) / 4) // round to 0.25
}

/**
 * Distribute sections into pages.
 * Cover always gets its own page.
 * Other sections fill pages based on effective weight.
 */
export function distributeToPages(sections: ReportSection[]): ReportPage[] {
  const pages: ReportPage[] = []
  let currentSections: ReportSection[] = []
  let currentWeight = 0

  for (const section of sections) {
    // Cover always gets its own page
    if (section.type === 'cover') {
      if (currentSections.length > 0) {
        pages.push({ number: pages.length + 1, sections: currentSections })
        currentSections = []
        currentWeight = 0
      }
      pages.push({ number: pages.length + 1, sections: [section] })
      continue
    }

    const weight = effectiveWeight(section)

    // If adding this section exceeds page capacity, start new page
    if (currentWeight + weight > 1.15) {
      if (currentSections.length > 0) {
        pages.push({ number: pages.length + 1, sections: currentSections })
      }
      currentSections = [section]
      currentWeight = weight
    } else {
      currentSections.push(section)
      currentWeight += weight
    }
  }

  if (currentSections.length > 0) {
    pages.push({ number: pages.length + 1, sections: currentSections })
  }

  return pages
}
