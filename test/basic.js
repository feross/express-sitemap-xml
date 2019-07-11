const test = require('tape')
const { join } = require('path')
const { buildSitemaps } = require('../')
const { readFileSync } = require('fs')
const { stripIndent } = require('common-tags')

test('basic usage', t => {
  t.plan(2)

  const urls = ['/1', '/2', '/3']

  buildSitemaps(urls, 'https://bitmidi.com').then(sitemaps => {
    t.deepEqual(new Set(Object.keys(sitemaps)), new Set(['/sitemap.xml']))

    t.equal(sitemaps['/sitemap.xml'], stripIndent`
      <?xml version="1.0" encoding="utf-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://bitmidi.com/1</loc>
          <lastmod>${getTodayStr()}</lastmod>
        </url>
        <url>
          <loc>https://bitmidi.com/2</loc>
          <lastmod>${getTodayStr()}</lastmod>
        </url>
        <url>
          <loc>https://bitmidi.com/3</loc>
          <lastmod>${getTodayStr()}</lastmod>
        </url>
      </urlset>
    `)
  })
})

test('usage with all options', t => {
  t.plan(2)

  const urls = [
    {
      url: '/1',
      lastMod: '2000-01-01',
      changeFreq: 'daily'
    },
    {
      url: '/2',
      lastMod: new Date('2000-02-02'),
      changeFreq: 'weekly'
    },
    {
      url: '/3'
    }
  ]

  buildSitemaps(urls, 'https://bitmidi.com').then(sitemaps => {
    t.deepEqual(new Set(Object.keys(sitemaps)), new Set(['/sitemap.xml']))

    t.equal(sitemaps['/sitemap.xml'], stripIndent`
      <?xml version="1.0" encoding="utf-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://bitmidi.com/1</loc>
          <lastmod>2000-01-01</lastmod>
          <changefreq>daily</changefreq>
        </url>
        <url>
          <loc>https://bitmidi.com/2</loc>
          <lastmod>2000-02-02</lastmod>
          <changefreq>weekly</changefreq>
        </url>
        <url>
          <loc>https://bitmidi.com/3</loc>
          <lastmod>${getTodayStr()}</lastmod>
        </url>
      </urlset>
    `)
  })
})

test('large test: use sitemap index for > 50,000 urls', t => {
  t.plan(4)

  const urls = []
  for (let i = 0; i < 60000; i++) {
    urls.push(`/${i}`)
  }

  buildSitemaps(urls, 'https://bitmidi.com').then(sitemaps => {
    t.deepEqual(
      new Set(Object.keys(sitemaps)),
      new Set(['/sitemap.xml', '/sitemap-0.xml', '/sitemap-1.xml']))

    t.equal(
      sitemaps['/sitemap.xml'],
      readFileSync(join(__dirname, 'large-sitemap.xml'), 'utf8')
        .replace(/2018-07-15/g, getTodayStr())
    )
    t.equal(
      sitemaps['/sitemap-0.xml'],
      readFileSync(join(__dirname, 'large-sitemap-0.xml'), 'utf8')
        .replace(/2018-07-15/g, getTodayStr())
    )
    t.equal(
      sitemaps['/sitemap-1.xml'],
      readFileSync(join(__dirname, 'large-sitemap-1.xml'), 'utf8')
        .replace(/2018-07-15/g, getTodayStr())
    )
  })
})

/** Utility function implementations copied from index.js */

function getTodayStr () {
  return dateToString(new Date())
}

function dateToString (date) {
  if (typeof date === 'string') return date
  return date.toISOString().split('T')[0]
}
