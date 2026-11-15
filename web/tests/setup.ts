// Tests always run against the dedicated test database, never the dev one.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://ghoomlo:ghoomlo@localhost:5432/ghoomlo_test";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;
