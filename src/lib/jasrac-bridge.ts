import type { JasracInfo, SongInfo } from "./jasrac-types";

// JASRACの結果をTSV形式に変換する関数
export function convertToTsv(results: JasracInfo[]): string {
	// TSV形式のヘッダーを作成
	const tsvHeaders = [
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

	// TSV形式のデータ行を作成
	const tsvRows = results.map((result, index) => {
		return [
			(index + 1).toString(), // インターフェイスキーコード
			"", // コンテンツ区分
			"000", // コンテンツ枝番
			"", // メドレー区分
			"000", // メドレー枝番
			"", // コレクトコード
			result.workCode.replace(/-/g, ""), // JASRAC作品コード (ハイフンなし)
			result.title, // 原題名
			"", // 副題・邦題
			result.lyricist, // 作詞者名
			"", // 補作詞・訳詞者名
			result.composer, // 作曲者名
			result.arranger, // 編曲者名
			result.artist, // アーティスト名
			"0", // 情報料（税抜）
			"I", // IVT区分 (曲のみ利用の場合)
			"", // 原詞訳詞区分
			"", // IL区分
			"0", // リクエスト回数
		];
	});

	// ヘッダーと行を結合してTSV文字列を作成
	return [tsvHeaders.join("\t"), ...tsvRows.map((r) => r.join("\t"))].join(
		"\n",
	);
}

// APIを呼び出してJASRAC情報を検索する関数（クライアント側）
export async function searchJasracInfo(
	songs: SongInfo[],
): Promise<JasracInfo[]> {
	try {
		const response = await fetch("/api/search-jasrac", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ songs }),
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(errorData.message || `API Error: ${response.status}`);
		}

		return await response.json();
	} catch (error) {
		console.error("JASRAC検索APIエラー:", error);
		throw error;
	}
}

// Playwrightログを取得する関数（クライアント側）
export async function getPlaywrightLogs(): Promise<string[]> {
	try {
		const response = await fetch("/api/playwright-logs");
		if (!response.ok) {
			throw new Error(`API Error: ${response.status}`);
		}
		return await response.json();
	} catch (error) {
		console.error("ログ取得APIエラー:", error);
		return [];
	}
}
