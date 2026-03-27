import { describe, expect, it } from "vitest";
import type { JasracInfo } from "../jasrac-types";
import { convertToTsv } from "../jasrac-bridge";

/** テスト用の最小限の JasracInfo を作るヘルパー */
function makeJasracInfo(overrides: Partial<JasracInfo> = {}): JasracInfo {
  return {
    workCode: "123-4567-8",
    title: "テスト曲",
    lyricist: "作詞太郎",
    composer: "作曲花子",
    artist: "歌手一郎",
    arranger: "編曲次郎",
    duration: "",
    workType: "",
    nationality: "",
    creationDate: "",
    rightsInfo: [],
    usageCategory: "",
    publisher: "",
    usagePermissions: {
      performance: { concert: false, bgm: false, karaoke: false },
      reproduction: {
        recording: false,
        publication: false,
        rental: false,
        video: false,
        movie: false,
      },
      transmission: { broadcast: false, distribution: false, karaoke_comm: false },
      advertisement: {
        cm: false,
        movie_ad: false,
        recording_ad: false,
        video_ad: false,
        publication_ad: false,
      },
      game: { recording_game: false, video_game: false },
      managementDetails: {},
    },
    rawHtml: "",
    ...overrides,
  };
}

describe("convertToTsv", () => {
  it("ヘッダー行が正しく出力される", () => {
    const result = convertToTsv([]);
    const headers = result.split("\n")[0].split("\t");
    expect(headers[0]).toBe("インターフェイスキーコード");
    expect(headers[6]).toBe("ＪＡＳＲＡＣ作品コード");
    expect(headers).toHaveLength(19);
  });

  it("1件のデータが正しくTSV行に変換される", () => {
    const info = makeJasracInfo({
      workCode: "123-4567-8",
      title: "Butter-Fly",
      lyricist: "千綿偉功",
      composer: "千綿偉功",
      artist: "和田光司",
      arranger: "渡部チェル",
    });
    const result = convertToTsv([info]);
    const lines = result.split("\n");
    expect(lines).toHaveLength(2);

    const cols = lines[1].split("\t");
    expect(cols[0]).toBe("1"); // インターフェイスキーコード（1始まり）
    expect(cols[6]).toBe("12345678"); // ハイフン除去された作品コード
    expect(cols[7]).toBe("Butter-Fly"); // 原題名
    expect(cols[9]).toBe("千綿偉功"); // 作詞者名
    expect(cols[11]).toBe("千綿偉功"); // 作曲者名
    expect(cols[12]).toBe("渡部チェル"); // 編曲者名
    expect(cols[13]).toBe("和田光司"); // アーティスト名
  });

  it("複数件でインターフェイスキーコードが連番になる", () => {
    const results = [
      makeJasracInfo({ title: "曲A" }),
      makeJasracInfo({ title: "曲B" }),
      makeJasracInfo({ title: "曲C" }),
    ];
    const lines = convertToTsv(results).split("\n");
    expect(lines).toHaveLength(4); // ヘッダー + 3行
    expect(lines[1].split("\t")[0]).toBe("1");
    expect(lines[2].split("\t")[0]).toBe("2");
    expect(lines[3].split("\t")[0]).toBe("3");
  });

  it("作品コードのハイフンが除去される", () => {
    const info = makeJasracInfo({ workCode: "0A1-2345-6" });
    const line = convertToTsv([info]).split("\n")[1];
    expect(line.split("\t")[6]).toBe("0A123456");
  });
});
