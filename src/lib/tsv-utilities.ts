import * as Encoding from "encoding-japanese";

// TSVをShift-JISエンコードされたファイルとしてエクスポート
export function exportTsvToFile(
  headers: string[],
  rows: string[][],
  licenseNumber: string,
  useYearMonth: string,
  additionalText: string,
): { success: boolean; url?: string; filename?: string; error?: string } {
  try {
    // ヘッダーと行を結合して、タブ区切りテキストを生成
    const headerRow = headers.join("\t");
    const dataRows = rows.map((row) => row.join("\t"));
    const tsvString = [headerRow, ...dataRows].join("\n");

    // テキストをShift_JISエンコード
    const unicodeArray = Encoding.stringToCode(tsvString);
    const sjisArray = Encoding.convert(unicodeArray, {
      to: "SJIS",
      from: "UNICODE",
    });
    const sjisBytes = new Uint8Array(sjisArray);

    // Blob作成
    const blob = new Blob([sjisBytes], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    // ファイル名を生成
    const filename = `${licenseNumber}${useYearMonth}${additionalText}.txt`;

    return { success: true, url, filename };
  } catch (error) {
    console.error("ファイル出力エラー:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "ファイルの出力中にエラーが発生しました",
    };
  }
}

// Shift-JIS TSVファイルからUnicodeテキストへ変換
export function convertShiftJisTsvToUnicode(arrayBuffer: ArrayBuffer): string {
  try {
    const bytes = new Uint8Array(arrayBuffer);

    // Shift-JISとして変換を試す
    const unicodeArray = Encoding.convert(bytes, {
      to: "UNICODE",
      from: "SJIS",
    });

    // 文字列に変換
    return Encoding.codeToString(unicodeArray);
  } catch {
    throw new Error("ファイルのエンコーディング変換に失敗しました");
  }
}

// ヘッダー用の正規化関数
export function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, "");
}
