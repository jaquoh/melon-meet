import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const targetEnv = process.argv.find((arg) => arg.startsWith("--env="))?.slice("--env=".length) ?? "production";

function fail(message) {
  console.error(`Pre-deploy check failed: ${message}`);
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    shell: false,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function readWranglerConfig() {
  try {
    return JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
  } catch (error) {
    fail(`Unable to read wrangler.jsonc: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function validateProductionConfig(config) {
  const productionDb = config.d1_databases?.[0];
  if (!productionDb?.database_id || String(productionDb.database_id).includes("REPLACE_WITH")) {
    fail("production D1 database_id is missing or still a placeholder in wrangler.jsonc");
  }
  if ((config.vars?.ENVIRONMENT_NAME ?? "") !== "production") {
    fail("production ENVIRONMENT_NAME must be set to \"production\"");
  }
}

function validateStagingConfig(config) {
  const stagingEnv = config.env?.staging;
  if (!stagingEnv) {
    fail("staging environment is missing from wrangler.jsonc");
  }

  const stagingDb = stagingEnv.d1_databases?.[0];
  if (!stagingDb?.database_id || String(stagingDb.database_id).includes("REPLACE_WITH")) {
    fail("staging D1 database_id is missing or still a placeholder in wrangler.jsonc");
  }

  if ((stagingEnv.vars?.ENVIRONMENT_NAME ?? "") !== "staging") {
    fail("staging ENVIRONMENT_NAME must be set to \"staging\"");
  }

  const productionDb = config.d1_databases?.[0]?.database_id;
  if (productionDb && productionDb === stagingDb.database_id) {
    fail("staging and production D1 database IDs must not match");
  }
}

const wranglerConfig = readWranglerConfig();

if (targetEnv === "staging") {
  validateStagingConfig(wranglerConfig);
} else if (targetEnv === "production") {
  validateProductionConfig(wranglerConfig);
} else {
  fail(`Unsupported environment "${targetEnv}". Use production or staging.`);
}

run("npm", ["run", "typecheck"]);
run("npm", ["test"]);
run("npm", ["run", "build"]);
