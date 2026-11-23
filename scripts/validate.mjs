#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const VERSION_DIRECTORY = /^v\d+\.\d+$/
const SCHEMA_BASE = 'https://raw.githubusercontent.com/Costroid/costroid-schemas/main/'
const PROOF_AUDIENCE_BASE = 'https://app.costroid.com/tenants/'
const GITHUB_ISSUER = 'https://token.actions.githubusercontent.com'
const PROOF_WINDOW_SECONDS = 600
const CLOCK_SKEW_SECONDS = 60
const CI_PROOF_CURRENT_SECONDS = 7 * 24 * 60 * 60

const failures = []
const report = (path, problem) => {
  failures.push(path)
  console.error(`FAIL ${relative(ROOT, path)}: ${problem}`)
}
const pass = (path, note) => console.log(`ok   ${relative(ROOT, path)} (${note})`)

function versionDirectories() {
  return readdirSync(ROOT)
    .filter((name) => !name.startsWith('.') && name !== 'node_modules')
    .map((name) => join(ROOT, name))
    .filter((path) => statSync(path).isDirectory())
    .flatMap((path) =>
      readdirSync(path)
        .filter((name) => VERSION_DIRECTORY.test(name))
        .map((name) => join(path, name)),
    )
}

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

function exampleFiles(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory)
    .map((name) => join(directory, name))
    .filter((path) => statSync(path).isFile())
}

function parseCsv(text) {
  const records = []
  let record = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character !== '"') cell += character
      else if (text[index + 1] === '"') {
        cell += '"'
        index += 1
      } else quoted = false
    } else if (character === '"') quoted = true
    else if (character === ',') {
      record.push(cell)
      cell = ''
    } else if (character === '\n') {
      record.push(cell)
      records.push(record)
      record = []
      cell = ''
    } else cell += character
  }
  if (cell !== '' || quoted) throw new Error('the file does not end with a line feed')
  return records
}

function csvRows(text) {
  const [header, ...records] = parseCsv(text)
  return records.map((record, line) => {
    if (record.length !== header.length)
      throw new Error(
        `data row ${line + 1} has ${record.length} cells, the header has ${header.length}`,
      )
    return Object.fromEntries(
      header.map((column, index) => {
        const cell = record[index]
        if (cell === '') return [column, null]
        return [column, column === 'Tags' ? JSON.parse(cell) : cell]
      }),
    )
  })
}

function instancesOf(path) {
  const text = readFileSync(path, 'utf8')
  switch (extname(path)) {
    case '.json':
      return [JSON.parse(text)]
    case '.jsonl':
      return text
        .trimEnd()
        .split('\n')
        .map((line) => JSON.parse(line))
    case '.csv':
      return csvRows(text)
    default:
      throw new Error('an example is .json, .jsonl or .csv')
  }
}

function scaled(decimal) {
  const [whole, fraction = ''] = decimal.split('.')
  return { digits: BigInt(whole + fraction), scale: fraction.length }
}

function productEquals(left, right, expected) {
  const a = scaled(left)
  const b = scaled(right)
  const c = scaled(expected)
  const productScale = a.scale + b.scale
  const scale = Math.max(productScale, c.scale)
  return (
    a.digits * b.digits * 10n ** BigInt(scale - productScale) ===
    c.digits * 10n ** BigInt(scale - c.scale)
  )
}

function rowIdProblem(row, requestIds) {
  const requestId = requestIds[row.Tags['costroid/cost_source']]
  if (requestId === undefined)
    return `no request id names cost source ${row.Tags['costroid/cost_source']}`
  const expected = createHash('sha256').update(`${requestId}:${row.SkuMeter}`).digest('hex')
  return row.x_CostroidRowId === expected
    ? undefined
    : `x_CostroidRowId is not the SHA-256 of ${requestId}:${row.SkuMeter}`
}

function focusRowProblems(row, requestIds) {
  const problems = []
  const rowId = rowIdProblem(row, requestIds)
  if (rowId !== undefined) problems.push(rowId)
  if (!productEquals(row.ListUnitPrice, row.PricingQuantity, row.ListCost))
    problems.push('ListCost is not ListUnitPrice times PricingQuantity')
  if (!productEquals(row.ContractedUnitPrice, row.PricingQuantity, row.ContractedCost))
    problems.push('ContractedCost is not ContractedUnitPrice times PricingQuantity')
  if (row.ChargePeriodStart >= row.ChargePeriodEnd)
    problems.push('ChargePeriodEnd is not after ChargePeriodStart')
  if (row.ChargePeriodStart < row.BillingPeriodStart || row.ChargePeriodEnd > row.BillingPeriodEnd)
    problems.push('the charge period is outside the billing period')
  return problems
}

const unixSeconds = (timestamp) => Date.parse(timestamp) / 1000

function provenSubject(claims) {
  if (claims.repository_owner_id !== undefined)
    return { id: `github-owner:${claims.repository_owner_id}`, kind: 'ci_oidc' }
  if (claims.namespace_id !== undefined)
    return { id: `gitlab-namespace:${claims.namespace_id}`, kind: 'ci_oidc' }
  return { id: claims.sub, kind: 'app_attestation' }
}

function outsideWindow(claims, now) {
  const lastValid = Math.min(claims.exp, claims.iat + PROOF_WINDOW_SECONDS)
  return now > lastValid + CLOCK_SKEW_SECONDS || claims.iat > now + CLOCK_SKEW_SECONDS
}

function proofRefusal(binding, subject) {
  const { claims } = binding
  if (!binding.keys_available) return 'INSTALLATION_PROOF_KEYS_UNAVAILABLE'
  if (claims.aud !== PROOF_AUDIENCE_BASE + binding.tenant_id)
    return 'INSTALLATION_PROOF_AUDIENCE_MISMATCH'
  if (outsideWindow(claims, unixSeconds(binding.at))) return 'INSTALLATION_PROOF_EXPIRED'
  if (subject.id !== binding.installation_id) return 'INSTALLATION_PROOF_SUBJECT_MISMATCH'
  return null
}

function holderYields(holder, subject, now) {
  if (subject.kind === 'app_attestation')
    return holder.proof_kind === 'ci_oidc' || holder.id !== subject.id
  return (
    holder.proof_kind === 'ci_oidc' &&
    now - unixSeconds(holder.changed_at) > CI_PROOF_CURRENT_SECONDS
  )
}

function bindingAnswer(binding) {
  const { claims, holder, tenant_id: tenant } = binding
  const subject = provenSubject(claims)
  const refusal = proofRefusal(binding, subject)
  const heldHere = holder?.status === 'active' && holder.tenant_id === tenant
  if (heldHere && holder.id === binding.installation_id) {
    const newer = refusal === null && claims.iat > unixSeconds(holder.changed_at)
    return { refusal: null, effect: newer ? 'renewed' : 'unchanged' }
  }
  if (refusal !== null) return { refusal, effect: null }
  if (holder === null || heldHere) return { refusal: null, effect: 'bound' }
  if (claims.iat <= unixSeconds(holder.changed_at))
    return { refusal: 'INSTALLATION_PROOF_EXPIRED', effect: null }
  if (holder.status !== 'active') return { refusal: null, effect: 'bound' }
  return holderYields(holder, subject, unixSeconds(binding.at))
    ? { refusal: null, effect: 'displaced' }
    : { refusal: 'INSTALLATION_BOUND_ELSEWHERE', effect: null }
}

const refused = (refusal) => ({ refusal, effect: null })
const sameStrings = (left, right, keys) => keys.every((key) => left[key] === right[key])

function credentialAudience({ tenant_id: tenant, write, key_id: key, body }) {
  const spend = write === 'spend' ? '/spend' : ''
  return `${PROOF_AUDIENCE_BASE}${tenant}/credentials/${key}/${body.run_id}/${body.run_attempt}${spend}`
}

function credentialStatement({ key_id: key, body, claims }) {
  return {
    key_id: key,
    repo: `github.com/${claims.repository}`.toLowerCase(),
    ...body,
    attested_by: { run_id: claims.run_id, run_attempt: claims.run_attempt, ref: claims.ref },
  }
}

const sameAttestingRun = (held, statement) =>
  held.repo === statement.repo &&
  sameStrings(held.attested_by, statement.attested_by, ['run_id', 'run_attempt'])

function attestationAnswer(statement, { attestations }) {
  const ofThisRun = attestations.filter((held) => sameAttestingRun(held, statement))
  const attestedFor = ['key_id', 'run_id', 'run_attempt', 'head_sha']
  if (ofThisRun.some((held) => sameStrings(held, statement, attestedFor)))
    return { refusal: null, effect: 'unchanged' }
  if (ofThisRun.length > 0) return refused('CREDENTIAL_ATTESTING_RUN_USED')
  if (attestations.some((held) => held.key_id === statement.key_id))
    return refused('CREDENTIAL_ATTESTED_ELSEWHERE')
  return { refusal: null, effect: 'stored' }
}

function spendAnswer(statement, { attestations, spends }) {
  const attestedFor = ['key_id', 'repo', 'run_id', 'run_attempt']
  if (!attestations.some((held) => sameStrings(held, statement, attestedFor)))
    return refused('CREDENTIAL_NOT_ATTESTED')
  const held = spends.find((spend) => spend.key_id === statement.key_id)
  if (held === undefined) return { refusal: null, effect: 'stored' }
  return sameStrings(held, statement, ['run_id', 'run_attempt', 'spend'])
    ? { refusal: null, effect: 'unchanged' }
    : refused('CREDENTIAL_SPEND_HELD')
}

const BODY_BYTES = 16384

function credentialInputValid(vector, schemaNamed) {
  const { body } = vector
  const bodySchema =
    vector.write === 'attestation' ? 'CredentialAttestationBody' : 'CredentialSpendBody'
  return (
    schemaNamed('KeyId')(vector.key_id) &&
    Buffer.byteLength(JSON.stringify(body), 'utf8') <= BODY_BYTES &&
    schemaNamed(bodySchema)(body)
  )
}

const GITHUB_INSTALLATION = /^github(-owner)?:/

function runTokenRefusal(vector, schemaNamed) {
  const { claims, installation } = vector
  if (claims.iss !== GITHUB_ISSUER) return 'RUN_TOKEN_INVALID'
  if (!GITHUB_INSTALLATION.test(installation.id)) return 'RUN_TOKEN_OWNER_MISMATCH'
  if (!vector.keys_available) return 'INSTALLATION_PROOF_KEYS_UNAVAILABLE'
  if (
    !vector.signature_verifies ||
    !schemaNamed('CredentialVerifiedClaims')(claims) ||
    claims.aud !== credentialAudience(vector) ||
    outsideWindow(claims, unixSeconds(vector.at))
  )
    return 'RUN_TOKEN_INVALID'
  if (claims.repository_owner_id !== installation.owner_id) return 'RUN_TOKEN_OWNER_MISMATCH'
  if (!schemaNamed('WorkflowRunEvent')(claims)) return 'CREDENTIAL_RUN_UNPROTECTED'
  if (!schemaNamed('ProtectedBranchClaims')(claims)) return 'CREDENTIAL_RUN_UNPROTECTED'
  return null
}

function credentialAnswer(vector, schemaNamed) {
  const scope = schemaNamed('Scope')
  if (!vector.scopes.some((name) => scope(name))) return refused('AUTH_TOKEN_SCOPE')
  if (!credentialInputValid(vector, schemaNamed)) return refused('TOOL_INPUT_INVALID')
  if (!vector.scopes.includes('credentials:write')) return refused('AUTH_TOKEN_SCOPE')
  if (!vector.installation.bound) return refused('INSTALLATION_NOT_BOUND')
  const tokenRefusal = runTokenRefusal(vector, schemaNamed)
  if (tokenRefusal !== null) return refused(tokenRefusal)
  const statement = credentialStatement(vector)
  return vector.write === 'attestation'
    ? attestationAnswer(statement, vector.held)
    : spendAnswer(statement, vector.held)
}

function pullRequestOf(run) {
  if (run.event_name !== 'pull_request') return undefined
  return /^refs\/pull\/([1-9][0-9]*)\/merge$/.exec(run.ref)?.[1]
}

const STATED_KEY = /"((?:[^"\\]|\\.)*)"\s*:/g

function namesAKeptKeyTwice(cell) {
  const kept = [...cell.matchAll(STATED_KEY)]
    .map(([, key]) => key)
    .filter((key) => key.startsWith('costroid/'))
  return new Set(kept).size !== kept.length
}

function ingestAnswer({ run, rows }) {
  const cells = rows.map((row) => (typeof row === 'string' ? row : JSON.stringify(row)))
  const tags = cells.map((cell) => JSON.parse(cell))
  if (tags.some((row) => 'costroid/origin' in row)) return refused('ROW_ORIGIN_REFUSED')
  const verified = tags.filter((row) => row['costroid/run_identity'] === 'token_verified')
  if (cells.some(namesAKeptKeyTwice)) return refused('UNPARSEABLE_FILE')
  if (verified.length > 0 && run === null) return refused('RUN_TOKEN_MISSING')
  if (run === null) return { refusal: null, effect: 'ingested' }
  const repo = `github.com/${run.repository}`.toLowerCase()
  const pullRequest = pullRequestOf(run)
  const mismatch = verified.some(
    (row) =>
      row['costroid/workflow_run_id'] !== run.run_id ||
      row['costroid/repo'] !== repo ||
      (pullRequest !== undefined && row['costroid/pr'] !== pullRequest),
  )
  return mismatch ? refused('ROW_IDENTITY_MISMATCH') : { refusal: null, effect: 'ingested' }
}

function restatementAnswer({ held, run }) {
  const sameRun =
    run !== null &&
    held.run !== null &&
    run.repository.toLowerCase() === held.run.repository.toLowerCase() &&
    sameStrings(run, held.run, ['run_id', 'run_attempt'])
  return !held.token_verified || sameRun
    ? { refusal: null, effect: 'restated' }
    : refused('EXPORT_BATCH_RUN_BOUND')
}

const CASE_RULES = new Map([
  ['BindingCase', bindingAnswer],
  ['CredentialCase', credentialAnswer],
  ['RestatementCase', restatementAnswer],
  ['IngestCase', ingestAnswer],
])

function caseProblems(rule, vector, schemaNamed) {
  const answer = rule(vector, schemaNamed)
  if (answer.refusal !== vector.refusal || answer.effect !== vector.effect)
    throw new Error(
      `the rules answer ${answer.refusal ?? answer.effect}, the example states ${vector.refusal ?? vector.effect}`,
    )
  return answer.refusal === null ? [] : [answer.refusal]
}

const describeErrors = (errors) =>
  errors
    .slice(0, 3)
    .map((error) => `${error.instancePath || '/'} ${error.message}`)
    .join('; ')

function problemsWith(validate, path, contract, requestIds, schemaNamed) {
  const problems = []
  const rule = CASE_RULES.get(basename(path).split('.')[0])
  for (const [index, instance] of instancesOf(path).entries()) {
    if (!validate(instance)) problems.push(`item ${index + 1}: ${describeErrors(validate.errors)}`)
    else if (contract === 'focus-row')
      problems.push(
        ...focusRowProblems(instance, requestIds).map((problem) => `item ${index + 1}: ${problem}`),
      )
    else if (rule !== undefined)
      problems.push(
        ...caseProblems(rule, instance, schemaNamed).map((code) => `item ${index + 1}: ${code}`),
      )
  }
  return problems
}

function checkExamples(directory, validatorFor, schemaNamed) {
  const contract = basename(dirname(directory))
  const requestIds =
    contract === 'focus-row' ? readJson(join(directory, 'examples-request-ids.json')) : undefined
  const accepted = exampleFiles(join(directory, 'examples'))
  if (accepted.length === 0) report(directory, 'no examples')
  for (const path of accepted) {
    try {
      const problems = problemsWith(validatorFor(path), path, contract, requestIds, schemaNamed)
      if (problems.length > 0) report(path, problems.join(' | '))
      else pass(path, 'accepted')
    } catch (error) {
      report(path, error.message)
    }
  }
  for (const path of exampleFiles(join(directory, 'examples', 'rejected'))) {
    try {
      const problems = problemsWith(validatorFor(path), path, contract, requestIds, schemaNamed)
      if (problems.length === 0) report(path, 'a rejected example was accepted')
      else pass(path, `rejected: ${problems[0]}`)
    } catch (error) {
      report(path, error.message)
    }
  }
}

function checkOpenApi(path, document) {
  if (!/^3\.1\.\d+$/.test(document.openapi ?? '')) report(path, 'not OpenAPI 3.1')
  const walk = (node) => {
    if (typeof node !== 'object' || node === null) return
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string') checkReference(path, document, value)
      else if (key === 'externalValue') checkExternalValue(path, value)
      else walk(value)
    }
  }
  walk(document)
  for (const [route, operations] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(operations)) {
      if (method !== 'parameters' && typeof operation.operationId !== 'string')
        report(path, `${method} ${route} has no operationId`)
    }
  }
}

function checkReference(path, document, reference) {
  if (reference.startsWith('#/')) {
    const target = reference
      .slice(2)
      .split('/')
      .reduce((node, key) => node?.[key], document)
    if (target === undefined) report(path, `${reference} resolves to nothing`)
  } else if (!existsSync(resolve(dirname(path), reference)))
    report(path, `${reference} names no file`)
}

function checkExternalValue(path, value) {
  if (!existsSync(resolve(dirname(path), value))) report(path, `${value} names no file`)
}

function checkRefusalCoverage(directory, document) {
  const contractText = JSON.stringify(document.paths)
  const rejected = readdirSync(join(directory, 'examples', 'rejected'))
  for (const [name, schema] of Object.entries(document.components.schemas)) {
    if (!name.endsWith('RefusalCode')) continue
    const component = name.slice(0, -'Code'.length)
    for (const code of schema.enum ?? []) {
      const example = join('examples', `${component}.${code}.json`)
      if (!contractText.includes(example))
        report(directory, `${component} ${code} has no example in openapi.json`)
      if (name === 'InstallationRefusalCode' && !rejected.some((file) => file.split('.')[1] === code))
        report(directory, `${code} has no negative example`)
    }
  }
}

const README_CODE_ROW = /^\| `([A-Z][A-Z0-9_]*)` +\| [1-5][0-9]{2} +\| (.+?) +\|$/
const FIRST_VERSION_WORDED_ONCE = [0, 7]

function wordsEachCodeOnce(version) {
  const [major, minor] = version.split('.').map(Number)
  const [firstMajor, firstMinor] = FIRST_VERSION_WORDED_ONCE
  return major > firstMajor || (major === firstMajor && minor >= firstMinor)
}

function descriptionsOf(node) {
  if (typeof node !== 'object' || node === null) return []
  return Object.entries(node).flatMap(([key, value]) =>
    key === 'description' && typeof value === 'string' ? [value] : descriptionsOf(value),
  )
}

const plainMeaning = (cell) => cell.replaceAll('`', '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
const lowerFirst = (text) => text.charAt(0).toLowerCase() + text.slice(1)

function checkCodeWordings(directory, document) {
  if (!wordsEachCodeOnce(document.info.version)) return
  const readme = readFileSync(join(directory, 'README.md'), 'utf8')
  const descriptions = descriptionsOf([document.paths, document.components.responses]).join('\n')
  for (const line of readme.split('\n')) {
    const row = README_CODE_ROW.exec(line)
    if (row === null) continue
    const [, code, cell] = row
    const meaning = plainMeaning(cell)
    const worded = [meaning, lowerFirst(meaning)].some((text) =>
      descriptions.includes(`${code}: ${text}.`),
    )
    if (!worded) report(directory, `${code}: openapi.json does not word it as the README does`)
  }
}

const directories = versionDirectories()
if (directories.length === 0) {
  console.error('FAIL no contract directories')
  process.exit(1)
}

const ajv = new Ajv2020({
  strict: true,
  strictRequired: false,
  allowUnionTypes: true,
  allErrors: true,
})
ajv.addKeyword('components')

const schemaFiles = new Map()
for (const directory of directories) {
  for (const name of readdirSync(directory).filter((entry) => entry.endsWith('.schema.json'))) {
    const path = join(directory, name)
    const schema = readJson(path)
    ajv.addSchema(schema)
    schemaFiles.set(directory, schema.$id)
  }
}

function checkContract(directory) {
  const openApiPath = join(directory, 'openapi.json')
  if (existsSync(openApiPath)) {
    const document = readJson(openApiPath)
    const id = SCHEMA_BASE + relative(ROOT, openApiPath)
    checkOpenApi(openApiPath, document)
    ajv.addSchema({ $id: id, components: { schemas: document.components.schemas } })
    for (const name of Object.keys(document.components.schemas))
      ajv.getSchema(`${id}#/components/schemas/${name}`)
    pass(openApiPath, `${Object.keys(document.components.schemas).length} schemas compiled`)
    const schemaNamed = (component) => ajv.getSchema(`${id}#/components/schemas/${component}`)
    const validatorFor = (path) => {
      const component = basename(path).split('.')[0]
      const validate = schemaNamed(component)
      if (validate === undefined) throw new Error(`no component schema named ${component}`)
      return validate
    }
    checkExamples(directory, validatorFor, schemaNamed)
    checkRefusalCoverage(directory, document)
    checkCodeWordings(directory, document)
  } else {
    const id = schemaFiles.get(directory)
    if (id === undefined) throw new Error('no schema')
    const validate = ajv.getSchema(id)
    pass(join(directory, basename(id)), 'schema compiled')
    checkExamples(directory, () => validate)
  }
}

for (const directory of directories) {
  try {
    checkContract(directory)
  } catch (error) {
    report(directory, error.message)
  }
}

if (failures.length > 0) {
  console.error(`${failures.length} failure(s)`)
  process.exit(1)
}
console.log('all examples match their schemas')
