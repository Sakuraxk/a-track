-- Enable pgvector extension for vector embeddings (AI features)
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pg_trgm for text search optimization
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable btree_gin for composite indexes
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Create a comment for documentation
COMMENT ON EXTENSION vector IS 'Vector similarity search for AI embeddings';
