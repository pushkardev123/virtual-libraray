import type { NextApiRequest, NextApiResponse } from 'next'

const DEFAULT_BACKEND_BASE_URL = 'https://backend.virtuallibrary.in'
const CONFIGURED_BACKEND_BASE_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  DEFAULT_BACKEND_BASE_URL

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const pathParts = req.query.path

  if (!pathParts) {
    return res.status(400).json({ message: 'Missing backend path' })
  }

  const normalizedPath = Array.isArray(pathParts) ? pathParts.join('/') : pathParts
  const incomingUrl = new URL(req.url || '/api/backend', 'http://localhost')
  const backendBaseUrl = resolveBackendBaseUrl(req)
  const targetUrl = new URL(`${backendBaseUrl.replace(/\/+$/, '')}/${normalizedPath.replace(/^\/+/, '')}`)

  incomingUrl.searchParams.forEach((value, key) => {
    if (key !== 'path') {
      targetUrl.searchParams.append(key, value)
    }
  })

  const headers = new Headers()
  copyHeader(headers, 'authorization', req.headers.authorization)
  copyHeader(headers, 'cookie', req.headers.cookie)
  copyHeader(headers, 'content-type', req.headers['content-type'])
  copyHeader(headers, 'accept', req.headers.accept)
  copyHeader(headers, 'user-agent', req.headers['user-agent'])

  try {
    const response = await fetch(targetUrl.toString(), {
      method: req.method,
      headers,
      body: getRequestBody(req),
      redirect: 'manual',
    })

    const responseText = await response.text()
    const contentType = response.headers.get('content-type')
    const setCookie = response.headers.get('set-cookie')

    if (contentType) {
      res.setHeader('Content-Type', contentType)
    }

    if (setCookie) {
      res.setHeader('Set-Cookie', setCookie)
    }

    res.status(response.status).send(responseText)
  } catch (error) {
    console.error('Backend proxy request failed:', error)
    res.status(502).json({ message: 'Unable to reach backend service' })
  }
}

function getRequestBody(req: NextApiRequest) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return undefined
  }

  if (req.body == null || req.body === '') {
    return undefined
  }

  return typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
}

function copyHeader(headers: Headers, key: string, value: string | string[] | undefined) {
  if (!value) {
    return
  }

  headers.set(key, Array.isArray(value) ? value.join(', ') : value)
}

function resolveBackendBaseUrl(req: NextApiRequest) {
  try {
    const targetUrl = new URL(CONFIGURED_BACKEND_BASE_URL)
    const currentHost = req.headers.host

    if (currentHost && targetUrl.host === currentHost) {
      return DEFAULT_BACKEND_BASE_URL
    }

    return targetUrl.toString().replace(/\/+$/, '')
  } catch {
    return DEFAULT_BACKEND_BASE_URL
  }
}
