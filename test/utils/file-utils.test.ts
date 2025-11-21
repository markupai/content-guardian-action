/**
 * Unit tests for file utilities
 */

import { jest } from "@jest/globals";
import * as core from "../mocks/core.js";

// Mock @actions/core
jest.unstable_mockModule("@actions/core", () => core);

const {
  isSupportedFile,
  readFileContent,
  filterSupportedFiles,
  getFileExtension,
  getFileBasename,
} = await import("../../src/utils/file-utils.js");

describe("File Utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("isSupportedFile", () => {
    it("should return true for supported file extensions", () => {
      expect(isSupportedFile("test.md")).toBe(true);
      expect(isSupportedFile("test.txt")).toBe(true);
      expect(isSupportedFile("test.markdown")).toBe(true);
      expect(isSupportedFile("test.dita")).toBe(true);
      expect(isSupportedFile("test.xml")).toBe(true);
    });

    it("should return false for unsupported file extensions", () => {
      expect(isSupportedFile("test.js")).toBe(false);
      expect(isSupportedFile("test.ts")).toBe(false);
      expect(isSupportedFile("test.json")).toBe(false);
      expect(isSupportedFile("test.py")).toBe(false);
    });

    it("should handle case insensitive extensions", () => {
      expect(isSupportedFile("test.MD")).toBe(true);
      expect(isSupportedFile("test.MARKDOWN")).toBe(true);
      expect(isSupportedFile("test.TXT")).toBe(true);
      expect(isSupportedFile("test.DITA")).toBe(true);
      expect(isSupportedFile("test.XML")).toBe(true);
    });

    it("should handle files without extensions", () => {
      expect(isSupportedFile("README")).toBe(false);
    });
  });

  describe("readFileContent", () => {
    it("should read file content successfully", async () => {
      const result = await readFileContent("testdata/markdown/sample-data-1.md");
      expect(typeof result).toBe("string");
    });

    it("should return null and log a warning when readFile() fails", async () => {
      const result = await readFileContent("/nonexistent/file.txt");

      expect(result).toBeNull();
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringMatching(/Failed to read file.*nonexistent.*file\.txt.*ENOENT/),
      );
    });
  });

  describe("filterSupportedFiles", () => {
    it("should filter supported files from mixed list", () => {
      const files = [
        "test.md",
        "script.js",
        "readme.txt",
        "config.json",
        "docs.markdown",
        "guide.dita",
        "content.xml",
      ];

      const result = filterSupportedFiles(files);

      expect(result).toEqual([
        "test.md",
        "readme.txt",
        "docs.markdown",
        "guide.dita",
        "content.xml",
      ]);
    });

    it("should return empty array for no supported files", () => {
      const files = ["script.js", "config.json", "package.json"];

      const result = filterSupportedFiles(files);

      expect(result).toEqual([]);
    });

    it("should return all files if all are supported", () => {
      const files = ["readme.md", "docs.txt", "guide.markdown", "content.dita", "data.xml"];

      const result = filterSupportedFiles(files);

      expect(result).toEqual([
        "readme.md",
        "docs.txt",
        "guide.markdown",
        "content.dita",
        "data.xml",
      ]);
    });

    it("should handle empty array", () => {
      const result = filterSupportedFiles([]);
      expect(result).toEqual([]);
    });

    it("should handle files without extensions", () => {
      const files = ["README", "LICENSE", "CHANGELOG"];

      const result = filterSupportedFiles(files);

      expect(result).toEqual([]);
    });
  });

  describe("getFileExtension", () => {
    it("should return lowercase file extension", () => {
      expect(getFileExtension("test.MD")).toBe(".md");
      expect(getFileExtension("test.TXT")).toBe(".txt");
      expect(getFileExtension("test.MARKDOWN")).toBe(".markdown");
      expect(getFileExtension("test.DITA")).toBe(".dita");
      expect(getFileExtension("test.XML")).toBe(".xml");
    });

    it("should handle files without extensions", () => {
      expect(getFileExtension("README")).toBe("");
    });

    it("should handle files with multiple dots", () => {
      expect(getFileExtension("test.backup.md")).toBe(".md");
      expect(getFileExtension("document.backup.dita")).toBe(".dita");
      expect(getFileExtension("data.backup.xml")).toBe(".xml");
    });
  });

  describe("getFileBasename", () => {
    it("should return file basename", () => {
      expect(getFileBasename("/path/to/test.md")).toBe("test.md");
      expect(getFileBasename("/path/to/README")).toBe("README");
    });

    it("should handle files in root directory", () => {
      expect(getFileBasename("test.txt")).toBe("test.txt");
    });

    it("should handle files with complex paths", () => {
      expect(getFileBasename("/very/deep/nested/path/to/file.md")).toBe("file.md");
      expect(getFileBasename("/docs/topic/content.dita")).toBe("content.dita");
      expect(getFileBasename("/data/schema/document.xml")).toBe("document.xml");
    });
  });
});
