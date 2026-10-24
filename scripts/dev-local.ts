import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", ...process.argv.slice(2)], { stdio: "inherit", env: { ...process.env, API_PROXY_DISABLED: "true" } });
child.on("exit", (code) => { process.exitCode = code || 0; });
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => child.kill(signal));
