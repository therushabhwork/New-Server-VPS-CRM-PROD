const zlib = require('zlib')

const compressionMiddleware = (req, res, next) => {
  const acceptEncoding = req.headers['accept-encoding'] || ''
  if (!acceptEncoding.includes('gzip')) {
    return next()
  }

  const originalSend = res.send.bind(res)
  res.send = (body) => {
    if (body && (typeof body === 'string' || Buffer.isBuffer(body))) {
      const byteLength = Buffer.byteLength(body)
      if (byteLength > 1024 && !res.getHeader('Content-Encoding')) {
        try {
          const compressed = zlib.gzipSync(body)
          res.setHeader('Content-Encoding', 'gzip')
          res.setHeader('Vary', 'Accept-Encoding')
          res.setHeader('Content-Length', compressed.length)
          res.removeHeader('Transfer-Encoding')
          return originalSend(compressed)
        } catch {
          return originalSend(body)
        }
      }
    }
    return originalSend(body)
  }

  next()
}

module.exports = compressionMiddleware

