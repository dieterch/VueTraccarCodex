#!/usr/bin/env node
import { randomBytes, scryptSync } from 'node:crypto'

function parseArgs(argv) {
  const options = {
    N: 16384,
    r: 8,
    p: 1,
    keylen: 64
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--password' && argv[i + 1]) {
      options.password = argv[++i]
    } else if (arg === '--N' && argv[i + 1]) {
      options.N = Number(argv[++i])
    } else if (arg === '--r' && argv[i + 1]) {
      options.r = Number(argv[++i])
    } else if (arg === '--p' && argv[i + 1]) {
      options.p = Number(argv[++i])
    } else if (arg === '--keylen' && argv[i + 1]) {
      options.keylen = Number(argv[++i])
    }
  }

  return options
}

function assertValid(params) {
  if (!params.password || String(params.password).length === 0) {
    console.error('Missing password. Use --password "...", or set MOBILE_AUTH_PASSWORD.')
    process.exit(1)
  }
  if (!Number.isInteger(params.N) || params.N <= 1) {
    console.error('Invalid N value.')
    process.exit(1)
  }
  if (!Number.isInteger(params.r) || params.r <= 0) {
    console.error('Invalid r value.')
    process.exit(1)
  }
  if (!Number.isInteger(params.p) || params.p <= 0) {
    console.error('Invalid p value.')
    process.exit(1)
  }
  if (!Number.isInteger(params.keylen) || params.keylen < 16) {
    console.error('Invalid keylen value.')
    process.exit(1)
  }
}

const args = parseArgs(process.argv.slice(2))
const password = args.password || process.env.MOBILE_AUTH_PASSWORD

const params = {
  password,
  N: args.N,
  r: args.r,
  p: args.p,
  keylen: args.keylen
}

assertValid(params)

const salt = randomBytes(16)
const derived = scryptSync(params.password, salt, params.keylen, {
  N: params.N,
  r: params.r,
  p: params.p,
  maxmem: 128 * params.N * params.r * 2
})

const encoded = `scrypt$${params.N}$${params.r}$${params.p}$${salt.toString('base64')}$${derived.toString('base64')}`
console.log(encoded)
