import { z } from 'zod';

// ─── Shared primitives ────────────────────────────────────────────────────────

const RiskLevelSchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);

const EntityTypeSchema = z.enum(['person', 'company']);

// ─── PersonSchema ─────────────────────────────────────────────────────────────

export const PersonSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  aliases: z.array(z.string()),
  normalizedName: z.string(),
  dateOfBirth: z.string().optional(),
  nationality: z.array(z.string()),
  pepRole: z.string().optional(),
  pepCountry: z.string().optional(),
  sanctionsList: z.array(z.string()),
  riskLevel: RiskLevelSchema.optional(),
  sourceIds: z.array(z.string()),
  lastUpdated: z.string(),
});

export type Person = z.infer<typeof PersonSchema>;

// ─── CompanySchema ────────────────────────────────────────────────────────────

export const CompanySchema = z.object({
  id: z.string(),
  name: z.string(),
  normalizedName: z.string(),
  jurisdiction: z.string().optional(),
  registrationNumber: z.string().optional(),
  sanctionsList: z.array(z.string()),
  sourceIds: z.array(z.string()),
  lastUpdated: z.string(),
});

export type Company = z.infer<typeof CompanySchema>;

// ─── CountrySchema ────────────────────────────────────────────────────────────

export const CountrySchema = z.object({
  code: z.string().length(2),
  name: z.string(),
});

export type Country = z.infer<typeof CountrySchema>;

// ─── SanctionsListSchema ──────────────────────────────────────────────────────

export const SanctionsListSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: z.string(),
  lastCrawled: z.string(),
});

export type SanctionsList = z.infer<typeof SanctionsListSchema>;

// ─── ScreenRequestSchema ──────────────────────────────────────────────────────

export const ScreenRequestSchema = z.object({
  name: z.string(),
  dob: z.string().optional(),
  nationality: z.string().optional(),
  threshold: z.number().min(0).max(1).optional(),
});

export type ScreenRequest = z.infer<typeof ScreenRequestSchema>;

// ─── CompanyScreenRequestSchema ───────────────────────────────────────────────

export const CompanyScreenRequestSchema = z.object({
  name: z.string(),
  jurisdiction: z.string().optional(),
  threshold: z.number().min(0).max(1).optional(),
});

export type CompanyScreenRequest = z.infer<typeof CompanyScreenRequestSchema>;

// ─── BatchScreenRequestSchema ─────────────────────────────────────────────────

const BatchEntitySchema = z.object({
  name: z.string(),
  type: EntityTypeSchema,
  dob: z.string().optional(),
  nationality: z.string().optional(),
});

export const BatchScreenRequestSchema = z.object({
  entities: z.array(BatchEntitySchema).min(1).max(1000),
});

export type BatchScreenRequest = z.infer<typeof BatchScreenRequestSchema>;

// ─── MatchResultSchema ────────────────────────────────────────────────────────

export const MatchResultSchema = z.object({
  entityId: z.string(),
  fullName: z.string(),
  score: z.number().min(0).max(1),
  matchedField: z.string(),
  entityType: EntityTypeSchema,
  pepRole: z.string().optional(),
  sanctionsList: z.array(z.string()),
  nationality: z.array(z.string()).optional(),
  linkedEntityCount: z.number().int().nonnegative(),
});

export type MatchResult = z.infer<typeof MatchResultSchema>;

// ─── CrawlRunSchema ───────────────────────────────────────────────────────────

export const CrawlRunSchema = z.object({
  id: z.string(),
  source: z.string(),
  date: z.string(),
  status: z.enum(['success', 'failed', 'running']),
  recordCount: z.number().int().nonnegative(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  error: z.string().optional(),
});

export type CrawlRun = z.infer<typeof CrawlRunSchema>;

// ─── RelationshipSchema ───────────────────────────────────────────────────────

export const RelationshipSchema = z.object({
  type: z.enum(['FAMILY_OF', 'ASSOCIATE_OF', 'DIRECTOR_OF', 'BENEFICIAL_OWNER_OF', 'SUBSIDIARY_OF']),
  targetName: z.string(),
  relation: z.string().optional(),
  context: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  percentage: z.number().optional(),
});

export type Relationship = z.infer<typeof RelationshipSchema>;

// ─── NormalizedEntitySchema ───────────────────────────────────────────────────

export const NormalizedEntitySchema = z.object({
  type: EntityTypeSchema,
  fullName: z.string(),
  aliases: z.array(z.string()),
  normalizedName: z.string(),
  dateOfBirth: z.string().optional(),
  nationality: z.array(z.string()).optional(),
  pepRole: z.string().optional(),
  pepCountry: z.string().optional(),
  jurisdiction: z.string().optional(),
  registrationNumber: z.string().optional(),
  riskLevel: RiskLevelSchema.optional(),
  sourceId: z.string(),
  source: z.string(),
  relationships: z.array(RelationshipSchema),
});

export type NormalizedEntity = z.infer<typeof NormalizedEntitySchema>;

// ─── RawEntitySchema ──────────────────────────────────────────────────────────

export const RawEntitySchema = z.object({
  rawId: z.string(),
  rawData: z.record(z.string(), z.unknown()),
  source: z.string(),
});

export type RawEntity = z.infer<typeof RawEntitySchema>;

// ─── DataSourceSchema ────────────────────────────────────────────────────────

const DataSourceTypeSchema = z.enum(['builtin', 'json', 'csv', 'xml', 'ndjson']);

export const DataSourceSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  name: z.string(),
  type: DataSourceTypeSchema,
  enabled: z.boolean(),
  url: z.string(),
  riskLevel: RiskLevelSchema.default('HIGH'),
  fieldMapping: z.string().optional(),
  builtinKey: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type DataSource = z.infer<typeof DataSourceSchema>;

export const DataSourceCreateSchema = z.object({
  sourceId: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Only lowercase alphanumeric and hyphens'),
  name: z.string().min(1).max(100),
  type: DataSourceTypeSchema,
  enabled: z.boolean().default(false),
  url: z.string().url(),
  riskLevel: RiskLevelSchema.default('HIGH'),
  fieldMapping: z.string().optional(),
  builtinKey: z.string().optional(),
});

export type DataSourceCreate = z.infer<typeof DataSourceCreateSchema>;

export const DataSourceUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
  url: z.string().url().optional(),
  riskLevel: RiskLevelSchema.optional(),
  fieldMapping: z.string().optional(),
});

export type DataSourceUpdate = z.infer<typeof DataSourceUpdateSchema>;

// ─── MatchingConfigSchema ─────────────────────────────────────────────────────

export const MatchingConfigSchema = z.object({
  minScore: z.number().min(0).max(1).default(0.6),
  weights: z.object({
    levenshtein: z.number().min(0).max(1).default(0.25),
    jaroWinkler: z.number().min(0).max(1).default(0.25),
    metaphone: z.number().min(0).max(1).default(0.25),
    tokenSet: z.number().min(0).max(1).default(0.25),
  }).default({
    levenshtein: 0.25,
    jaroWinkler: 0.25,
    metaphone: 0.25,
    tokenSet: 0.25,
  }),
});

export type MatchingConfig = z.infer<typeof MatchingConfigSchema>;

export const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  minScore: 0.6,
  weights: {
    levenshtein: 0.25,
    jaroWinkler: 0.25,
    metaphone: 0.25,
    tokenSet: 0.25,
  },
};
