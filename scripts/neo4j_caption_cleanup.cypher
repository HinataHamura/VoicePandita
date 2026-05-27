// Backfill caption-friendly properties for Neo4j Explore.
// Run this once in Neo4j Browser/Explore after selecting the active database.

MATCH (q:Question)
OPTIONAL MATCH (q)-[:ABOUT]->(qc:Concept)
WITH q, head(collect(qc.name)) AS conceptName
SET q.name = 'Question: ' + coalesce(conceptName, 'Concept'),
    q.title = 'Question: ' + coalesce(conceptName, 'Concept');

MATCH (a:Answer)
OPTIONAL MATCH (q:Question)-[:ANSWERED_BY]->(a)
OPTIONAL MATCH (q)-[:ABOUT]->(ac:Concept)
WITH a, head(collect(ac.name)) AS conceptName
SET a.name = 'Answer: ' + coalesce(conceptName, 'Concept'),
    a.title = 'Answer: ' + coalesce(conceptName, 'Concept');

MATCH (c:Concept)
SET c.title = coalesce(c.name, c.title),
    c.text = coalesce(c.text, c.name);

RETURN 'Neo4j captions backfilled successfully' AS status;
