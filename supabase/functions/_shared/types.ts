// supabase/functions/_shared/types.ts
// Content copied from root types/research.ts

// Corresponds to the public.research_criterion SQL enum
export enum ResearchCriterion {
  MANAGEMENT = 'management',
  COMPETITORS = 'competitors',
  OUTLOOK = 'outlook',
  RISKS = 'risks',
  MARGINS = 'margins',
  VALUATION = 'valuation',
  CAPITAL_STRUCTURE = 'capital_structure',
  RESEARCH_DEVELOPMENT = 'research_development',
  REVENUE_BREAKDOWN = 'revenue_breakdown',
  PRODUCTIVITY_METRICS = 'productivity_metrics',
  MA_ACTIVITY = 'm&a_activity',
  SUPPLY_CHAIN = 'supply_chain',
}

// Corresponds to the public.report_status SQL enum
export enum ReportStatus {
  PENDING = 'pending',
  GENERATING = 'generating',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// Corresponds to the public.deep_research_reports table
export interface DeepResearchReport {
  id: string; // UUID
  user_id: string; // UUID
  ticker: string;
  criteria: ResearchCriterion[];
  report: string | null;
  additional_notes: string | null;
  status: ReportStatus;
  created_at: string; // Timestamptz represented as string (ISO 8601)
  updated_at: string; // Timestamptz represented as string (ISO 8601)
} 