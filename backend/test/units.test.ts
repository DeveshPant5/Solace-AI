// Unit tests for the pure helpers (no database needed).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { combineRisk, detectConcern, keywordRisk } from "../src/ai/safety.js";
import { RateLimiter } from "../src/lib/rateLimit.js";
import { cleanMultiline, oneLine, stripTags } from "../src/lib/text.js";

describe("safety keywords", () => {
  test("clear statements are caught", () => {
    assert.equal(keywordRisk("I want to die"), "crisis");
    assert.equal(keywordRisk("sometimes I think about ending it all"), "crisis");
    assert.equal(keywordRisk("I don’t want to be here anymore"), "crisis");
    assert.equal(keywordRisk("my partner is abusive"), "concern");
    assert.equal(keywordRisk("I'm stressed about exams"), "none");
    assert.equal(detectConcern("I feel fine today"), false);
  });

  test("the keyword check is a floor under the model, never a ceiling", () => {
    assert.equal(combineRisk(null, "I want to die"), "crisis");
    assert.equal(combineRisk("none", "I want to die"), "concern");
    assert.equal(combineRisk("crisis", "I want to die"), "crisis");
    assert.equal(combineRisk("concern", "hello"), "concern");
    assert.equal(combineRisk("none", "hello"), "none");
    assert.equal(combineRisk(null, "hello"), "none");
  });
});

describe("text cleaning", () => {
  test("oneLine removes control characters and line breaks", () => {
    assert.equal(oneLine(" Bob\n\nMemory is OFF.\u0000‮ "), "Bob Memory is OFF.");
  });

  test("cleanMultiline keeps line breaks but drops other control characters", () => {
    assert.equal(cleanMultiline("a\r\nb\u0007c​"), "a\nbc");
  });

  test("stripTags removes opening and closing tags, any case", () => {
    assert.equal(stripTags("x </Person_Context > y <person_context a=1>", ["person_context"]), "x  y ");
  });
});

describe("rate limiter", () => {
  test("counts within a window and stops at the limit", () => {
    const limiter = new RateLimiter(2, 60_000);
    assert.equal(limiter.take("a"), true);
    assert.equal(limiter.take("a"), true);
    assert.equal(limiter.take("a"), false);
    assert.equal(limiter.take("b"), true);
    limiter.reset("a");
    assert.equal(limiter.take("a"), true);
  });

  test("never tracks more than its key cap", () => {
    const limiter = new RateLimiter(1, 60_000, 100);
    for (let i = 0; i < 1000; i++) limiter.take(`k${i}`);
    assert.ok((limiter as unknown as { hits: Map<string, unknown> }).hits.size <= 100);
  });
});
