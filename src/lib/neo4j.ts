import neo4j, { type Driver } from 'neo4j-driver'

let driver: Driver | null = null

export function isNeo4jConfigured() {
  return Boolean(process.env.NEO4J_URI && process.env.NEO4J_USERNAME && process.env.NEO4J_PASSWORD)
}

export function getNeo4jDriver() {
  if (!isNeo4jConfigured()) return null
  if (!driver) {
    driver = neo4j.driver(
      process.env.NEO4J_URI!,
      neo4j.auth.basic(process.env.NEO4J_USERNAME!, process.env.NEO4J_PASSWORD!)
    )
  }
  return driver
}

export async function closeNeo4jDriver() {
  if (!driver) return
  await driver.close()
  driver = null
}
