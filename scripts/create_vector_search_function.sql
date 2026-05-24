-- Create function for vector similarity search on curriculum
CREATE OR REPLACE FUNCTION search_curriculum(
  query_embedding vector(384),
  similarity_threshold float DEFAULT 0.5,
  match_count int DEFAULT 3
)
RETURNS TABLE (
  id uuid,
  content text,
  subject text,
  chapter text,
  topic text,
  similarity float
) AS $$
  SELECT
    id,
    content,
    subject,
    chapter,
    topic,
    1 - (embedding <=> query_embedding) as similarity
  FROM curriculum_embeddings
  WHERE
    1 - (embedding <=> query_embedding) > similarity_threshold
    AND lower(trim(content)) NOT LIKE 'student question:%'
  ORDER BY similarity DESC
  LIMIT match_count;
$$ LANGUAGE SQL STABLE;

-- Verify function was created
SELECT 'search_curriculum function created successfully!' as status;
