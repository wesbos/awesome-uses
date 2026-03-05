import { env as cfEnv } from 'cloudflare:workers';

type AnalyticsDataPoint = {
  indexes?: string[];
  blobs?: string[];
  doubles?: number[];
};

type AnalyticsBindingLike = {
  writeDataPoint: (point: AnalyticsDataPoint) => void;
};

type AnalyticsCredentials = {
  accountId: string;
  apiToken: string;
  dataset: string;
};

export type ViewEntityType = 'person' | 'tag' | 'item';

export type ViewEvent = {
  entityType: ViewEntityType;
  entityKey: string;
  route: string;
};

export type AnalyticsTopView = {
  key: string;
  views: number;
};

export type AnalyticsDashboardData = {
  available: boolean;
  reason?: string;
  timeframeDays: number;
  people: AnalyticsTopView[];
  tags: AnalyticsTopView[];
  items: AnalyticsTopView[];
};

function resolveAnalyticsBinding(): AnalyticsBindingLike | null {
  const binding = (cfEnv as Record<string, unknown>).USES_ANALYTICS;
  if (!binding || typeof binding !== 'object') return null;
  if (!('writeDataPoint' in binding)) return null;
  return binding as AnalyticsBindingLike;
}

function resolveAnalyticsCredentials(): AnalyticsCredentials | null {
  const accountId = (process.env.CF_ACCOUNT_ID || '').trim();
  const apiToken = (process.env.CF_ANALYTICS_API_TOKEN || '').trim();
  const dataset = (process.env.CF_ANALYTICS_DATASET || 'uses_views').trim();
  if (!accountId || !apiToken || !dataset) {
    return null;
  }
  return { accountId, apiToken, dataset };
}

export function writeViewEvent(event: ViewEvent) {
  const binding = resolveAnalyticsBinding();
  if (!binding) return;

  const key = event.entityKey.trim().toLowerCase();
  if (!key) return;

  try {
    binding.writeDataPoint({
      indexes: [`${event.entityType}:${key}`],
      blobs: [event.entityType, key, event.route],
      doubles: [1],
    });
  } catch {
    // fail-soft for analytics
  }
}

type SqlQueryResponse = {
  success: boolean;
  result?: {
    rows?: Array<Record<string, unknown>>;
  };
};

function buildTopViewsQuery(dataset: string, entityType: ViewEntityType, days: number): string {
  const safeDays = Number.isFinite(days) ? Math.max(1, Math.min(days, 365)) : 7;
  return `
SELECT
  blob2 AS entity_key,
  SUM(double1 * _sample_interval) AS views
FROM ${dataset}
WHERE blob1 = '${entityType}'
  AND timestamp >= NOW() - INTERVAL '${safeDays}' DAY
GROUP BY blob2
ORDER BY views DESC
LIMIT 25
`.trim();
}

async function queryCloudflareAnalyticsSql(
  sql: string,
  credentials: AnalyticsCredentials
): Promise<Array<Record<string, unknown>>> {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${credentials.accountId}/analytics_engine/sql`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${credentials.apiToken}`,
      'Content-Type': 'text/plain',
    },
    body: sql,
  });

  if (!response.ok) {
    throw new Error(`Cloudflare Analytics SQL request failed with ${response.status}`);
  }

  const json = (await response.json()) as SqlQueryResponse;
  if (!json.success) {
    return [];
  }

  return json.result?.rows ?? [];
}

function normalizeTopViewRows(rows: Array<Record<string, unknown>>): AnalyticsTopView[] {
  return rows
    .map((row) => {
      const key = String(row.entity_key ?? '').trim();
      const rawViews = Number(row.views ?? 0);
      return {
        key,
        views: Number.isFinite(rawViews) ? Math.round(rawViews) : 0,
      };
    })
    .filter((entry) => entry.key && entry.views > 0);
}

export async function getAnalyticsDashboardData(
  timeframeDays = 7,
): Promise<AnalyticsDashboardData> {
  const credentials = resolveAnalyticsCredentials();
  if (!credentials) {
    return {
      available: false,
      reason: 'Analytics SQL API credentials are not configured.',
      timeframeDays,
      people: [],
      tags: [],
      items: [],
    };
  }

  try {
    const [peopleRows, tagRows, itemRows] = await Promise.all([
      queryCloudflareAnalyticsSql(
        buildTopViewsQuery(credentials.dataset, 'person', timeframeDays),
        credentials
      ),
      queryCloudflareAnalyticsSql(
        buildTopViewsQuery(credentials.dataset, 'tag', timeframeDays),
        credentials
      ),
      queryCloudflareAnalyticsSql(
        buildTopViewsQuery(credentials.dataset, 'item', timeframeDays),
        credentials
      ),
    ]);

    return {
      available: true,
      timeframeDays,
      people: normalizeTopViewRows(peopleRows),
      tags: normalizeTopViewRows(tagRows),
      items: normalizeTopViewRows(itemRows),
    };
  } catch (error) {
    return {
      available: false,
      reason:
        error instanceof Error
          ? error.message
          : 'Failed to query Cloudflare Analytics Engine.',
      timeframeDays,
      people: [],
      tags: [],
      items: [],
    };
  }
}

export const __analyticsTestUtils = {
  buildTopViewsQuery,
  normalizeTopViewRows,
};
