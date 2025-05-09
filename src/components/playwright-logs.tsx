import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface PlaywrightLogsProps {
	logs: string[];
	isLoading: boolean;
	isPolling: boolean;
}

export function PlaywrightLogs({
	logs,
	isLoading,
	isPolling,
}: PlaywrightLogsProps) {
	const logsEndRef = useRef<HTMLDivElement>(null);

	// ログの最下部に自動スクロール
	useEffect(() => {
		if (logsEndRef.current) {
			logsEndRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, [logs]);

	// ログがない場合やポーリング/ロード中でない場合は何も表示しない
	if (!isLoading && !isPolling && logs.length === 0) {
		return null;
	}

	return (
		<Card className="mt-4">
			<CardHeader className="py-2">
				<CardTitle className="text-base flex items-center justify-between">
					<span>Playwright実行ログ{isPolling ? "（2秒ごとに更新）" : ""}</span>
					{isPolling && (
						<div className="flex items-center text-sm text-blue-500">
							<div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full mr-2" />
							更新中...
						</div>
					)}
				</CardTitle>
			</CardHeader>
			<CardContent className="p-2">
				<div className="h-64 overflow-y-auto bg-gray-900 text-gray-200 p-3 rounded-md font-mono text-xs">
					{logs.length > 0 ? (
						<>
							{logs.map((log, i) => (
								<div
									key={i}
									className={
										log.includes("[エラー]") ? "text-red-400" : "text-green-400"
									}
								>
									{log}
								</div>
							))}
							<div ref={logsEndRef} />
						</>
					) : (
						<div className="text-gray-400 italic">
							ログはまだありません。スクリプト実行中にここに表示されます...
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
