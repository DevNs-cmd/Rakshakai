-- RAKSHAK — PostgreSQL Initialization Script
-- Runs only on first DB creation via Docker's docker-entrypoint-initdb.d

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS pg_trgm;       -- Fuzzy text search on project names
CREATE EXTENSION IF NOT EXISTS btree_gist;    -- Combined B-tree/GiST indexes

-- Set timezone
SET timezone = 'UTC';

-- Configure PostgreSQL for optimal performance with PostGIS
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '768MB';
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- Verify PostGIS installation
DO $$
BEGIN
    RAISE NOTICE 'PostgreSQL version: %', version();
    RAISE NOTICE 'PostGIS version: %', (SELECT PostGIS_Version());
    RAISE NOTICE 'RAKSHAK database initialized successfully';
END $$;
