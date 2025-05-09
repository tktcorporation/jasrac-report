import { createFileRoute } from "@tanstack/react-router";
import { Music, TableIcon, Terminal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SearchResults } from "../components/search-results";
import { SongInputForm } from "../components/song-input-form";
import { getPlaywrightLogs, searchJasracInfo } from "../lib/jasrac-bridge";
import type { JasracInfo, SongInfo } from "../lib/jasrac-types";

export const Route = createFileRoute("/")({
	component: App,
});

function App() {
	// JASRACデータ収集用の状態
	const [jasracResults, setJasracResults] = useState<JasracInfo[]>([]);
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [activeTab, setActiveTab] = useState<string>("input");
	const [searchError, setSearchError] = useState<string>("");

	// Playwrightのログ表示用の状態
	const [playwrightLogs, setPlaywrightLogs] = useState<string[]>([]);
	const [isPollingLogs, setIsPollingLogs] = useState<boolean>(false);
	const [showLogs, setShowLogs] = useState<boolean>(false);
	const logsContainerRef = useRef<HTMLDivElement>(null);

	// ログを取得する関数
	const fetchPlaywrightLogs = useCallback(async () => {
		try {
			const response = await fetch("/api/playwright-logs");
			if (response.ok) {
				const logs = await response.json();
				setPlaywrightLogs(logs);
			}
		} catch (error) {
			console.error("ログ取得エラー:", error);
		}
	}, []);

	// JASRAC検索を実行する関数
	const searchJasrac = useCallback(
		async (songList: SongInfo[]) => {
			if (songList.length === 0) {
				alert("検索する曲が登録されていません");
				return;
			}

			setIsLoading(true);
			setSearchError("");
			setPlaywrightLogs([]); // ログをクリア
			setIsPollingLogs(true); // ログのポーリングを開始
			setShowLogs(true); // ログ表示を有効化
			setActiveTab("results"); // 検索実行時に検索結果タブに切り替え

			try {
				// バックエンドAPIを呼び出し
				const response = await fetch("/api/search-jasrac", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ songs: songList }),
				});

				if (!response.ok) {
					const errorData = await response.json().catch(() => ({}));
					throw new Error(errorData.message || `API Error: ${response.status}`);
				}

				const data = await response.json();

				if (!data || data.length === 0) {
					setSearchError(
						"検索結果が見つかりませんでした。曲名を確認して再度お試しください。",
					);
					return;
				}

				// 結果を設定
				setJasracResults(data);

				// 検索結果タブに切り替え
				setActiveTab("results");
			} catch (error) {
				console.error("JASRAC検索中にエラーが発生しました", error);
				const errorMessage = error instanceof Error ? error.message : "不明なエラー";
				
				// JASRACサーバーからのタイムアウトエラーの場合、特別なメッセージを表示
				if (errorMessage.includes("タイムアウト")) {
					setSearchError(
						`検索中にエラーが発生しました: ${errorMessage}。バックグラウンドプロセスが続行している場合は、下のログで進捗状況を確認できます。`
					);
					// タイムアウトエラーの場合もログポーリングを継続
					return; // finallyブロックは実行されるが、ポーリングを停止しない
				} else {
					setSearchError(
						`検索中にエラーが発生しました: ${errorMessage}`
					);
				}
			} finally {
				// タイムアウトエラーの場合はポーリングを続行させるため、明示的に停止しない
				const errorText = searchError || "";
				const isTimeoutError = errorText.includes("タイムアウト");
				
				// エラーがタイムアウト以外かプロセスが正常終了した場合のみ
				if (!isTimeoutError) {
					// 処理完了後に最後のログを全て取得
					await fetchPlaywrightLogs();
					setIsPollingLogs(false); // ポーリングを停止
					setIsLoading(false);
				} else {
					// タイムアウトエラーの場合は、ログポーリングを継続
					await fetchPlaywrightLogs(); // 最新ログを取得
					// ポーリングは継続したまま、ローディング表示のみ非表示にする
					setIsLoading(false);
				}
			}
		},
		[fetchPlaywrightLogs],
	);

	// ログポーリングの設定
	useEffect(() => {
		let intervalId: number | undefined;

		if (isPollingLogs) {
			// 2秒ごとにログを更新
			intervalId = window.setInterval(fetchPlaywrightLogs, 2000);
		}

		return () => {
			if (intervalId) {
				window.clearInterval(intervalId);
			}
		};
	}, [isPollingLogs, fetchPlaywrightLogs]);

	// ログが更新されたら自動スクロール
	useEffect(() => {
		if (logsContainerRef.current && playwrightLogs.length > 0) {
			const container = logsContainerRef.current;
			container.scrollTop = container.scrollHeight;
		}
	}, [playwrightLogs]);

	// ログ表示エリアを閉じる
	const closeLogs = () => {
		setShowLogs(false);
	};

	// 検索プロセスをキャンセルする
	const cancelSearch = async () => {
		try {
			const response = await fetch("/api/cancel-search", {
				method: "POST",
			});
			
			if (response.ok) {
				setSearchError("検索処理はキャンセルされました");
				setIsPollingLogs(false);
				setIsLoading(false);
			} else {
				console.error("検索キャンセル中にエラーが発生しました");
			}
		} catch (error) {
			console.error("キャンセル処理中にエラーが発生:", error);
		}
	};

	// ログを手動で更新する
	const refreshLogs = async () => {
		await fetchPlaywrightLogs();
	};

	// プロセスが完了しているかチェックする（最新のログをチェック）
	const isProcessCompleted = () => {
		if (playwrightLogs.length === 0) return false;
		
		// 最後の5つのログメッセージをチェック
		const lastLogs = playwrightLogs.slice(-5);
		const completionKeywords = ["完了しました", "処理が終了", "検索完了", "終了コード 0"];
		
		return lastLogs.some(log => 
			completionKeywords.some(keyword => log.includes(keyword))
		);
	};

	return (
		<div className="container mx-auto px-4 py-8">
			<h1 className="text-3xl font-bold mb-6 text-center">
				JASRAC情報検索・申請ツール
			</h1>

			{/* タブナビゲーション */}
			<div className="mb-6">
				<div className="flex space-x-2 border-b">
					{/* 検索実行中は曲情報入力タブを表示しない */}
					{!isLoading && (
						<button
							className={`px-4 py-2 font-medium ${activeTab === "input" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"}`}
							onClick={() => setActiveTab("input")}
						>
							<div className="flex items-center gap-2">
								<Music className="h-4 w-4" />
								曲情報入力
							</div>
						</button>
					)}
					<button
						className={`px-4 py-2 font-medium ${activeTab === "results" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"}`}
						onClick={() => setActiveTab("results")}
					>
						<div className="flex items-center gap-2">
							<TableIcon className="h-4 w-4" />
							検索結果
						</div>
					</button>
				</div>
			</div>

			{/* Playwrightログ表示エリア */}
			{showLogs && (
				<div className="mb-6 bg-slate-900 text-slate-100 p-4 rounded-md">
					<div className="flex justify-between items-center mb-2">
						<div className="flex items-center gap-2">
							<Terminal className="h-4 w-4" />
							<h3 className="font-medium">Playwright実行ログ</h3>
							{isPollingLogs && (
								<span className="text-xs bg-blue-600 px-2 py-0.5 rounded-full">自動更新中</span>
							)}
							{isProcessCompleted() && (
								<span className="text-xs bg-green-600 px-2 py-0.5 rounded-full">完了</span>
							)}
						</div>
						<div className="flex items-center gap-2">
							{isPollingLogs && (
								<button
									onClick={cancelSearch}
									className="text-xs bg-red-600 hover:bg-red-700 px-2 py-1 rounded"
								>
									キャンセル
								</button>
							)}
							<button
								onClick={refreshLogs}
								className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded mr-2"
							>
								更新
							</button>
							<button
								onClick={closeLogs}
								className="text-slate-400 hover:text-slate-100"
							>
								×
							</button>
						</div>
					</div>
					<div
						className="h-48 overflow-y-auto p-2 bg-slate-950 rounded"
						ref={logsContainerRef}
					>
						{playwrightLogs.length > 0 ? (
							<ul className="space-y-1 font-mono text-sm">
								{playwrightLogs.map((log, index) => (
									<li key={index} className="break-all">
										{log}
									</li>
								))}
							</ul>
						) : (
							<p className="text-slate-500 italic">ログはまだありません。</p>
						)}
					</div>
				</div>
			)}

			{/* アクティブなタブに応じたコンテンツ表示 */}
			{activeTab === "input" && !isLoading && (
				<SongInputForm onSearch={searchJasrac} isLoading={isLoading} />
			)}

			{activeTab === "results" && (
				<>
					{searchError ? (
						<div className="bg-red-50 p-4 rounded-md text-red-800 mb-4">
							{searchError}
						</div>
					) : null}

					<SearchResults results={jasracResults} isLoading={isLoading} />
				</>
			)}
		</div>
	);
}
