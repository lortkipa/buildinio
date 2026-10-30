#!/usr/bin/env node
// Gets Buildinio ready to run: checks Node.js, makes .env.local from .env.example,
// asks for the OpenAI key and where the AI's commands run, and installs what it needs.
// Only Node's own modules, so it works before `npm install`.
//
//   npm run setup                         ask, then install
//   node scripts/setup.mjs --hosting      ask only (scripts/host.sh installs and builds)
//   node scripts/setup.mjs get KEY        print a value from .env.local
//   node scripts/setup.mjs set KEY=VALUE  change values in .env.local

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV = path.join(ROOT, ".env.local");
const EXAMPLE = path.join(ROOT, ".env.example");
const MIN_NODE = 22;

const [command, ...rest] = process.argv.slice(2);
if (command === "get") {
  console.log(readEnv(rest[0]) ?? "");
} else if (command === "set") {
  ensureEnvFile();
  for (const pair of rest) {
    const at = pair.indexOf("=");
    if (at < 1) fail(`Not KEY=VALUE: ${pair}`);
    writeEnv(pair.slice(0, at), pair.slice(at + 1));
  }
} else {
  await setup({ hosting: command === "--hosting" });
}

async function setup({ hosting }) {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < MIN_NODE) {
    fail(`Buildinio needs Node.js ${MIN_NODE} or newer, and this is ${process.versions.node}. Get it from https://nodejs.org (the LTS button).`);
  }

  console.log("\nSetting up Buildinio. Press Enter to keep what's in [brackets].\n");
  if (ensureEnvFile()) console.log("Made .env.local, where your settings are kept.\n");
  const rl = createInterface({ input: process.stdin });
  const lines = rl[Symbol.asyncIterator]();
  const ask = async (question) => {
    process.stdout.write(question);
    return ((await lines.next()).value ?? "").trim();
  };

  // The AI.
  console.log("The AI that builds the apps is an OpenAI model. Get a key at https://platform.openai.com/api-keys");
  const key = readEnv("OPENAI_API_KEY");
  const newKey = await ask(`OpenAI API key ${key ? `[${mask(key)}]` : "(Enter to skip for now)"}: `);
  if (newKey) writeEnv("OPENAI_API_KEY", newKey);
  const model = readEnv("OPENAI_MODEL") || "gpt-6-luna";
  writeEnv("OPENAI_MODEL", (await ask(`Model [${model}]: `)) || model);

  // Where the AI's commands run.
  const docker = hosting || hasDocker();
  const current = readEnv("SANDBOX") || "docker";
  console.log(
    "\nThe AI runs npm and other commands to build each app. They can run:\n" +
      `  1. In Docker: a throwaway box that only sees the app's own folder. Safer.${docker ? "" : " (Docker isn't running here: get it at https://docs.docker.com/get-docker/)"}${hosting ? " Installed for you." : ""}\n` +
      "  2. Straight on this computer: nothing more to install, but the AI's code can reach your files.",
  );
  const fallback = current === "host" ? "2" : docker ? "1" : "2";
  const sandbox = (await ask(`1 or 2 [${fallback}]: `)) || fallback;
  writeEnv("SANDBOX", sandbox === "2" ? "host" : "docker");
  rl.close();

  if (hosting) return;

  if (!existsSync(path.join(ROOT, "node_modules"))) {
    console.log("\nInstalling what Buildinio needs (a minute or two)…\n");
    const install = spawnSync("npm", ["install", "--no-audit", "--no-fund"], { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" });
    if (install.status !== 0) fail("npm install didn't work. The lines above say why.");
  }

  console.log(
    "\nAll set. Start Buildinio with:\n\n    npm run dev\n\nthen open http://localhost:3000 in your browser." +
      (readEnv("OPENAI_API_KEY") ? "" : "\nThe AI stays off until you add your OpenAI key: run `npm run setup` again.") +
      "\nSign-in with Google, GitHub and real emails is optional: see the README.\n",
  );
}

/** Makes .env.local from .env.example if it's missing. True if it did. */
function ensureEnvFile() {
  if (existsSync(ENV)) return false;
  copyFileSync(EXAMPLE, ENV);
  return true;
}

function readEnv(key) {
  if (!existsSync(ENV)) return undefined;
  const line = readFileSync(ENV, "utf8").match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!line) return undefined;
  const value = line[1].trim();
  return /^".*"$/.test(value) ? value.slice(1, -1).replaceAll("\\$", "$") : value;
}

/** Sets KEY in .env.local, in its place if it's there (keeping the comments), or at the end. */
function writeEnv(key, value) {
  if (!/^[A-Z][A-Z0-9_]*$/.test(key)) fail(`Not a setting's name: ${key}`);
  if (/[\r\n"\\]/.test(value)) fail(`${key} can't have line breaks, quotes or backslashes.`);
  // Quoted when it has spaces, # or $ (which Next.js would expand), like "Buildinio <hi@example.com>".
  const written = /[\s#$']/.test(value) ? `"${value.replaceAll("$", "\\$")}"` : value;
  const text = readFileSync(ENV, "utf8");
  const line = new RegExp(`^${key}=.*$`, "m");
  const next = line.test(text) ? text.replace(line, () => `${key}=${written}`) : `${text.replace(/\n?$/, "\n")}${key}=${written}\n`;
  writeFileSync(ENV, next);
}

function hasDocker() {
  return spawnSync("docker", ["info"], { stdio: "ignore" }).status === 0;
}

function mask(value) {
  return value.length > 10 ? `${value.slice(0, 6)}…${value.slice(-4)}` : "set";
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}
