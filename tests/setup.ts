process.env.APP_ENV = process.env.APP_ENV ?? "test";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://eropub:eropub_dev@localhost:5432/eropub_ci";
process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? "test-secret-test-secret-test-secret-123";
process.env.DATA_ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY ?? "dGVzdC1rZXktdGVzdC1rZXktdGVzdC1rZXktMTIzNDU=";
process.env.ENABLE_TEST_ADAPTERS = "true";
