import { Eye, FileText, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { convertToTsv } from "../lib/jasrac-bridge";
import type { JasracInfo } from "../lib/jasrac-types";
import { PlaywrightLogs } from "./playwright-logs";
import { TsvValidator } from "./tsv-validator";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "./ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "./ui/popover";
import { Progress } from "./ui/progress";

interface SearchResultsProps {
	results: JasracInfo[];
	isLoading: boolean;
	playwrightLogs?: string[];
	isPollingLogs?: boolean;
	setShowLogs?: (show: boolean) => void;
}

export function SearchResults({
	results: initialResults,
	isLoading,
	playwrightLogs = [],
	isPollingLogs = false,
	setShowLogs,
}: SearchResultsProps) {
	const [results, setResults] = useState<JasracInfo[]>(initialResults);
	const [selectedItems, setSelectedItems] = useState<Record<number, boolean>>(
		{},
	);
	const [detailDialogOpen, setDetailDialogOpen] = useState(false);
	const [selectedDetail, setSelectedDetail] = useState<JasracInfo | null>(null);
	const [activeTab, setActiveTab] = useState("search-results");
	const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(null);
	const [searchProgress, setSearchProgress] = useState(0);

	// 検索結果が取得されたらPlaywright実行ログを畳む
	useEffect(() => {
		if (initialResults.length > 0 && !isLoading && setShowLogs) {
			// 検索結果が取得されて、ローディング終了時にログを非表示にするのではなく
			// 折りたたむためにfalseにはしない
			// setShowLogs(false);
		}
	}, [initialResults.length, isLoading, setShowLogs]);

	// 検索の進捗状況を推定する
	useEffect(() => {
		if (isLoading || isPollingLogs) {
			if (playwrightLogs.length > 0) {
				// ログの内容から進捗を推定
				const progressIndicators = [
					{ keyword: "検索を開始", value: 10 },
					{ keyword: "曲情報入力", value: 20 },
					{ keyword: "検索ボタンをクリック", value: 30 },
					{ keyword: "検索結果を取得中", value: 50 },
					{ keyword: "詳細情報を取得中", value: 70 },
					{ keyword: "情報を解析中", value: 90 },
					{ keyword: "完了しました", value: 100 },
					{ keyword: "終了コード 0", value: 100 },
				];

				// 曲数の情報を取得（例: "2曲目を検索中..."）
				let currentSongIndex = 0;
				let totalSongs = 0;
				
				for (const log of playwrightLogs) {
					// 曲数情報を正規表現で抽出（フォーマット: "N曲目を検索中: タイトル (N/M曲目)"）
					const songIndexMatch = log.match(/(\d+)曲目を検索中: .+ \((\d+)\/(\d+)曲目\)/);
					if (songIndexMatch && songIndexMatch[1] && songIndexMatch[3]) {
						currentSongIndex = parseInt(songIndexMatch[1], 10);
						totalSongs = parseInt(songIndexMatch[3], 10);
					}
					
					// 合計曲数情報を正規表現で抽出
					const totalSongsMatch = log.match(/合計(\d+)曲の検索を開始/);
					if (totalSongsMatch && totalSongsMatch[1] && !totalSongs) {
						totalSongs = parseInt(totalSongsMatch[1], 10);
					}
				}

				// 現在のログの状態に基づいて最も進んだ進捗値を特定
				let currentProgress = 5; // デフォルト値
				
				// 曲数情報から進捗を計算（優先）
				if (totalSongs > 0 && currentSongIndex > 0) {
					currentProgress = Math.floor((currentSongIndex / totalSongs) * 80) + 10;
				} else {
					// キーワードベースの進捗計算（バックアップ）
					for (const log of playwrightLogs) {
						for (const indicator of progressIndicators) {
							if (log.includes(indicator.keyword) && indicator.value > currentProgress) {
								currentProgress = indicator.value;
							}
						}
					}
				}
				
				setSearchProgress(currentProgress);
			} else {
				// ログがまだない場合は初期状態
				setSearchProgress(5);
			}
		} else if (!isLoading && !isPollingLogs && initialResults.length > 0) {
			// 検索が完了し結果がある場合（ローディングとポーリングが両方終わっていることを確認）
			setSearchProgress(100);
		} else {
			// 検索していない初期状態
			setSearchProgress(0);
		}
	}, [playwrightLogs, isLoading, isPollingLogs, initialResults.length]);

	useEffect(() => {
		setResults(initialResults);
	}, [initialResults]);

	// 他の候補で差し替える関数
	const replaceResultWithAlternative = (
		resultIndex: number,
		altIndex: number,
	) => {
		setResults((prev) => {
			const newResults = [...prev];
			const current = newResults[resultIndex];
			if (!current.alternatives || !current.alternatives[altIndex]) return prev;
			const newMain = current.alternatives[altIndex];
			// 新しいmainのalternativesを再構成（元mainと他のalternativesを含める）
			const newAlts = [
				current,
				...current.alternatives.filter((_, i) => i !== altIndex),
			];
			newMain.alternatives = newAlts;
			newResults[resultIndex] = { ...newMain };
			return newResults;
		});
	};

	// 選択された結果を取得
	const getSelectedResults = (): JasracInfo[] => {
		return results.filter((_, index) => selectedItems[index]);
	};

	// TSVに変換する関数
	const generateTsvFromResults = () => {
		// 選択された結果を抽出
		const selectedResults = getSelectedResults();

		if (selectedResults.length === 0) {
			alert("TSVに変換する曲を選択してください");
			return;
		}

		// TSVに変換
		const tsvContent = convertToTsv(selectedResults);

		// Blobを作成してダウンロードリンクを生成
		const blob = new Blob([tsvContent], { type: "text/tab-separated-values" });
		const url = URL.createObjectURL(blob);

		// ダウンロードリンクを作成して自動クリック
		const a = document.createElement("a");
		a.href = url;
		a.download = "jasrac_report.tsv";
		document.body.appendChild(a);
		a.click();

		// 不要になったオブジェクトを解放
		window.setTimeout(() => {
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}, 0);
	};

	// チェックボックスの変更を処理する関数
	const handleCheckboxChange = (index: number, checked: boolean) => {
		setSelectedItems((prev) => ({
			...prev,
			[index]: checked,
		}));
	};

	// 詳細情報を表示する関数
	const showDetailInfo = (result: JasracInfo) => {
		setSelectedDetail(result);
		setDetailDialogOpen(true);
	};

	// 全て選択/解除する関数
	const toggleSelectAll = (checked: boolean) => {
		const newSelection: Record<number, boolean> = {};
		results.forEach((_, index) => {
			newSelection[index] = checked;
		});
		setSelectedItems(newSelection);
	};

	// 検証タブに移動する関数
	const goToValidationTab = () => {
		if (getSelectedResults().length === 0) {
			alert("検証する曲を選択してください");
			return;
		}
		setActiveTab("validation");
	};

	if (results.length === 0 && !isLoading && !isPollingLogs) {
		return (
			<div className="text-center py-10 text-gray-500">
				検索結果はまだありません
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* 検索進捗状況の表示 */}
			{(isLoading || isPollingLogs || searchProgress === 100) && (
				<Card className="mb-4">
					<CardContent className="pt-6">
						<div className="space-y-2">
							<div className="flex justify-between items-center mb-1">
								<span className="text-sm font-medium">検索進捗状況</span>
								<span className={`text-sm font-medium ${searchProgress === 100 ? "text-green-600" : "text-blue-600"}`}>
									{searchProgress}%
								</span>
							</div>
							<Progress 
								value={searchProgress} 
								className={`h-2 ${searchProgress === 100 ? "bg-green-100" : "bg-blue-100"}`}
							/>
							<div className="flex justify-between items-center text-xs text-gray-500 mt-2">
								<div>
									{searchProgress < 30 && "JASRAC検索ページにアクセス中..."}
									{searchProgress >= 30 && searchProgress < 60 && "検索結果を取得中..."}
									{searchProgress >= 60 && searchProgress < 100 && "詳細情報を取得・解析中..."}
									{searchProgress === 100 && (
										<span className="text-green-600 font-medium">検索完了！</span>
									)}
								</div>
								{playwrightLogs.length > 0 && (
									<div className="text-right">
										{playwrightLogs.filter(log => log.includes("曲目を検索中")).pop() || 
										(searchProgress === 100 ? "すべての曲の検索が完了しました" : "検索準備中...")}
									</div>
								)}
							</div>
						</div>
					</CardContent>
				</Card>
			)}
			
			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList className="mb-4">
					<TabsTrigger value="search-results">検索結果</TabsTrigger>
					<TabsTrigger value="validation">TSV検証</TabsTrigger>
				</TabsList>

				<TabsContent value="search-results">
					<Card>
						<CardHeader className="py-3">
							<CardTitle className="text-lg flex items-center justify-between">
								<span>検索結果 ({results.length}件)</span>
								<div className="flex items-center gap-2">
									<Button
										variant="outline"
										size="sm"
										onClick={() => toggleSelectAll(true)}
										disabled={results.length === 0}
									>
										全て選択
									</Button>
									<Button
										variant="outline"
										size="sm"
										onClick={() => toggleSelectAll(false)}
										disabled={results.length === 0}
									>
										選択解除
									</Button>
									<Button
										variant="outline"
										size="sm"
										onClick={goToValidationTab}
										disabled={getSelectedResults().length === 0}
										className="ml-2"
									>
										選択した曲を検証
									</Button>
								</div>
							</CardTitle>
						</CardHeader>
						<CardContent>
							{results.length > 0 ? (
								<div className="space-y-6">
									<div className="overflow-x-auto">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead className="w-12">選択</TableHead>
													<TableHead>作品コード</TableHead>
													<TableHead>曲名</TableHead>
													<TableHead>内外</TableHead>
													<TableHead>作詞者</TableHead>
													<TableHead>作曲者</TableHead>
													<TableHead>アーティスト</TableHead>
													<TableHead>編曲者</TableHead>
													<TableHead>出版者</TableHead>
													<TableHead>利用可能分野</TableHead>
													<TableHead>詳細</TableHead>
													<TableHead>他の候補</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{results.map((result, index) => (
													<TableRow key={index}>
														<TableCell>
															<Checkbox
																checked={!!selectedItems[index]}
																onCheckedChange={(checked) =>
																	handleCheckboxChange(index, checked === true)
																}
															/>
														</TableCell>
														<TableCell>
															<a
																href={`https://www2.jasrac.or.jp/eJwid/main?trxID=F00101&WORKS_CD=${result.workCode.replace(/-/g, "")}&subSession=001&subSession2=002`}
																target="_blank"
																rel="noopener noreferrer"
																className="text-blue-600 underline hover:text-blue-800"
																title="J-WIDで詳細を見る"
															>
																{result.workCode}
															</a>
														</TableCell>
														<TableCell>{result.title}</TableCell>
														<TableCell>
															<Badge
																variant="outline"
																className={
																	result.nationality?.includes("内国")
																		? "bg-blue-50"
																		: "bg-amber-50"
																}
															>
																{result.nationality?.includes("内国")
																	? "内国作品"
																	: "外国作品"}
															</Badge>
														</TableCell>
														<TableCell>{result.lyricist}</TableCell>
														<TableCell>{result.composer}</TableCell>
														<TableCell>{result.artist}</TableCell>
														<TableCell>{result.arranger || "-"}</TableCell>
														<TableCell>{result.publisher || "-"}</TableCell>
														<TableCell>
															<div className="flex flex-wrap gap-1">
																{result.usagePermissions?.performance
																	?.concert && (
																	<Badge
																		variant="outline"
																		className="bg-blue-50"
																	>
																		演奏
																	</Badge>
																)}
																{result.usagePermissions?.reproduction
																	?.recording && (
																	<Badge
																		variant="outline"
																		className="bg-green-50"
																	>
																		録音
																	</Badge>
																)}
																{result.usagePermissions?.transmission
																	?.broadcast && (
																	<Badge
																		variant="outline"
																		className="bg-amber-50"
																	>
																		放送
																	</Badge>
																)}
																{result.usagePermissions?.transmission
																	?.distribution && (
																	<Badge
																		variant="outline"
																		className="bg-purple-50"
																	>
																		配信
																	</Badge>
																)}
															</div>
														</TableCell>
														<TableCell>
															<Button
																variant="ghost"
																size="icon"
																onClick={() => showDetailInfo(result)}
															>
																<Eye className="h-4 w-4" />
															</Button>
														</TableCell>
														<TableCell>
															{result.alternatives && result.alternatives.length > 0 && (
																<Popover
																	open={openDropdownIndex === index}
																	onOpenChange={(isOpen) => {
																		if (isOpen) {
																			setOpenDropdownIndex(index);
																		} else {
																			setOpenDropdownIndex(null);
																		}
																	}}
																>
																	<PopoverTrigger asChild>
																		<Button variant="outline" size="sm">
																			他の候補を表示
																		</Button>
																	</PopoverTrigger>
																	<PopoverContent className="w-72 p-0">
																		<div className="py-1">
																			<div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 font-medium border-b dark:border-gray-700">
																				他の候補
																			</div>
																			{result.alternatives.map((alt, altIdx) => (
																				<button
																					key={altIdx}
																					className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
																					onClick={() => {
																						replaceResultWithAlternative(
																							index,
																							altIdx,
																						);
																						setOpenDropdownIndex(null); // Close popover
																					}}
																				>
																					<div className="font-medium">
																						{alt.title}
																					</div>
																					<div className="text-xs text-gray-500 dark:text-gray-400">
																						{alt.workCode} / {alt.lyricist} /{" "}
																						{alt.composer}
																					</div>
																				</button>
																			))}
																		</div>
																	</PopoverContent>
																</Popover>
															)}
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>
								</div>
							) : (
								<div className="py-10 text-center">
									<div className="flex justify-center mb-4">
										<div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full" />
									</div>
									<p className="text-gray-500">
										JASRACから情報を取得しています...
									</p>
									{playwrightLogs.length > 0 && (
										<p className="text-xs text-gray-400 mt-2">
											{playwrightLogs[playwrightLogs.length - 1]}
										</p>
									)}
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="validation">
					{/* TSV検証コンポーネント */}
					<TsvValidator results={getSelectedResults()} />

					<div className="mt-4 flex justify-start">
						<Button
							variant="outline"
							onClick={() => setActiveTab("search-results")}
							className="flex items-center gap-2"
						>
							検索結果に戻る
						</Button>
					</div>
				</TabsContent>
			</Tabs>

			{/* 詳細情報ダイアログ */}
			<Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
				<DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>{selectedDetail?.title || "詳細情報"}</DialogTitle>
						<DialogDescription>
							作品コード: {selectedDetail?.workCode}
							{selectedDetail?.nationality && (
								<span className="ml-4">
									<Badge
										variant="outline"
										className={
											selectedDetail.nationality?.includes("内国")
												? "bg-blue-50 text-blue-800"
												: "bg-amber-50 text-amber-800"
										}
									>
										{selectedDetail.nationality?.includes("内国")
											? "内国作品"
											: "外国作品"}
									</Badge>
								</span>
							)}
						</DialogDescription>
					</DialogHeader>

					{selectedDetail && (
						<div className="space-y-4 mt-4">
							{/* 基本情報 */}
							<div>
								<h3 className="font-semibold text-lg mb-2">基本情報</h3>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
									<div>
										<span className="font-medium">作詞者:</span>{" "}
										{selectedDetail.lyricist}
									</div>
									<div>
										<span className="font-medium">作曲者:</span>{" "}
										{selectedDetail.composer}
									</div>
									<div>
										<span className="font-medium">アーティスト:</span>{" "}
										{selectedDetail.artist || "-"}
									</div>
									<div>
										<span className="font-medium">編曲者:</span>{" "}
										{selectedDetail.arranger || "-"}
									</div>
									<div>
										<span className="font-medium">出版者:</span>{" "}
										{selectedDetail.publisher || "-"}
									</div>
									<div>
										<span className="font-medium">作品種別:</span>{" "}
										{selectedDetail.workType || "-"}
									</div>
									<div>
										<span className="font-medium">国籍:</span>{" "}
										{selectedDetail.nationality || "-"}
									</div>
									<div>
										<span className="font-medium">創作日:</span>{" "}
										{selectedDetail.creationDate || "-"}
									</div>
								</div>
							</div>

							{/* 権利情報 */}
							{selectedDetail.rightsInfo &&
								selectedDetail.rightsInfo.length > 0 && (
									<div>
										<h3 className="font-semibold text-lg mb-2">権利情報</h3>
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>名前</TableHead>
													<TableHead>役割</TableHead>
													<TableHead>持分</TableHead>
													<TableHead>団体</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{selectedDetail.rightsInfo.map((right, index) => (
													<TableRow key={index}>
														<TableCell>{right.name}</TableCell>
														<TableCell>{right.role}</TableCell>
														<TableCell>{right.shares}</TableCell>
														<TableCell>{right.society}</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>
								)}

							{/* 利用可能分野 */}
							<div>
								<h3 className="font-semibold text-lg mb-2">利用可能分野</h3>
								<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
									{/* 演奏 */}
									<div className="border rounded p-3">
										<h4 className="font-medium mb-2">演奏</h4>
										<ul className="space-y-1">
											<li>
												<span>コンサート:</span>{" "}
												<Badge
													variant={
														selectedDetail.usagePermissions?.performance
															?.concert
															? "default"
															: "outline"
													}
													className={
														selectedDetail.usagePermissions?.performance
															?.concert
															? "bg-green-100 text-green-800"
															: "bg-red-100 text-red-800"
													}
												>
													{selectedDetail.usagePermissions?.performance?.concert
														? "可"
														: "不可"}
												</Badge>
											</li>
											<li>
												<span>BGM:</span>{" "}
												<Badge
													variant={
														selectedDetail.usagePermissions?.performance?.bgm
															? "default"
															: "outline"
													}
													className={
														selectedDetail.usagePermissions?.performance?.bgm
															? "bg-green-100 text-green-800"
															: "bg-red-100 text-red-800"
													}
												>
													{selectedDetail.usagePermissions?.performance?.bgm
														? "可"
														: "不可"}
												</Badge>
											</li>
											<li>
												<span>カラオケ:</span>{" "}
												<Badge
													variant={
														selectedDetail.usagePermissions?.performance
															?.karaoke
															? "default"
															: "outline"
													}
													className={
														selectedDetail.usagePermissions?.performance
															?.karaoke
															? "bg-green-100 text-green-800"
															: "bg-red-100 text-red-800"
													}
												>
													{selectedDetail.usagePermissions?.performance?.karaoke
														? "可"
														: "不可"}
												</Badge>
											</li>
										</ul>
									</div>

									{/* 複製 */}
									<div className="border rounded p-3">
										<h4 className="font-medium mb-2">複製</h4>
										<ul className="space-y-1">
											<li>
												<span>録音:</span>{" "}
												<Badge
													variant={
														selectedDetail.usagePermissions?.reproduction
															?.recording
															? "default"
															: "outline"
													}
													className={
														selectedDetail.usagePermissions?.reproduction
															?.recording
															? "bg-green-100 text-green-800"
															: "bg-red-100 text-red-800"
													}
												>
													{selectedDetail.usagePermissions?.reproduction
														?.recording
														? "可"
														: "不可"}
												</Badge>
											</li>
											<li>
												<span>出版:</span>{" "}
												<Badge
													variant={
														selectedDetail.usagePermissions?.reproduction
															?.publication
															? "default"
															: "outline"
													}
													className={
														selectedDetail.usagePermissions?.reproduction
															?.publication
															? "bg-green-100 text-green-800"
															: "bg-red-100 text-red-800"
													}
												>
													{selectedDetail.usagePermissions?.reproduction
														?.publication
														? "可"
														: "不可"}
												</Badge>
											</li>
										</ul>
									</div>

									{/* 公衆送信 */}
									<div className="border rounded p-3">
										<h4 className="font-medium mb-2">公衆送信</h4>
										<ul className="space-y-1">
											<li>
												<span>放送:</span>{" "}
												<Badge
													variant={
														selectedDetail.usagePermissions?.transmission
															?.broadcast
															? "default"
															: "outline"
													}
													className={
														selectedDetail.usagePermissions?.transmission
															?.broadcast
															? "bg-green-100 text-green-800"
															: "bg-red-100 text-red-800"
													}
												>
													{selectedDetail.usagePermissions?.transmission
														?.broadcast
														? "可"
														: "不可"}
												</Badge>
											</li>
											<li>
												<span>配信:</span>{" "}
												<Badge
													variant={
														selectedDetail.usagePermissions?.transmission
															?.distribution
															? "default"
															: "outline"
													}
													className={
														selectedDetail.usagePermissions?.transmission
															?.distribution
															? "bg-green-100 text-green-800"
															: "bg-red-100 text-red-800"
													}
												>
													{selectedDetail.usagePermissions?.transmission
														?.distribution
														? "可"
														: "不可"}
												</Badge>
											</li>
										</ul>
									</div>
								</div>
							</div>
						</div>
					)}

					<DialogFooter className="mt-4">
						<Button onClick={() => setDetailDialogOpen(false)}>閉じる</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
