import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAPIFileRoute } from "@tanstack/react-start/api";
import type { JasracInfo } from "../lib/jasrac-types";

export const APIRoute = createAPIFileRoute("/api/jasrac-results")({
	// GETリクエスト - 検索結果を取得
	GET: async () => {
		try {
			const tempDir = path.resolve(os.tmpdir(), "jasrac-temp");
			const outputFile = path.join(tempDir, "jasrac-results.json");

			console.log("検索結果ファイルを確認: ", outputFile);

			// 結果ファイルが存在するか確認
			if (!fs.existsSync(outputFile)) {
				console.log("検索結果ファイルがまだ存在しません");
				return new Response(
					JSON.stringify({ message: "検索結果がまだありません" }),
					{ status: 404, headers: { "Content-Type": "application/json" } },
				);
			}

			// ファイルサイズを確認
			const stats = fs.statSync(outputFile);
			if (stats.size === 0) {
				console.log("検索結果ファイルは空です");
				return new Response(JSON.stringify({ message: "検索結果が空です" }), {
					status: 404,
					headers: { "Content-Type": "application/json" },
				});
			}

			// ファイルの内容を読み込む
			try {
				const rawData = fs.readFileSync(outputFile, "utf8");
				const results = JSON.parse(rawData) as JasracInfo[];

				console.log(`検索結果: ${results.length}件`);

				return new Response(JSON.stringify(results), {
					headers: { "Content-Type": "application/json" },
				});
			} catch (parseError) {
				console.error("検索結果ファイルの解析に失敗:", parseError);
				return new Response(
					JSON.stringify({ message: "検索結果の解析に失敗しました" }),
					{ status: 500, headers: { "Content-Type": "application/json" } },
				);
			}
		} catch (error) {
			console.error("検索結果取得中にエラーが発生しました:", error);
			return new Response(
				JSON.stringify({
					message:
						error instanceof Error
							? error.message
							: "検索結果の取得に失敗しました",
				}),
				{ status: 500, headers: { "Content-Type": "application/json" } },
			);
		}
	},
});
