import { createAPIFileRoute } from "@tanstack/react-start/api";
import type { SongInfo } from "../lib/jasrac-types";
import { searchJasracInfo } from "../server/jasrac-bridge";

export const APIRoute = createAPIFileRoute("/api/search")({
	// POSTリクエスト - リクエストボディからの検索
	POST: async ({ request }) => {
		try {
			// リクエストを受け取ったことを知らせる
			console.log("検索リクエストを受信しました");

			// 検索開始のレスポンスを返す
			return new Response(JSON.stringify({ message: "検索開始" }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		} catch (error) {
			console.error("検索リクエスト処理中にエラーが発生しました:", error);

			return new Response(
				JSON.stringify({
					message:
						error instanceof Error
							? error.message
							: "リクエストの処理に失敗しました",
				}),
				{ status: 500, headers: { "Content-Type": "application/json" } },
			);
		}
	},
});
