import { getDriver } from '@/lib/neo4j/client';
import crypto from 'crypto';

interface BuiltinSourceDef {
  sourceId: string;
  name: string;
  url: string;
  riskLevel: string;
  builtinKey: string;
}

const BUILTIN_SOURCES: BuiltinSourceDef[] = [
  {
    sourceId: 'ofac',
    name: 'OFAC SDN',
    url: 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN_ADVANCED.XML',
    riskLevel: 'HIGH',
    builtinKey: 'ofac',
  },
  {
    sourceId: 'un',
    name: 'UN Consolidated Sanctions',
    url: 'https://scsanctions.un.org/resources/xml/en/consolidated.xml',
    riskLevel: 'HIGH',
    builtinKey: 'un',
  },
  {
    sourceId: 'eu',
    name: 'EU Financial Sanctions',
    url: 'https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw',
    riskLevel: 'HIGH',
    builtinKey: 'eu',
  },
  {
    sourceId: 'uk-hmt',
    name: 'UK HMT Sanctions',
    url: 'https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/Consolidated_List_of_Financial_Sanctions_Targets_in_the_UK.csv',
    riskLevel: 'HIGH',
    builtinKey: 'uk-hmt',
  },
  {
    sourceId: 'opensanctions',
    name: 'OpenSanctions',
    url: 'https://data.opensanctions.org/datasets/latest/default/entities.ftm.json',
    riskLevel: 'HIGH',
    builtinKey: 'opensanctions',
  },
  {
    sourceId: 'everypolitician',
    name: 'EveryPolitician',
    url: 'https://everypolitician.org/countries.json',
    riskLevel: 'MEDIUM',
    builtinKey: 'everypolitician',
  },
  {
    sourceId: 'wikidata',
    name: 'Wikidata PEPs',
    url: 'https://query.wikidata.org/sparql',
    riskLevel: 'MEDIUM',
    builtinKey: 'wikidata',
  },
];

export async function seedBuiltinSources(): Promise<void> {
  const driver = getDriver();
  const session = driver.session();

  try {
    const now = new Date().toISOString();

    for (const def of BUILTIN_SOURCES) {
      await session.run(
        `
MERGE (d:DataSource {sourceId: $sourceId})
ON CREATE SET
  d.id           = $id,
  d.name         = $name,
  d.type         = 'builtin',
  d.enabled      = true,
  d.url          = $url,
  d.riskLevel    = $riskLevel,
  d.fieldMapping = '',
  d.builtinKey   = $builtinKey,
  d.createdAt    = $now,
  d.updatedAt    = $now
        `.trim(),
        {
          id: crypto.randomUUID(),
          sourceId: def.sourceId,
          name: def.name,
          url: def.url,
          riskLevel: def.riskLevel,
          builtinKey: def.builtinKey,
          now,
        },
      );
    }
  } finally {
    await session.close();
  }
}
