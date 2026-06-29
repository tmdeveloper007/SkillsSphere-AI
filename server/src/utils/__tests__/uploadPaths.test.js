import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { resolveUploadPath, buildAvatarFileUrl, buildResumeFileUrl } from "../uploadPaths.js";

describe("resolveUploadPath", () => {
  test("returns null for null or undefined filename", () => {
    assert.equal(resolveUploadPath("avatars", null), null);
    assert.equal(resolveUploadPath("avatars", undefined), null);
  });

  test("returns null for non-string filename", () => {
    assert.equal(resolveUploadPath("avatars", 123), null);
    assert.equal(resolveUploadPath("avatars", {}), null);
  });

  test("returns null for filename with path traversal sequences", () => {
    assert.equal(resolveUploadPath("avatars", "..\\evil"), null);
    assert.equal(resolveUploadPath("avatars", "../evil"), null);
    assert.equal(resolveUploadPath("avatars", "ev/il"), null);
    assert.equal(resolveUploadPath("avatars", "ev\\il"), null);
  });

  test("returns null for filename with double dots", () => {
    assert.equal(resolveUploadPath("resumes", "..%2F..%2Fetc%2Fpasswd"), null);
    assert.equal(resolveUploadPath("avatars", "file.txt.."), null);
  });

  test("returns safe path for valid avatar filename", () => {
    const result = resolveUploadPath("avatars", "user-avatar.png");
    assert.notEqual(result, null);
    assert.equal(result.safeName, "user-avatar.png");
    assert.ok(result.absolutePath.endsWith("uploads/avatars/user-avatar.png"));
  });

  test("returns safe path for valid resume filename", () => {
    const result = resolveUploadPath("resumes", "john-doe-resume.pdf");
    assert.notEqual(result, null);
    assert.equal(result.safeName, "john-doe-resume.pdf");
    assert.ok(result.absolutePath.endsWith("uploads/john-doe-resume.pdf"));
  });

  test("filename with forward slash is rejected", () => {
    // Paths with slashes are blocked at input validation, not at basename
    assert.equal(resolveUploadPath("avatars", "path/to/avatar.jpg"), null);
  });

  test("filename with backslash is rejected", () => {
    assert.equal(resolveUploadPath("avatars", "path\\to\\avatar.jpg"), null);
  });

  test("returns safe path for simple filename without slashes or dots-dot", () => {
    const result = resolveUploadPath("avatars", "my-avatar.png");
    assert.notEqual(result, null);
    assert.equal(result.safeName, "my-avatar.png");
  });

  test("resolved path is inside uploads directory (no traversal escape)", () => {
    const result = resolveUploadPath("avatars", "normal.png");
    assert.notEqual(result, null);
    assert.ok(result.absolutePath.includes("uploads"), "Path should be inside uploads directory");
    // Ensure path does not escape uploads root
    assert.ok(!result.absolutePath.includes(".."), "Path should not contain traversal sequences");
  });

  test("unknown subdir defaults to resumes directory", () => {
    const result = resolveUploadPath("unknown", "file.pdf");
    assert.notEqual(result, null);
    assert.ok(result.absolutePath.includes("uploads"), "Should use resumes dir for unknown subdir");
  });
});

describe("buildAvatarFileUrl", () => {
  test("builds correct avatar file URL", () => {
    const url = buildAvatarFileUrl("user-123.png");
    assert.equal(url, "/api/files/avatars/user-123.png");
  });

  test("handles various filename formats", () => {
    assert.equal(buildAvatarFileUrl("avatar.jpg"), "/api/files/avatars/avatar.jpg");
    assert.equal(buildAvatarFileUrl("user_avatar.webp"), "/api/files/avatars/user_avatar.webp");
  });
});

describe("buildResumeFileUrl", () => {
  test("builds correct resume file URL", () => {
    const url = buildResumeFileUrl("resume-2024.pdf");
    assert.equal(url, "/api/files/resumes/resume-2024.pdf");
  });

  test("handles spaces and special characters in filename", () => {
    const url = buildResumeFileUrl("John Doe - Resume.pdf");
    assert.equal(url, "/api/files/resumes/John Doe - Resume.pdf");
  });
});
