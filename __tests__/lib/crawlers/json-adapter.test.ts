import { describe, it, expect } from "vitest";
import { JsonApiCrawler } from "@/lib/crawlers/adapters/json-adapter";
import type { DataSource } from "@/lib/types";

function makeSource(fieldMapping: string): DataSource {
  return {
    id: "test-id",
    sourceId: "test-source",
    name: "Test Source",
    type: "json",
    enabled: true,
    url: "https://example.com/data.json",
    riskLevel: "HIGH",
    fieldMapping,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("JsonApiCrawler field mapping validation", () => {
  it("accepts valid field mapping", () => {
    const mapping = JSON.stringify({
      entityPath: "data.entries",
      idField: "id",
      nameField: "fullName",
    });
    expect(() => new JsonApiCrawler(makeSource(mapping))).not.toThrow();
  });

  it("rejects empty object (missing required fields)", () => {
    expect(() => new JsonApiCrawler(makeSource("{}"))).toThrow();
  });

  it("rejects missing entityPath", () => {
    const mapping = JSON.stringify({ idField: "id", nameField: "name" });
    expect(() => new JsonApiCrawler(makeSource(mapping))).toThrow();
  });

  it("rejects missing idField", () => {
    const mapping = JSON.stringify({
      entityPath: "data",
      nameField: "name",
    });
    expect(() => new JsonApiCrawler(makeSource(mapping))).toThrow();
  });

  it("rejects missing nameField", () => {
    const mapping = JSON.stringify({
      entityPath: "data",
      idField: "id",
    });
    expect(() => new JsonApiCrawler(makeSource(mapping))).toThrow();
  });

  it("accepts all optional fields", () => {
    const mapping = JSON.stringify({
      entityPath: "results",
      idField: "uid",
      nameField: "full_name",
      typeField: "entity_type",
      typePersonValue: "individual",
      aliasesField: "aka",
      dobField: "birth_date",
      nationalityField: "country",
      roleField: "position",
    });
    expect(() => new JsonApiCrawler(makeSource(mapping))).not.toThrow();
  });

  it("rejects invalid JSON", () => {
    expect(() => new JsonApiCrawler(makeSource("not json"))).toThrow();
  });
});
