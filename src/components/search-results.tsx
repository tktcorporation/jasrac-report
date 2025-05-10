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

interface SearchResultsProps {
	results: JasracInfo[];
	isLoading: boolean;
}

export function SearchResults({
	results: initialResults,
	isLoading,
}: SearchResultsProps) {
	const [results, setResults] = useState<JasracInfo[]>(initialResults);
	const [selectedItems, setSelectedItems] = useState<Record<number, boolean>>(
		{},
	);
	const [detailDialogOpen, setDetailDialogOpen] = useState(false);
	const [selectedDetail, setSelectedDetail] = useState<JasracInfo | null>(null);
	const [activeTab, setActiveTab] = useState("search-results");
	const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(null);

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

	// ドロップダウンの開閉を制御する関数
	const toggleDropdown = (index: number) => {
		setOpenDropdownIndex(openDropdownIndex === index ? null : index);
	};

	if (results.length === 0 && !isLoading) {
		return (
			<div className="text-center py-10 text-gray-500">
				検索結果はまだありません
			</div>
		);
	}

	return (
		<div className="space-y-6">
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
																<div className="relative">
																	<Button
																		variant="outline"
																		size="sm"
																		onClick={() => toggleDropdown(index)}
																	>
																	他の候補を表示
																	</Button>
																	{openDropdownIndex === index && (
																		<div className="absolute z-10 mt-1 w-72 rounded-md bg-white dark:bg-gray-900 shadow-lg ring-1 ring-black ring-opacity-5 dark:ring-white dark:ring-opacity-10">
																			<div className="py-1">
																				<div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 font-medium border-b dark:border-gray-700">
																					他の候補
																				</div>
																				{result.alternatives.map((alt, altIdx) => (
																					<button
																						key={altIdx}
																						className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
																						onClick={() => {
																							replaceResultWithAlternative(index, altIdx);
																							setOpenDropdownIndex(null);
																						}}
																					>
																						<div className="font-medium">{alt.title}</div>
																						<div className="text-xs text-gray-500 dark:text-gray-400">
																							{alt.workCode} / {alt.lyricist} / {alt.composer}
																						</div>
																					</button>
																				))}
																			</div>
																		</div>
																	)}
																</div>
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
