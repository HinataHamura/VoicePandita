import { NextRequest, NextResponse } from 'next/server'
import { getNeo4jDriver, isNeo4jConfigured } from '@/lib/neo4j'

function cleanText(value: unknown, max = 4000) {
  return String(value || '').trim().slice(0, max)
}

function questionId(question: string, subject: string) {
  return `${subject}:${question}`.toLowerCase()
}

function nodeCaption(value: string, fallback: string) {
  const singleLine = cleanText(value, 180).replace(/\s+/g, ' ')
  return singleLine || fallback
}

function hasBangla(value: string) {
  return /[\u0980-\u09FF]/.test(value)
}

function englishConceptTitle(value: string, question = '') {
  const raw = cleanText(value, 120).replace(/\s+/g, ' ')
  const text = `${raw} ${question}`.toLowerCase()

  if (/(physics|পদার্থ|বল|newton|নিউটন|second law|২য়|দ্বিতীয়|ত্বরণ|force)/i.test(text)) {
    if (/(newton|নিউটন|second law|২য়|দ্বিতীয়)/i.test(text)) return "Newton's Second Law"
    if (/(force|বল|motion|গতি|ত্বরণ)/i.test(text)) return 'Force and Motion'
    return 'Physics'
  }
  if (/(chemistry|রসায়ন|ionic|আয়নিক|ion|bond|বন্ধন|electron|ইলেকট্রন)/i.test(text)) {
    if (/(ionic|আয়নিক|ion|bond|বন্ধন|electron|ইলেকট্রন)/i.test(text)) return 'Ionic Bond'
    return 'Chemistry'
  }
  if (/(biology|জীব|photosynthesis|সালোক|উদ্ভিদ)/i.test(text)) return 'Photosynthesis'
  if (/(math|গণিত|quadratic|দ্বিঘাত|equation|সমীকরণ)/i.test(text)) return 'Quadratic Equation'
  if (/application|প্রয়োগ|ব্যবহার/i.test(text)) return 'Application'
  if (/example|উদাহরণ/i.test(text)) return 'Example'

  if (!hasBangla(raw) && raw) return raw
  return 'Concept'
}

function englishGraphPath(graphPath: string[], question: string, subject: string) {
  const titles = graphPath.map(part => englishConceptTitle(part, question))
  const compact = titles.filter((title, index) => title !== 'Concept' || index === titles.length - 1)
  if (compact.length) return Array.from(new Set(compact))
  return [englishConceptTitle(subject, question), 'Concept']
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
    const cleanGraphPath = englishGraphPath(graphPath, question, subject)
    const mainConcept = cleanGraphPath[cleanGraphPath.length - 1] || englishConceptTitle(subject, question)
    const questionCaption = `Question: ${mainConcept}`
    const answerCaption = `Answer: ${mainConcept}`

    await session.executeWrite(tx =>
      tx.run(
        `
        MERGE (q:Question {id: $qid})
        SET q.text = $question,
            q.name = $questionCaption,
            q.title = $questionCaption,
            q.subject = $subject,
            q.updatedAt = datetime(),
            q.createdAt = coalesce(q.createdAt, datetime())

        MERGE (a:Answer {id: $answerId})
        SET a.text = $answer,
            a.name = $answerCaption,
            a.title = $answerCaption,
            a.source = $source,
            a.updatedAt = datetime(),
            a.createdAt = coalesce(a.createdAt, datetime())

        MERGE (q)-[:ANSWERED_BY]->(a)

        WITH q
        UNWIND range(0, size($cleanGraphPath) - 1) AS idx
        WITH q, idx, $cleanGraphPath[idx] AS name, $cleanGraphPath AS path, $graphPath AS originalPath
        MERGE (c:Concept {name: name})
        SET c.title = name,
            c.text = coalesce(c.text, name),
            c.originalLabel = coalesce(originalPath[idx], name),
            c.subject = coalesce(c.subject, $subject),
            c.updatedAt = datetime(),
            c.createdAt = coalesce(c.createdAt, datetime())
        MERGE (q)-[:ABOUT]->(c)
        WITH idx, c, path
        WHERE idx > 0
        MATCH (parent:Concept {name: path[idx - 1]})
        MERGE (parent)-[:HAS_CHILD]->(c)
        `,
        { qid, answerId, question, answer, questionCaption, answerCaption, subject, source, graphPath, cleanGraphPath }
      )
    )

    console.info('[GraphDB] Stored question graph in Neo4j:', { qid, subject, graphPath: cleanGraphPath })
    return NextResponse.json({ stored: true, qid, graphPath: cleanGraphPath })
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
