-- Enable Apache AGE extension
CREATE EXTENSION IF NOT EXISTS age;

-- Load AGE into the search path
LOAD 'age';
SET search_path = ag_catalog, "$user", public;

-- Create the knowledge graph for the application
SELECT create_graph('knowledge_graph');
