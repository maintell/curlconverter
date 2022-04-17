#!/usr/bin/env node

import {
  curlLongOpts,
  curlShortOpts,
  parseArgs,
  buildRequest,
  parseCurlCommand,
  CCError,
  has,
} from "./util.js";
import type { LongOpts, ShortOpts, Request } from "./util.js";

import { _toAnsible, toAnsibleWarn } from "./generators/ansible.js";
import { _toDart, toDartWarn } from "./generators/dart.js";
import { _toCFML, toCFMLWarn } from "./generators/cfml.js";
import { _toElixir, toElixirWarn } from "./generators/elixir.js";
import { _toGo, toGoWarn } from "./generators/go.js";
import { _toJava, toJavaWarn } from "./generators/java.js";
import {
  _toJavaScript,
  toJavaScriptWarn,
} from "./generators/javascript/javascript.js";
import { _toJsonString, toJsonStringWarn } from "./generators/json.js";
import { _toMATLAB, toMATLABWarn } from "./generators/matlab/matlab.js";
import { _toNode, toNodeWarn } from "./generators/javascript/javascript.js";
import {
  _toNodeRequest,
  toNodeRequestWarn,
} from "./generators/javascript/node-request.js";
import { _toPhp, toPhpWarn } from "./generators/php/php.js";
import {
  _toPhpRequests,
  toPhpRequestsWarn,
} from "./generators/php/php-requests.js";
import { _toPython, toPythonWarn } from "./generators/python.js";
import { _toR, toRWarn } from "./generators/r.js";
import { _toRust, toRustWarn } from "./generators/rust.js";
import { _toStrest, toStrestWarn } from "./generators/strest.js";

import fs from "fs";

// This line is generated by extract_curl_args.py. Do not modify it.
const VERSION = "4.0.0-alpha.10 (curl 7.82.0)";

// sets a default in case --language isn't passed
const defaultLanguage = "python";

// Maps options for --language to functions
// NOTE: make sure to update this when adding language support
const translate: {
  [key: string]: [
    (request: Request) => string,
    (curlCommand: string | string[]) => [string, [string, string][]]
  ];
} = {
  ansible: [_toAnsible, toAnsibleWarn],
  cfml: [_toCFML, toCFMLWarn],
  browser: [_toJavaScript, toJavaScriptWarn], // for backwards compatibility, undocumented
  dart: [_toDart, toDartWarn],
  elixir: [_toElixir, toElixirWarn],
  go: [_toGo, toGoWarn],
  java: [_toJava, toJavaWarn],
  javascript: [_toJavaScript, toJavaScriptWarn],
  json: [_toJsonString, toJsonStringWarn],
  matlab: [_toMATLAB, toMATLABWarn],
  node: [_toNode, toNodeWarn],
  "node-request": [_toNodeRequest, toNodeRequestWarn],
  php: [_toPhp, toPhpWarn],
  "php-requests": [_toPhpRequests, toPhpRequestsWarn],
  python: [_toPython, toPythonWarn],
  r: [_toR, toRWarn],
  rust: [_toRust, toRustWarn],
  strest: [_toStrest, toStrestWarn],
};

const USAGE = `Usage: curlconverter [--language <language>] [-] [curl_options...]

language: the language to convert the curl command to. The choices are
  ansible
  cfml
  dart
  elixir
  go
  java
  javascript
  json
  matlab
  node
  node-request
  php
  php-requests
  python (the default)
  r
  rust
  strest

-: read curl command from stdin

curl_options: these should be passed exactly as they would be passed to curl.
  see 'curl --help' or 'curl --manual' for which options are allowed here`;

const curlConverterLongOpts: LongOpts = {
  language: { type: "string", name: "language" },
  stdin: { type: "bool", name: "stdin" },
};
const curlConverterShortOpts: ShortOpts = {
  // a single - (dash) tells curlconverter to read input from stdin
  "": "stdin",
};
const longOpts: LongOpts = { ...curlLongOpts, ...curlConverterLongOpts };
const shortOpts: ShortOpts = { ...curlShortOpts, ...curlConverterShortOpts };

function exitWithError(error: unknown, verbose = false): never {
  let errMsg: Error | string | unknown = error;
  if (!verbose) {
    if (error instanceof CCError) {
      errMsg = "";
      for (const line of error.message.toString().split("\n")) {
        errMsg += "error: " + line + "\n";
      }
      errMsg = (errMsg as string).trimEnd();
    } else if (error instanceof Error) {
      // .toString() removes the traceback
      errMsg = error.toString();
    }
  }
  console.error(errMsg);
  process.exit(2); // curl exits with 2 so we do too
}

const argv = process.argv.slice(2);
let parsedArguments, warnings;
try {
  [parsedArguments, warnings] = parseArgs(argv, longOpts, shortOpts);
} catch (e) {
  exitWithError(e);
}
if (parsedArguments.help) {
  console.log(USAGE.trim());
  process.exit(0);
}
if (parsedArguments.version) {
  console.log("curlconverter " + VERSION);
  process.exit(0);
}

const argc = Object.keys(parsedArguments).length;
const language = parsedArguments.language || defaultLanguage;
const stdin = parsedArguments.stdin;
if (!has(translate, language)) {
  exitWithError(
    new CCError(
      "unexpected --language: " +
        JSON.stringify(language) +
        "\n" +
        "must be one of: " +
        Object.keys(translate).join(", ")
    ),
    parsedArguments.verbose
  );
}
for (const opt of Object.keys(curlConverterLongOpts)) {
  delete parsedArguments[opt];
}

const [generator, warnGenerator] = translate[language];
let code;
if (argc === 0) {
  console.log(USAGE.trim());
  process.exit(2);
}
if (stdin) {
  // This lets you do
  // echo curl example.com | curlconverter --verbose
  const extraArgs = Object.keys(parsedArguments).filter((a) => a !== "verbose");
  if (extraArgs.length > 0) {
    // Throw an error so that if user typos something like
    // curlconverter - -data
    // they aren't stuck with what looks like a hung terminal.
    const extraArgsStr = extraArgs.map((a) => "--" + a).join(", ");
    exitWithError(
      new CCError(
        "if you pass --stdin or -, you can't also pass " + extraArgsStr
      ),
      parsedArguments.verbose
    );
  }
  const input = fs.readFileSync(0, "utf8");
  try {
    [code, warnings] = warnGenerator(input);
  } catch (e) {
    exitWithError(e, parsedArguments.verbose);
  }
} else {
  let request;
  try {
    request = buildRequest(parsedArguments);
  } catch (e) {
    exitWithError(e, parsedArguments.verbose);
  }
  // Warning for users using the pre-4.0 CLI
  if (request.url?.startsWith("curl ")) {
    console.error(
      "warning: Passing a whole curl command as a single argument?"
    );
    console.error(
      "warning: Pass options to curlconverter as if it was curl instead:"
    );
    console.error(
      "warning: curlconverter 'curl example.com' -> curlconverter example.com"
    );
  }
  try {
    code = generator(request);
  } catch (e) {
    exitWithError(e, parsedArguments.verbose);
  }
}

if (warnings && parsedArguments.verbose) {
  for (const w of warnings) {
    console.error("warning: " + w[1]);
  }
}
process.stdout.write(code);
