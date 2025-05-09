import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { JasracInfo, SongInfo } from "../lib/jasrac-types";

// JASRACから曲情報を検索する関数
export async function searchJasracInfo(
	songs: SongInfo[],
): Promise<JasracInfo[]> {
	// 実装する環境に応じて、以下の関数を変更する必要があります
	return new Promise((resolve, reject) => {
		try {
			console.log("検索開始:", songs);

			// Playwrightの出力ログを保存する配列
			const playwrightLogs: string[] = [];

			// 一時ファイルに曲情報を書き込む（Playwrightスクリプトへの入力として）
			const tempDir = path.join(process.cwd(), "temp");
			if (!fs.existsSync(tempDir)) {
				fs.mkdirSync(tempDir, { recursive: true });
			}

			const inputFile = path.join(tempDir, "song-input.json");
			fs.writeFileSync(inputFile, JSON.stringify(songs), "utf8");

			// ログ用の一時ファイル
			const logFile = path.join(tempDir, "playwright-logs.json");
			// 初期状態として空の配列を書き込む
			fs.writeFileSync(logFile, JSON.stringify([]), "utf8");

			// 出力ファイルのパスを指定
			const outputFile = path.join(tempDir, "jasrac-results.json");

			// Playwrightスクリプトのパス
			const scriptPath = path.join(
				process.cwd(),
				"playwright",
				"jasrac-collector.ts",
			);

			// Node.jsプロセスを起動してPlaywrightスクリプトを実行
			const proc = spawn("npx", [
				"tsx",
				scriptPath,
				"--input",
				inputFile,
				"--output",
				outputFile,
			]);

			// プロセスIDをファイルに保存（キャンセル機能のため）
			if (proc.pid) {
				fs.writeFileSync(
					path.join(tempDir, "playwright-pid.txt"),
					proc.pid.toString(),
					"utf8",
				);
				console.log(`Playwrightプロセス起動 (PID: ${proc.pid})`);
			}

			let stdout = "";
			let stderr = "";

			proc.stdout.on("data", (data) => {
				const logMessage = data.toString();
				stdout += logMessage;
				console.log("Playwright出力:", logMessage);
				playwrightLogs.push(`[出力] ${logMessage}`);

				// 現在のログをファイルに書き込む (リアルタイム更新用)
				try {
					const currentLogs = JSON.parse(fs.readFileSync(logFile, "utf8"));
					currentLogs.push(`[出力] ${logMessage}`);
					fs.writeFileSync(logFile, JSON.stringify(currentLogs), "utf8");
				} catch (error) {
					console.error("ログファイルの更新に失敗:", error);
				}
			});

			proc.stderr.on("data", (data) => {
				const errorMessage = data.toString();
				stderr += errorMessage;
				console.error("Playwright エラー:", errorMessage);
				playwrightLogs.push(`[エラー] ${errorMessage}`);

				// エラーログもファイルに書き込む
				try {
					const currentLogs = JSON.parse(fs.readFileSync(logFile, "utf8"));
					currentLogs.push(`[エラー] ${errorMessage}`);
					fs.writeFileSync(logFile, JSON.stringify(currentLogs), "utf8");
				} catch (error) {
					console.error("ログファイルの更新に失敗:", error);
				}
			});

			proc.on("close", (code) => {
				if (code !== 0) {
					console.error(`プロセスが終了コード ${code} で終了しました`);
					reject(
						new Error(
							`JASRACデータ収集に失敗しました: ${stderr || "不明なエラー"}`,
						),
					);
					return;
				}

				// 結果ファイルを読み込む
				const outputFile = path.join(tempDir, "jasrac-results.json");
				if (fs.existsSync(outputFile)) {
					try {
						const results = JSON.parse(fs.readFileSync(outputFile, "utf8"));
						if (Array.isArray(results) && results.length > 0) {
							// ログを追加せずに結果をそのまま返す
							resolve(results);
						} else {
							reject(
								new Error(
									"JASRACでの検索結果が見つかりませんでした。曲名や作者情報を確認してください。",
								),
							);
						}
					} catch (error) {
						console.error("結果ファイルの解析に失敗しました:", error);
						reject(
							new Error(
								"検索結果の処理に失敗しました。アプリケーションを再起動してお試しください。",
							),
						);
					}
				} else {
					reject(
						new Error(
							"JASRACの検索結果ファイルが見つかりませんでした。ネットワーク接続を確認してください。",
						),
					);
				}
			});

			// タイムアウト設定（5分）- 以前は2分だったが、長時間の処理に対応するため延長
			const timeout = setTimeout(() => {
				// プロセスが進行中かどうかを確認（直近30秒以内にログが追加されたかをチェック）
				try {
					const currentLogs = JSON.parse(fs.readFileSync(logFile, "utf8"));
					const recentLogs = currentLogs.filter((log: string) => {
						// ログに埋め込まれたタイムスタンプがある場合はそれを使用する
						// タイムスタンプが無い場合や解析できない場合は、現在時刻と比較
						const now = Date.now();
						const thirtySecsAgo = now - 30000; // 30秒前

						// ログの中にタイムスタンプがある場合、それを抽出して比較
						const timestampMatch = log.match(
							/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/,
						);
						if (timestampMatch?.[1]) {
							const logTime = new Date(timestampMatch[1]).getTime();
							return logTime > thirtySecsAgo;
						}
						return true; // タイムスタンプが見つからない場合は最近のログとして扱う
					});

					// 直近30秒以内にログが追加されている場合は、プロセスがまだ動いていると判断
					if (recentLogs.length > 0) {
						console.log(
							"プロセスはまだ動作中のようです。タイムアウトを延長します。",
						);
						return; // タイムアウトを発生させない
					}
				} catch (error) {
					console.error("ログファイルの確認中にエラーが発生:", error);
				}

				proc.kill();
				reject(
					new Error(
						"JASRACサーバーからの応答がタイムアウトしました。しばらく時間をおいて再度お試しください。",
					),
				);
			}, 900000); // 15分（900000ミリ秒）

			// プロセス終了時にタイムアウトをクリア
			proc.on("exit", () => {
				clearTimeout(timeout);
			});
		} catch (error) {
			console.error("検索処理中にエラーが発生しました:", error);
			reject(
				error instanceof Error
					? error
					: new Error("不明なエラーが発生しました"),
			);
		}
	});
}

// ログ取得用のAPIエンドポイント
export async function getPlaywrightLogs(): Promise<string[]> {
	try {
		const tempDir = path.join(process.cwd(), "temp");
		const logFile = path.join(tempDir, "playwright-logs.json");

		if (fs.existsSync(logFile)) {
			return JSON.parse(fs.readFileSync(logFile, "utf8"));
		}
		return [];
	} catch (error) {
		console.error("ログファイルの読み込みに失敗:", error);
		return [];
	}
}
