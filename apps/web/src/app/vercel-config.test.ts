import vercelConfig from '../../vercel.json';

describe('vercel.json', () => {
  it('sends /api to the API before falling back to the app', () => {
    const { rewrites } = vercelConfig;
    expect(rewrites[0].source).toBe('/api/:path*');
    expect(rewrites[0].destination).toBe(
      'https://helpy-lilac.vercel.app/api/:path*',
    );
    expect(rewrites.at(-1)).toEqual({
      source: '/(.*)',
      destination: '/index.html',
    });
  });
});
