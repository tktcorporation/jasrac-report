import { createAPIFileRoute } from "@tanstack/react-start/api";
import { getPlaywrightLogs } from "../server/jasrac-bridge";

export const APIRoute = createAPIFileRoute("/api/playwright-logs")({
	GET: async () => {
		try {
			const logs = await getPlaywrightLogs();

			return new Response(JSON.stringify(logs), {
				headers: { "Content-Type": "application/json" },
			});
		} catch (error) {
			console.error("ログ取得中にエラーが発生しました:", error);
			return new Response(
				JSON.stringify({
					message:
						error instanceof Error ? error.message : "ログの取得に失敗しました",
				}),
				{ status: 500, headers: { "Content-Type": "application/json" } },
			);
		}
	},
});
