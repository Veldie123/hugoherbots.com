ALTER TABLE rag_documents
ADD COLUMN IF NOT EXISTS word_timestamps JSONB DEFAULT NULL;

COMMENT ON COLUMN rag_documents.word_timestamps IS 'Word-level timestamps from ElevenLabs STT. Array of {word, start, end} objects for technique shorts.';
