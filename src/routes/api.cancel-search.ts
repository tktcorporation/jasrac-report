import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createAPIFileRoute } from "@tanstack/react-start/api";

// 実行中のPlaywrightプロセスをキャンセルするAPI
export const APIRoute = createAPIFileRoute("/api/cancel-search")({
	POST: async () => {
		try {
			// プロセスIDファイルのパス
			const tempDir = path.join(process.cwd(), "temp");
			const pidFilePath = path.join(tempDir, "playwright-pid.txt");

			// プロセスIDファイルが存在する場合
			if (fs.existsSync(pidFilePath)) {
				const pidContent = fs.readFileSync(pidFilePath, "utf8").trim();

				if (pidContent) {
					// プロセスを終了するコマンドを実行
					// SIGTERM はより穏やかな終了シグナル
					// Linuxはkill、Windowsはtaskill
					if (process.platform === "win32") {
						exec(`taskkill /PID ${pidContent} /T /F`, (error) => {
							if (error) {
								console.error(`プロセス終了エラー: ${error.message}`);
							} else {
								console.log(`プロセス ${pidContent} を終了しました`);
							}
						});
					} else {
						exec(`kill -15 ${pidContent}`, (error) => {
							if (error) {
								console.error(`プロセス終了エラー: ${error.message}`);
							} else {
								console.log(`プロセス ${pidContent} を終了しました`);
							}
						});
					}

					// ログに追記
					const logFile = path.join(tempDir, "playwright-logs.json");
					if (fs.existsSync(logFile)) {
						try {
							const logs = JSON.parse(fs.readFileSync(logFile, "utf8"));
							logs.push(
								`[システム] ユーザーによって検索処理がキャンセルされました (PID: ${pidContent})`,
							);
							fs.writeFileSync(logFile, JSON.stringify(logs), "utf8");
						} catch (error) {
							console.error("ログ更新エラー:", error);
						}
					}
				}
			}

			return new Response(JSON.stringify({ success: true }), {
				headers: { "Content-Type": "application/json" },
			});
		} catch (error) {
			console.error("キャンセル処理中にエラーが発生しました:", error);
			return new Response(
				JSON.stringify({
					message:
						error instanceof Error
							? error.message
							: "検索キャンセル中にエラーが発生しました",
				}),
				{ status: 500, headers: { "Content-Type": "application/json" } },
			);
		}
	},
});
