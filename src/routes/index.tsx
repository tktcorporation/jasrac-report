import { createFileRoute } from "@tanstack/react-router";
import { Music, TableIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PlaywrightLogsPanel } from "../components/playwright-logs-panel";
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
				setSearchError("検索する曲が入力されていません");
				return;
			}

			setActiveTab("results");
			setIsLoading(true);
			setIsPollingLogs(true);
			setSearchError("");
			setShowLogs(true);

			try {
				// 前回の検索結果をクリア
				setJasracResults([]);
				setPlaywrightLogs([]);

				// APIリクエスト
				const response = await fetch("/api/search", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ songs: songList }),
				});

				if (!response.ok) {
					const errorData = await response.json();
					if (errorData?.error) {
						setSearchError(errorData.error);
					} else {
						setSearchError("検索中にエラーが発生しました");
					}
					return;
				}

				const result = await response.json();
				if (result.message === "検索開始") {
					// ポーリングを開始
					await fetchPlaywrightLogs();
				} else {
					setSearchError("検索の開始に失敗しました");
				}
			} catch (error) {
				console.error("Error searching JASRAC:", error);
				setSearchError("API通信中にエラーが発生しました");
			} finally {
				setIsLoading(false);
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

	// 同じ作品コードの楽曲を一つにまとめる関数
	const removeDuplicateWorkCodes = (results: JasracInfo[]): JasracInfo[] => {
		const workCodeMap = new Map<string, JasracInfo>();

		// 各結果を処理して、作品コードごとにマッピング
		for (const result of results) {
			const workCode = result.workCode;

			// この作品コードが未処理の場合
			if (!workCodeMap.has(workCode)) {
				workCodeMap.set(workCode, result);
			} else {
				// すでに同じ作品コードの楽曲が存在する場合
				const existing = workCodeMap.get(workCode);
				if (!existing) continue;

				// alternativesに情報を追加（もし存在して重複していなければ）
				if (result.alternatives && result.alternatives.length > 0) {
					existing.alternatives = existing.alternatives || [];

					// alternativesから重複しないものだけを追加
					for (const alt of result.alternatives) {
						if (alt.workCode === existing.workCode) continue;

						// 既存のalternativesに含まれていないか確認
						const isDuplicate = existing.alternatives.some(
							(existingAlt) => existingAlt.workCode === alt.workCode,
						);

						if (!isDuplicate) {
							existing.alternatives.push(alt);
						}
					}
				}
			}
		}

		// Mapの値を配列に変換して返す
		return Array.from(workCodeMap.values());
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
							type="button"
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
						type="button"
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

					{/* Playwright実行ログ - 検索結果タブでのみ表示 */}
					<PlaywrightLogsPanel
						logs={playwrightLogs}
						isPolling={isPollingLogs}
						showLogs={showLogs}
						onCancel={cancelSearch}
						onRefresh={refreshLogs}
						onClose={closeLogs}
					/>

					<SearchResults
						results={jasracResults}
						isLoading={isLoading}
						playwrightLogs={playwrightLogs}
						isPollingLogs={isPollingLogs}
						setShowLogs={setShowLogs}
					/>
				</>
			)}
		</div>
	);
}
