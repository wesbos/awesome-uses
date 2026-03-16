import { describe, expect, it } from 'vite-plus/test';
import { __analyticsTestUtils } from './analytics';

describe('analytics helpers', () => {
  it('builds top-view SQL query with dataset and entity', () => {
    const query = __analyticsTestUtils.buildTopViewsQuery(
      'uses_views',
      'person',
      14
    );

    expect(query).toContain('FROM uses_views');
    expect(query).toContain("blob1 = 'person'");
    expect(query).toContain("INTERVAL '14' DAY");
  });

  it('normalizes analytics rows safely', () => {
    const rows = __analyticsTestUtils.normalizeTopViewRows([
      { entity_key: 'wes-bos', views: 12.6 },
      { entity_key: '', views: 7 },
      { entity_key: 'react', views: '4' },
      { entity_key: 'bad', views: 'nan' },
    ]);

    expect(rows).toEqual([
      { key: 'wes-bos', views: 13 },
      { key: 'react', views: 4 },
    ]);
  });
});
