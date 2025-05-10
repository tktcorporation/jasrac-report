import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "./ui/collapsible";

interface PlaywrightLogsProps {
	logs: string[];
	isLoading: boolean;
	isPolling: boolean;
	isCompleted?: boolean; // 検索が完了したかどうかのフラグを追加
}

export function PlaywrightLogs({
	logs,
	isLoading,
	isPolling,
	isCompleted = false, // デフォルトはfalse
}: PlaywrightLogsProps) {
	const logsEndRef = useRef<HTMLDivElement>(null);
	// 検索完了時は折りたたまれた状態にする
	const [isOpen, setIsOpen] = useState(!isCompleted);

	// ログの最下部に自動スクロール
	useEffect(() => {
		if (logsEndRef.current && isOpen) {
			logsEndRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, [isOpen]);

	// 検索完了時に自動的に折りたたむ
	useEffect(() => {
		if (isCompleted) {
			setIsOpen(false);
		}
	}, [isCompleted]);

	// ログがない場合やポーリング/ロード中でない場合はnullを返す代わりに空の表示にする
	const shouldShowContent = !(!isLoading && !isPolling && logs.length === 0);

	return (
		<Card className={`mt-4 ${shouldShowContent ? "" : "hidden"}`}>
			<Collapsible open={isOpen} onOpenChange={setIsOpen}>
				<CardHeader className="py-2">
					<CardTitle className="text-base flex items-center justify-between">
						<div className="flex items-center">
							<CollapsibleTrigger className="flex items-center mr-2 hover:text-blue-500">
								{isOpen ? (
									<ChevronUp className="h-4 w-4" />
								) : (
									<ChevronDown className="h-4 w-4" />
								)}
							</CollapsibleTrigger>
							<span>
								Playwright実行ログ{isPolling ? "（2秒ごとに更新）" : ""}
							</span>
						</div>
						{isPolling && (
							<div className="flex items-center text-sm text-blue-500">
								<div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full mr-2" />
								更新中...
							</div>
						)}
						{isCompleted && !isPolling && (
							<div className="text-sm text-green-500">完了</div>
						)}
					</CardTitle>
				</CardHeader>
				<CollapsibleContent>
					{shouldShowContent && (
						<CardContent className="p-2">
							<div className="h-64 overflow-y-auto bg-gray-900 text-gray-200 p-3 rounded-md font-mono text-xs">
								{logs.length > 0 ? (
									<>
										{logs.map((log, i) => (
											<div
												key={`log-${i}-${log.substring(0, 10).replace(/\s+/g, "")}`}
												className={
													log.includes("[エラー]")
														? "text-red-400"
														: "text-green-400"
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
					)}
				</CollapsibleContent>
			</Collapsible>
		</Card>
	);
}
