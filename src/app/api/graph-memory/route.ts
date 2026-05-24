import { NextRequest, NextResponse } from 'next/server'
import { getNeo4jDriver, isNeo4jConfigured } from '@/lib/neo4j'

function cleanText(value: unknown, max = 4000) {
  return String(value || '').trim().slice(0, max)
}

function questionId(question: string, subject: string) {
  return `${subject}:${question}`.toLowerCase()
}

export async function POST(req: NextRequest) {
  if (!isNeo4jConfigured()) {
    return NextResponse.json({ stored: false, skipped: true, reason: 'Neo4j env missing' })
  }

  const driver = getNeo4jDriver()
  if (!driver) {
    return NextResponse.json({ stored: false, skipped: true, reason: 'Neo4j driver unavailable' })
  }

  const session = driver.session({ database: process.env.NEO4J_DATABASE || 'neo4j' })

  try {
    const body = await req.json()
    const question = cleanText(body.question, 1000)
    const answer = cleanText(body.answer, 3000)
    const subject = cleanText(body.subject, 80) || 'unknown'
    const source = cleanText(body.source, 80) || 'voicepandita'
    const graphPath = Array.isArray(body.graphPath)
      ? body.graphPath.map((part: unknown) => cleanText(part, 120)).filter(Boolean).slice(0, 8)
      : []

    if (!question) {
      return NextResponse.json({ error: 'Question required' }, { status: 400 })
    }

    const qid = questionId(question, subject)
    const answerId = `${qid}:answer`

    await session.executeWrite(tx =>
      tx.run(
        `
        MERGE (q:Question {id: $qid})
        SET q.text = $question,
            q.subject = $subject,
            q.updatedAt = datetime(),
            q.createdAt = coalesce(q.createdAt, datetime())

        MERGE (a:Answer {id: $answerId})
        SET a.text = $answer,
            a.source = $source,
            a.updatedAt = datetime(),
            a.createdAt = coalesce(a.createdAt, datetime())

        MERGE (q)-[:ANSWERED_BY]->(a)

        WITH q
        UNWIND range(0, size($graphPath) - 1) AS idx
        WITH q, idx, $graphPath[idx] AS name, $graphPath AS path
        MERGE (c:Concept {name: name})
        SET c.subject = coalesce(c.subject, $subject),
            c.updatedAt = datetime(),
            c.createdAt = coalesce(c.createdAt, datetime())
        MERGE (q)-[:ABOUT]->(c)
        WITH idx, c, path
        WHERE idx > 0
        MATCH (parent:Concept {name: path[idx - 1]})
        MERGE (parent)-[:HAS_CHILD]->(c)
        `,
        { qid, answerId, question, answer, subject, source, graphPath }
      )
    )

    console.info('[GraphDB] Stored question graph in Neo4j:', { qid, subject, graphPath })
    return NextResponse.json({ stored: true, qid, graphPath })
  } catch (err) {
    console.error('/api/graph-memory error:', err)
    return NextResponse.json(
      { stored: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  } finally {
    await session.close()
  }
}
