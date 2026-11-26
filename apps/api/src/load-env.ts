import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMonorepoEnv } from "../../../scripts/load-env";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
loadMonorepoEnv(pkgRoot);
