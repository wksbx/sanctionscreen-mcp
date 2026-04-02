import { getDriver } from './client';
import { seedBuiltinSources } from '@/lib/sources/seed';

export interface SchemaStatement {
  type: 'constraint' | 'index' | 'fulltext';
  description: string;
  cypher: string;
}

export function getSchemaStatements(): SchemaStatement[] {
  return [
    // ── Uniqueness constraints ──────────────────────────────────────────────
    {
      type: 'constraint',
      description: 'Uniqueness constraint on Person.id',
      cypher: 'CREATE CONSTRAINT person_id_unique IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE',
    },
    {
      type: 'constraint',
      description: 'Uniqueness constraint on Company.id',
      cypher: 'CREATE CONSTRAINT company_id_unique IF NOT EXISTS FOR (c:Company) REQUIRE c.id IS UNIQUE',
    },
    {
      type: 'constraint',
      description: 'Uniqueness constraint on Country.code',
      cypher: 'CREATE CONSTRAINT country_code_unique IF NOT EXISTS FOR (c:Country) REQUIRE c.code IS UNIQUE',
    },
    {
      type: 'constraint',
      description: 'Uniqueness constraint on SanctionsList.id',
      cypher: 'CREATE CONSTRAINT sanctions_list_id_unique IF NOT EXISTS FOR (s:SanctionsList) REQUIRE s.id IS UNIQUE',
    },
    {
      type: 'constraint',
      description: 'Uniqueness constraint on CrawlRun.id',
      cypher: 'CREATE CONSTRAINT crawl_run_id_unique IF NOT EXISTS FOR (r:CrawlRun) REQUIRE r.id IS UNIQUE',
    },

    {
      type: 'constraint',
      description: 'Uniqueness constraint on DataSource.id',
      cypher: 'CREATE CONSTRAINT datasource_id_unique IF NOT EXISTS FOR (d:DataSource) REQUIRE d.id IS UNIQUE',
    },
    {
      type: 'constraint',
      description: 'Uniqueness constraint on DataSource.sourceId',
      cypher: 'CREATE CONSTRAINT datasource_source_id_unique IF NOT EXISTS FOR (d:DataSource) REQUIRE d.sourceId IS UNIQUE',
    },

    // ── Standard indexes ────────────────────────────────────────────────────
    {
      type: 'index',
      description: 'Index on Person.normalizedName',
      cypher: 'CREATE INDEX person_normalized_name IF NOT EXISTS FOR (p:Person) ON (p.normalizedName)',
    },
    {
      type: 'index',
      description: 'Index on Company.normalizedName',
      cypher: 'CREATE INDEX company_normalized_name IF NOT EXISTS FOR (c:Company) ON (c.normalizedName)',
    },
    {
      type: 'index',
      description: 'Composite index on Person(normalizedName, dateOfBirth)',
      cypher: 'CREATE INDEX person_name_dob IF NOT EXISTS FOR (p:Person) ON (p.normalizedName, p.dateOfBirth)',
    },
    {
      type: 'index',
      description: 'Index on SanctionsList.name',
      cypher: 'CREATE INDEX sanctions_list_name IF NOT EXISTS FOR (s:SanctionsList) ON (s.name)',
    },
    {
      type: 'index',
      description: 'Composite index on CrawlRun(source, date)',
      cypher: 'CREATE INDEX crawl_run_source_date IF NOT EXISTS FOR (r:CrawlRun) ON (r.source, r.date)',
    },

    // ── Full-text indexes ───────────────────────────────────────────────────
    {
      type: 'fulltext',
      description: 'Full-text index personNames on Person(normalizedName, fullName)',
      cypher: [
        'CREATE FULLTEXT INDEX personNames IF NOT EXISTS',
        'FOR (p:Person) ON EACH [p.normalizedName, p.fullName]',
        "OPTIONS { indexConfig: { `fulltext.analyzer`: 'standard-no-stop-words' } }",
      ].join(' '),
    },
    {
      type: 'fulltext',
      description: 'Full-text index companyNames on Company(normalizedName, name)',
      cypher: [
        'CREATE FULLTEXT INDEX companyNames IF NOT EXISTS',
        'FOR (c:Company) ON EACH [c.normalizedName, c.name]',
        "OPTIONS { indexConfig: { `fulltext.analyzer`: 'standard-no-stop-words' } }",
      ].join(' '),
    },
  ];
}

export async function applySchema(): Promise<void> {
  const driver = getDriver();
  const session = driver.session();
  try {
    const statements = getSchemaStatements();
    for (const stmt of statements) {
      await session.run(stmt.cypher);
    }
  } finally {
    await session.close();
  }

  await seedBuiltinSources();
}
