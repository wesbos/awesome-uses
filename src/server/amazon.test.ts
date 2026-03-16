import { describe, expect, it } from 'vite-plus/test';
import { __amazonTestUtils } from './amazon';

describe('amazon helpers', () => {
  it('maps Amazon SearchItems response into products', () => {
    const products = __amazonTestUtils.mapAmazonProducts({
      SearchResult: {
        Items: [
          {
            ASIN: 'B001',
            DetailPageURL: 'https://amazon.com/dp/B001',
            Images: { Primary: { Large: { URL: 'https://img.test/B001.jpg' } } },
            ItemInfo: {
              Title: { DisplayValue: 'Keychron K2' },
              ByLineInfo: { Brand: { DisplayValue: 'Keychron' } },
            },
            Offers: { Listings: [{ Price: { DisplayAmount: '$89.99' } }] },
          },
          {
            ASIN: 'B002',
            DetailPageURL: '',
            ItemInfo: { Title: { DisplayValue: 'Invalid item' } },
          },
        ],
      },
    });

    expect(products).toEqual([
      {
        asin: 'B001',
        title: 'Keychron K2',
        detailPageUrl: 'https://amazon.com/dp/B001',
        imageUrl: 'https://img.test/B001.jpg',
        price: '$89.99',
        brand: 'Keychron',
      },
    ]);
  });

  it('signs PA-API requests with AWS4 authorization', () => {
    const { endpoint, headers } = __amazonTestUtils.signAmazonRequest(
      JSON.stringify({ Keywords: 'MacBook Pro' }),
      {
        accessKey: 'AKIA_TEST',
        secretKey: 'SECRET_TEST',
        partnerTag: 'test-20',
        host: 'webservices.amazon.com',
        region: 'us-east-1',
        marketplace: 'www.amazon.com',
      },
      new Date('2026-03-05T12:00:00.000Z')
    );

    expect(endpoint).toBe('https://webservices.amazon.com/paapi5/searchitems');
    expect(headers.Authorization).toContain('AWS4-HMAC-SHA256 Credential=AKIA_TEST/');
    expect(headers.Authorization).toContain('SignedHeaders=');
    expect(headers.Authorization).toContain('Signature=');
    expect(headers['x-amz-target']).toContain('SearchItems');
  });
});
