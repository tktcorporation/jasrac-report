import { describe, expect, it } from "vitest";
import { normalizeHeader } from "../tsv-utilities";

describe("normalizeHeader", () => {
  it("前後の空白を除去する", () => {
    expect(normalizeHeader("  タイトル  ")).toBe("タイトル");
  });

  it("大文字を小文字に変換する", () => {
    expect(normalizeHeader("ABC")).toBe("abc");
  });

  it("途中の空白を除去する", () => {
    expect(normalizeHeader("作 品 コード")).toBe("作品コード");
  });

  it("全角文字はそのまま保持される", () => {
    expect(normalizeHeader("ＪＡＳＲＡＣ作品コード")).toBe("ｊａｓｒａｃ作品コード");
  });

  it("空文字列はそのまま返す", () => {
    expect(normalizeHeader("")).toBe("");
  });

  it("タブや改行も除去される", () => {
    expect(normalizeHeader("ヘッダー\t名\n")).toBe("ヘッダー名");
  });
});
