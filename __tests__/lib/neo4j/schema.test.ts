import { describe, it, expect } from 'vitest';
import { getSchemaStatements } from '@/lib/neo4j/schema';

describe('getSchemaStatements', () => {
  it('returns an array of statement objects', () => {
    const statements = getSchemaStatements();
    expect(Array.isArray(statements)).toBe(true);
    expect(statements.length).toBeGreaterThan(0);
  });

  it('all statements have non-empty type, description, and cypher fields', () => {
    const statements = getSchemaStatements();
    for (const stmt of statements) {
      expect(stmt.type).toMatch(/^(constraint|index|fulltext)$/);
      expect(typeof stmt.description).toBe('string');
      expect(stmt.description.length).toBeGreaterThan(0);
      expect(typeof stmt.cypher).toBe('string');
      expect(stmt.cypher.trim().length).toBeGreaterThan(0);
    }
  });

  it('returns constraint statements containing Person', () => {
    const statements = getSchemaStatements();
    const personConstraints = statements.filter(
      (s) => s.type === 'constraint' && s.description.includes('Person')
    );
    expect(personConstraints.length).toBeGreaterThan(0);
  });

  it('returns constraint statements containing Company', () => {
    const statements = getSchemaStatements();
    const companyConstraints = statements.filter(
      (s) => s.type === 'constraint' && s.description.includes('Company')
    );
    expect(companyConstraints.length).toBeGreaterThan(0);
  });

  it('returns constraint statements containing Country', () => {
    const statements = getSchemaStatements();
    const countryConstraints = statements.filter(
      (s) => s.type === 'constraint' && s.description.includes('Country')
    );
    expect(countryConstraints.length).toBeGreaterThan(0);
  });

  it('returns constraint statements containing SanctionsList', () => {
    const statements = getSchemaStatements();
    const sanctionsConstraints = statements.filter(
      (s) => s.type === 'constraint' && s.description.includes('SanctionsList')
    );
    expect(sanctionsConstraints.length).toBeGreaterThan(0);
  });

  it('returns fulltext index statements', () => {
    const statements = getSchemaStatements();
    const fulltextStatements = statements.filter((s) => s.type === 'fulltext');
    expect(fulltextStatements.length).toBeGreaterThan(0);
  });

  it('includes a fulltext index for personNames', () => {
    const statements = getSchemaStatements();
    const personFulltext = statements.find(
      (s) => s.type === 'fulltext' && s.description.toLowerCase().includes('person')
    );
    expect(personFulltext).toBeDefined();
    expect(personFulltext!.cypher).toContain('personNames');
  });

  it('includes a fulltext index for companyNames', () => {
    const statements = getSchemaStatements();
    const companyFulltext = statements.find(
      (s) => s.type === 'fulltext' && s.description.toLowerCase().includes('company')
    );
    expect(companyFulltext).toBeDefined();
    expect(companyFulltext!.cypher).toContain('companyNames');
  });

  it('includes standard indexes for normalizedName on Person and Company', () => {
    const statements = getSchemaStatements();
    const indexes = statements.filter((s) => s.type === 'index');
    const hasPersonNormalizedName = indexes.some(
      (s) => s.description.includes('Person') && s.description.includes('normalizedName')
    );
    const hasCompanyNormalizedName = indexes.some(
      (s) => s.description.includes('Company') && s.description.includes('normalizedName')
    );
    expect(hasPersonNormalizedName).toBe(true);
    expect(hasCompanyNormalizedName).toBe(true);
  });

  it('all cypher strings begin with a valid Cypher keyword', () => {
    const statements = getSchemaStatements();
    const validStart = /^(CREATE|DROP|CALL)/i;
    for (const stmt of statements) {
      expect(stmt.cypher.trim()).toMatch(validStart);
    }
  });
});
