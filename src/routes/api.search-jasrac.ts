import { createAPIFileRoute } from "@tanstack/react-start/api";
import type { SongInfo } from "../lib/jasrac-types";
import { searchJasracInfo } from "../server/jasrac-bridge";

export const APIRoute = createAPIFileRoute("/api/search-jasrac")({
	// GETリクエスト - URLパラメータからの検索（将来的な拡張用）
	GET: async ({ request }) => {
		try {
			// URLから検索クエリを取得
			const url = new URL(request.url);
			const songsParam = url.searchParams.get("songs");

			if (!songsParam) {
				return new Response(
					JSON.stringify({ message: "検索する曲情報が指定されていません" }),
					{ status: 400, headers: { "Content-Type": "application/json" } },
				);
			}

			const songs = JSON.parse(songsParam) as SongInfo[];

			if (!Array.isArray(songs) || songs.length === 0) {
				return new Response(
					JSON.stringify({
						message: "検索する曲情報が正しく指定されていません",
					}),
					{ status: 400, headers: { "Content-Type": "application/json" } },
				);
			}

			console.log("JASRACの検索を開始します (GET):", songs);
			const results = await searchJasracInfo(songs);
			console.log("検索結果:", results.length, "件");

			return new Response(JSON.stringify(results), {
				headers: { "Content-Type": "application/json" },
			});
		} catch (error) {
			console.error("JASRAC検索中にエラーが発生しました:", error);
			return new Response(
				JSON.stringify({
					message:
						error instanceof Error
							? error.message
							: "JASRAC情報の取得に失敗しました",
				}),
				{ status: 500, headers: { "Content-Type": "application/json" } },
			);
		}
	},

	// POSTリクエスト - リクエストボディからの検索
	POST: async ({ request }) => {
		try {
			const body = await request.json();
			const songs = body.songs as SongInfo[];

			if (!songs || !Array.isArray(songs) || songs.length === 0) {
				return new Response(
					JSON.stringify({ message: "曲情報が正しく指定されていません" }),
					{ status: 400, headers: { "Content-Type": "application/json" } },
				);
			}

			const results = await searchJasracInfo(songs);

			return new Response(JSON.stringify(results), {
				headers: { "Content-Type": "application/json" },
			});
		} catch (error) {
			console.error("JASRAC検索中にエラーが発生しました:", error);

			return new Response(
				JSON.stringify({
					message:
						error instanceof Error
							? error.message
							: "JASRAC情報の取得に失敗しました",
				}),
				{ status: 500, headers: { "Content-Type": "application/json" } },
			);
		}
	},
});
