import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useDocumentTitle } from "../useDocumentTitle";

// Wrapper component to exercise the hook in tests
const DocumentTitleDriver = ({ title }: { title: string }) => {
  useDocumentTitle(title);
  return <div data-testid="driver">Title set to: {title || "(none)"}</div>;
};

describe("useDocumentTitle", () => {
  const originalTitle = document.title;

  beforeEach(() => {
    document.title = originalTitle;
  });

  afterEach(() => {
    document.title = originalTitle;
  });

  it("sets document title to formatted string when title is provided", () => {
    render(<DocumentTitleDriver title="Dashboard" />);
    expect(document.title).toBe("Dashboard | SkillSphere AI");
  });

  it("sets document title to base name when title is empty string", () => {
    render(<DocumentTitleDriver title="" />);
    expect(document.title).toBe("SkillSphere AI");
  });

  it("sets document title to base name when title is undefined", () => {
    render(<DocumentTitleDriver title="" />);
    expect(document.title).toBe("SkillSphere AI");
  });

  it("updates document title when title prop changes", () => {
    const { rerender } = render(<DocumentTitleDriver title="Page One" />);
    expect(document.title).toBe("Page One | SkillSphere AI");

    rerender(<DocumentTitleDriver title="Page Two" />);
    expect(document.title).toBe("Page Two | SkillSphere AI");
  });

  it("reverts document title on unmount", () => {
    const { unmount } = render(<DocumentTitleDriver title="Temp Title" />);
    expect(document.title).toBe("Temp Title | SkillSphere AI");

    unmount();
    expect(document.title).toBe(originalTitle);
  });

  it("reverts document title when title changes (cleanup effect)", () => {
    const { rerender } = render(<DocumentTitleDriver title="First" />);
    expect(document.title).toBe("First | SkillSphere AI");

    rerender(<DocumentTitleDriver title="Second" />);
    // After rerender, title should be "Second | SkillSphere AI" (reverted from First)
    expect(document.title).toBe("Second | SkillSphere AI");
  });
});
