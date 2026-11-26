-- Defense in depth: keep the private rate-limit table inaccessible even if schema grants change.
ALTER TABLE private.request_limits ENABLE ROW LEVEL SECURITY;
