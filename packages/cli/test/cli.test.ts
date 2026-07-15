import { test } from "node:test";
import assert from "node:assert/strict";
import { cliVersion, program } from "../src/cli.js";

test("program is named meter and has a version", () => {
  assert.equal(program.name(), "meter");
  assert.match(cliVersion, /^\d+\.\d+\.\d+/);
});
