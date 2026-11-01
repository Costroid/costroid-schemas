#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const VERSION_DIRECTORY = /^v\d+\.\d+$/
const SCHEMA_BASE = 'https://raw.githubusercontent.com/Costroid/costroid-schemas/main/'

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

const describeErrors = (errors) =>
  errors
    .slice(0, 3)
    .map((error) => `${error.instancePath || '/'} ${error.message}`)
    .join('; ')

function problemsWith(validate, path, contract, requestIds) {
  const problems = []
  for (const [index, instance] of instancesOf(path).entries()) {
    if (!validate(instance)) problems.push(`item ${index + 1}: ${describeErrors(validate.errors)}`)
    else if (contract === 'focus-row')
      problems.push(
        ...focusRowProblems(instance, requestIds).map((problem) => `item ${index + 1}: ${problem}`),
      )
  }
  return problems
}

function checkExamples(directory, validatorFor) {
  const contract = basename(dirname(directory))
  const requestIds =
    contract === 'focus-row' ? readJson(join(directory, 'examples-request-ids.json')) : undefined
  const accepted = exampleFiles(join(directory, 'examples'))
  if (accepted.length === 0) report(directory, 'no examples')
  for (const path of accepted) {
    try {
      const problems = problemsWith(validatorFor(path), path, contract, requestIds)
      if (problems.length > 0) report(path, problems.join(' | '))
      else pass(path, 'accepted')
    } catch (error) {
      report(path, error.message)
    }
  }
  for (const path of exampleFiles(join(directory, 'examples', 'rejected'))) {
    try {
      const problems = problemsWith(validatorFor(path), path, contract, requestIds)
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
    checkExamples(directory, (path) => {
      const component = basename(path).split('.')[0]
      const validate = ajv.getSchema(`${id}#/components/schemas/${component}`)
      if (validate === undefined) throw new Error(`no component schema named ${component}`)
      return validate
    })
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
