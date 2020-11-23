/*! express-sitemap-xml. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */
module.exports = expressSitemapXml
module.exports.buildSitemaps = buildSitemaps

const builder = require('xmlbuilder')
const pMemoize = require('p-memoize')
const { URL } = require('url') // TODO: Remove once Node 8 support is dropped

const MAX_SITEMAP_LENGTH = 50 * 1000 // Max URLs in a sitemap (defined by spec)
const SITEMAP_URL_RE = /\/sitemap(-\d+)?\.xml/ // Sitemap url pattern
const SITEMAP_MAX_AGE = 24 * 60 * 60 * 1000 // Cache sitemaps for 24 hours

function expressSitemapXml (getUrls, base) {
  if (typeof getUrls !== 'function') {
    throw new Error('Argument `getUrls` must be a function')
  }
  if (typeof base !== 'string') {
    throw new Error('Argument `base` must be a string')
  }

  async function loadSitemaps () {
    const urls = await getUrls()
    if (!Array.isArray(urls)) {
      throw new Error('async function `getUrls` must resolve to an Array')
    }
    return buildSitemaps(urls, base)
  }

  const memoizedLoad = pMemoize(loadSitemaps, {
    maxAge: SITEMAP_MAX_AGE
  })

  return async (req, res, next) => {
    const isSitemapUrl = SITEMAP_URL_RE.test(req.url)
    if (isSitemapUrl) {
      const sitemaps = await memoizedLoad()
      if (sitemaps[req.url]) {
        res.setHeader('Content-Type', 'application/xml')
        return res.status(200).send(sitemaps[req.url])
      }
    }
    next()
  }
}

async function buildSitemaps (urls, base) {
  const sitemaps = Object.create(null)

  if (urls.length <= MAX_SITEMAP_LENGTH) {
    // If there is only one sitemap (i.e. there are less than 50,000 URLs)
    // then serve it directly at /sitemap.xml
    sitemaps['/sitemap.xml'] = buildSitemap(urls, base)
  } else {
    // Otherwise, serve a sitemap index at /sitemap.xml and sitemaps at
    // /sitemap-0.xml, /sitemap-1.xml, etc.
    for (let i = 0; i * MAX_SITEMAP_LENGTH < urls.length; i++) {
      const start = i * MAX_SITEMAP_LENGTH
      const selectedUrls = urls.slice(start, start + MAX_SITEMAP_LENGTH)
      sitemaps[`/sitemap-${i}.xml`] = buildSitemap(selectedUrls, base)
    }
    sitemaps['/sitemap.xml'] = buildSitemapIndex(sitemaps, base)
  }

  return sitemaps
}

function buildSitemapIndex (sitemaps, base) {
  const sitemapObjs = Object.keys(sitemaps).map((sitemapUrl, i) => {
    return {
      loc: toAbsolute(sitemapUrl, base),
      lastmod: getTodayStr()
    }
  })

  const sitemapIndexObj = {
    sitemapindex: {
      '@xmlns': 'http://www.sitemaps.org/schemas/sitemap/0.9',
      sitemap: sitemapObjs
    }
  }

  return buildXml(sitemapIndexObj)
}

function buildSitemap (urls, base) {
  const urlObjs = urls.map(url => {
    if (typeof url === 'string') {
      return {
        loc: toAbsolute(url, base)
      }
    }

    if (typeof url.url !== 'string') {
      throw new Error(
        `Invalid sitemap url object, missing 'url' property: ${JSON.stringify(url)}`
      )
    }

    const urlObj = {
      loc: toAbsolute(url.url, base)
    }
    if (url.lastMod === true) {
      urlObj.lastmod = getTodayStr()
    } else if (typeof url.lastMod === 'string' || url.lastMod instanceof Date) {
      urlObj.lastmod = dateToString(url.lastMod)
    }

    if (typeof url.changeFreq === 'string') {
      urlObj.changefreq = url.changeFreq
    }
    return urlObj
  })

  const sitemapObj = {
    urlset: {
      '@xmlns': 'http://www.sitemaps.org/schemas/sitemap/0.9',
      url: urlObjs
    }
  }

  return buildXml(sitemapObj)
}

function buildXml (obj) {
  const opts = {
    encoding: 'utf-8'
  }
  const xml = builder.create(obj, opts)
  return xml.end({ pretty: true, allowEmpty: false })
}

function getTodayStr () {
  return dateToString(new Date())
}

function dateToString (date) {
  if (typeof date === 'string') return date
  return date.toISOString().split('T')[0]
}

function toAbsolute (url, base) {
  return new URL(url, base).href
}
