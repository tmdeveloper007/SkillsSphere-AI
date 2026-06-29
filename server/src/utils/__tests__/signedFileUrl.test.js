import { describe, test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { normalizeProtectedFilePath, buildSignedFileUrl, verifySignedFileUrl } from "../signedFileUrl.js";

describe("normalizeProtectedFilePath", () => {
  test("returns null for non-string input", () => {
    assert.equal(normalizeProtectedFilePath(null), null);
    assert.equal(normalizeProtectedFilePath(undefined), null);
    assert.equal(normalizeProtectedFilePath(123), null);
  });

  test("returns null for empty string", () => {
    assert.equal(normalizeProtectedFilePath(""), null);
  });

  test("returns null for path without required prefix", () => {
    assert.equal(normalizeProtectedFilePath("/api/other/file.txt"), null);
    assert.equal(normalizeProtectedFilePath("/public/file.txt"), null);
  });

  test("returns normalized path for valid avatar URL", () => {
    const result = normalizeProtectedFilePath("/api/files/avatars/user123.png");
    assert.equal(result, "/api/files/avatars/user123.png");
  });

  test("returns normalized path for valid resume URL", () => {
    const result = normalizeProtectedFilePath("/api/files/resumes/resume123.pdf");
    assert.equal(result, "/api/files/resumes/resume123.pdf");
  });

  test("extracts filename from full uploads URL", () => {
    const result = normalizeProtectedFilePath("/uploads/avatars/avatar456.jpg");
    assert.equal(result, "/api/files/avatars/avatar456.jpg");
  });

  test("extracts filename from full uploads resumes URL", () => {
    const result = normalizeProtectedFilePath("/uploads/resume789.pdf");
    assert.equal(result, "/api/files/resumes/resume789.pdf");
  });

  test("strips query parameters before processing", () => {
    const result = normalizeProtectedFilePath("/api/files/avatars/img.png?exp=123&sig=abc");
    assert.equal(result, "/api/files/avatars/img.png");
  });

  test("extracts path from full HTTP URL", () => {
    const result = normalizeProtectedFilePath("https://example.com/api/files/avatars/test.jpg");
    assert.equal(result, "/api/files/avatars/test.jpg");
  });

  test("returns null for URLs pointing outside protected paths", () => {
    assert.equal(normalizeProtectedFilePath("/api/files/avatars"), null);
    assert.equal(normalizeProtectedFilePath("/api/files/"), null);
    assert.equal(normalizeProtectedFilePath("/api/files"), null);
  });
});

describe("buildSignedFileUrl", () => {
  const originalEnv = process.env.FILE_URL_SIGNING_SECRET;

  beforeEach(() => {
    process.env.FILE_URL_SIGNING_SECRET = "this-is-a-test-secret-key-at-least-32-chars";
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.FILE_URL_SIGNING_SECRET = originalEnv;
    } else {
      delete process.env.FILE_URL_SIGNING_SECRET;
    }
  });

  test("builds URL with exp and sig query params", () => {
    const url = buildSignedFileUrl({
      path: "/api/files/avatars/user.png",
      expiresAt: 1700000000,
    });
    assert.ok(url.includes("/api/files/avatars/user.png"));
    assert.ok(url.includes("exp=1700000000"));
    assert.ok(url.includes("sig="));
  });

  test("builds URL with extra uid param when extra is provided", () => {
    const url = buildSignedFileUrl({
      path: "/api/files/resumes/doc.pdf",
      expiresAt: 1700000000,
      extra: "user-42",
    });
    assert.ok(url.includes("uid=user-42"));
    assert.ok(url.includes("sig="));
  });

  test("uses correct separator based on existing query string", () => {
    const url = buildSignedFileUrl({
      path: "/api/files/avatars/user.png?lang=en",
      expiresAt: 1700000000,
    });
    assert.ok(url.includes("&exp="));
    assert.ok(url.includes("&sig="));
  });

  test("throws when secret is not set", () => {
    delete process.env.FILE_URL_SIGNING_SECRET;
    assert.throws(
      () => buildSignedFileUrl({ path: "/api/files/avatars/user.png", expiresAt: 1700000000 }),
      /FILE_URL_SIGNING_SECRET must be set/
    );
  });

  test("throws when secret is too short", () => {
    process.env.FILE_URL_SIGNING_SECRET = "short";
    assert.throws(
      () => buildSignedFileUrl({ path: "/api/files/avatars/user.png", expiresAt: 1700000000 }),
      /FILE_URL_SIGNING_SECRET must be set and at least 32 characters/
    );
  });
});

describe("verifySignedFileUrl", () => {
  const originalEnv = process.env.FILE_URL_SIGNING_SECRET;

  beforeEach(() => {
    process.env.FILE_URL_SIGNING_SECRET = "this-is-a-test-secret-key-at-least-32-chars";
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.FILE_URL_SIGNING_SECRET = originalEnv;
    } else {
      delete process.env.FILE_URL_SIGNING_SECRET;
    }
  });

  test("returns false for null or undefined inputs", () => {
    assert.equal(verifySignedFileUrl(null, "1700000000", "sig"), false);
    assert.equal(verifySignedFileUrl(undefined, "1700000000", "sig"), false);
  });

  test("returns false for invalid path", () => {
    assert.equal(verifySignedFileUrl("/invalid/path", "1700000000", "sig"), false);
  });

  test("returns false for empty signature", () => {
    const url = buildSignedFileUrl({
      path: "/api/files/avatars/user.png",
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });
    const parsed = new URL(url, "http://localhost");
    const exp = parsed.searchParams.get("exp");
    const sig = parsed.searchParams.get("sig");
    assert.equal(verifySignedFileUrl("/api/files/avatars/user.png", exp, ""), false);
    assert.equal(verifySignedFileUrl("/api/files/avatars/user.png", exp, null), false);
  });

  test("returns false for expired timestamp", () => {
    const expiredUrl = buildSignedFileUrl({
      path: "/api/files/avatars/user.png",
      expiresAt: Math.floor(Date.now() / 1000) - 3600,
    });
    const parsed = new URL(expiredUrl, "http://localhost");
    const exp = parsed.searchParams.get("exp");
    const sig = parsed.searchParams.get("sig");
    assert.equal(verifySignedFileUrl("/api/files/avatars/user.png", exp, sig), false);
  });

  test("returns false for non-numeric expiry", () => {
    assert.equal(verifySignedFileUrl("/api/files/avatars/user.png", "not-a-number", "sig"), false);
    assert.equal(verifySignedFileUrl("/api/files/avatars/user.png", -1, "sig"), false);
  });

  test("returns true for valid non-expired signature", () => {
    const url = buildSignedFileUrl({
      path: "/api/files/avatars/user.png",
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });
    const parsed = new URL(url, "http://localhost");
    const exp = parsed.searchParams.get("exp");
    const sig = parsed.searchParams.get("sig");
    assert.equal(verifySignedFileUrl("/api/files/avatars/user.png", exp, sig), true);
  });

  test("returns true for valid signature with extra param", () => {
    const url = buildSignedFileUrl({
      path: "/api/files/resumes/doc.pdf",
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      extra: "user-99",
    });
    const parsed = new URL(url, "http://localhost");
    const exp = parsed.searchParams.get("exp");
    const sig = parsed.searchParams.get("sig");
    const uid = parsed.searchParams.get("uid");
    assert.equal(verifySignedFileUrl("/api/files/resumes/doc.pdf", exp, sig, uid), true);
  });

  test("returns false for tampered path", () => {
    const url = buildSignedFileUrl({
      path: "/api/files/avatars/user.png",
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });
    const parsed = new URL(url, "http://localhost");
    const exp = parsed.searchParams.get("exp");
    const sig = parsed.searchParams.get("sig");
    assert.equal(verifySignedFileUrl("/api/files/avatars/evil.png", exp, sig), false);
  });
});
