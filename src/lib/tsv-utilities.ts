import * as Encoding from "encoding-japanese";

// 保存データの型定義
export interface SavedData {
	id: string;
	name: string;
	date: string;
	content: string;
	headers: string[];
	rows: string[][];
	licenseNumber: string;
	useYearMonth: string;
	additionalText: string;
}

// 各カラムの入力ルール定義
export interface ColumnRule {
	required: boolean;
	rule: string;
	example?: string;
	defaultValue?: string;
	fixedValue?: string;
	validValues?: string[];
	conditionallyRequired?: boolean;
	dependsOn?: string;
	dependsOnValues?: string[];
	source?: string; // 出典情報を追加
}

// データ検証エラー
export interface DataValidationError {
	row: number;
	column: string;
	message: string;
}

// 期待されるヘッダー
export const expectedHeaders = [
	"インターフェイスキーコード",
	"コンテンツ区分",
	"コンテンツ枝番",
	"メドレー区分",
	"メドレー枝番",
	"コレクトコード",
	"ＪＡＳＲＡＣ作品コード",
	"原題名",
	"副題・邦題",
	"作詞者名",
	"補作詞・訳詞者名",
	"作曲者名",
	"編曲者名",
	"アーティスト名",
	"情報料（税抜）",
	"ＩＶＴ区分",
	"原詞訳詞区分",
	"IL区分",
	"リクエスト回数",
];

// 全体注記
export const generalNotes = [
	{
		note: "報告の際は、項目タイトル行は不要ですので削除してください。",
		source:
			"Googleスプレッドシート「nb-report-sample.xlsx」のセルA1コメント (2025年5月9日参照)",
	},
	{
		note: "著作権の消滅している楽曲もご報告ください。",
		source:
			"Googleスプレッドシート「nb-report-sample.xlsx」のセルH12コメント (2025年5月9日参照)",
	},
];

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
			error:
				error instanceof Error
					? error.message
					: "ファイルの出力中にエラーが発生しました",
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
	} catch (error) {
		throw new Error("ファイルのエンコーディング変換に失敗しました");
	}
}

// ヘッダー用の正規化関数
export function normalizeHeader(header: string): string {
	return header.trim().toLowerCase().replace(/\s+/g, "");
}
