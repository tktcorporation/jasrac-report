import { Download, HelpCircle, Info, AlertCircle, CheckCircle, XCircle, Edit } from "lucide-react";
import { useState, useRef } from "react";
import { convertToShiftJis, createShiftJisBlob, downloadBlob } from "../lib/encoding-utils";
import type { JasracInfo } from "../lib/jasrac-types";
import { columnRules, expectedHeaders, generalNotes } from "../lib/tsv-rules";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardDescription, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "./ui/table";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "./ui/accordion";

interface TsvValidatorProps {
	results: JasracInfo[];
}

// TSVデータの型定義
interface TsvRowData {
    [key: string]: string;
}

export function TsvValidator({ results }: TsvValidatorProps) {
	const [filename, setFilename] = useState<string>(`jasrac_report_${new Date().toISOString().split("T")[0]}`);
	const [isValid, setIsValid] = useState<boolean | null>(null);
	const [hasDataWarnings, setHasDataWarnings] = useState<boolean>(false);
	const [dataValidationErrors, setDataValidationErrors] = useState<{row: number, column: string, message: string}[]>([]);
	const [showSpecification, setShowSpecification] = useState<boolean>(false);
	const [licenseNumber, setLicenseNumber] = useState<string>("");
	const [useYearMonth, setUseYearMonth] = useState<string>("");
	const [additionalText, setAdditionalText] = useState<string>("");
	const [filenameError, setFilenameError] = useState<string>("");
	const [showRowCount, setShowRowCount] = useState<number>(5);
	const [tsvData, setTsvData] = useState<TsvRowData[]>([]);
	const downloadLinkRef = useRef<HTMLAnchorElement>(null);

	// 選択された結果をTSVデータ行に変換する
	const convertToTsvData = (): TsvRowData[] => {
		return results.map((result, index) => {
			// 各カラムに対応するデータを準備
			const rowData: TsvRowData = {};
			// JASRACから取得した項目を追跡するフラグ（編集不可にするため）
			const jasracFields: Record<string, boolean> = {};
			
			// すべての期待されるヘッダーに対して初期値を設定
			expectedHeaders.forEach(header => {
				const rule = columnRules[header];
				// 固定値があれば使用
				if (rule?.fixedValue) {
					rowData[header] = rule.fixedValue;
				} 
				// デフォルト値があれば使用
				else if (rule?.defaultValue !== undefined) {
					rowData[header] = rule.defaultValue;
				} 
				// なければ空文字列で初期化
				else {
					rowData[header] = "";
				}
			});
			
			// JASRAC検索結果からのデータで上書き
			rowData["インターフェイスキーコード"] = (index + 1).toString();
			jasracFields["インターフェイスキーコード"] = false;
			
			// 取得した情報のみ設定し、その項目をJASRAC取得項目としてマーク
			if (result.workCode) {
				rowData["ＪＡＳＲＡＣ作品コード"] = result.workCode.replace(/-/g, "");
				jasracFields["ＪＡＳＲＡＣ作品コード"] = true;
			}
			
			if (result.title) {
				rowData["原題名"] = result.title;
				jasracFields["原題名"] = true;
			}
			
			if (result.lyricist) {
				rowData["作詞者名"] = result.lyricist;
				jasracFields["作詞者名"] = true;
			}
			
			if (result.composer) {
				rowData["作曲者名"] = result.composer;
				jasracFields["作曲者名"] = true;
			}
			
			if (result.arranger) {
				rowData["編曲者名"] = result.arranger;
				jasracFields["編曲者名"] = true;
			}
			
			if (result.artist) {
				rowData["アーティスト名"] = result.artist;
				jasracFields["アーティスト名"] = true;
			}
			
			// JASRACフィールド情報を保持
			(rowData as any)._jasracFields = jasracFields;
			
			return rowData;
		});
	};

	// 初期データの設定
	useState(() => {
		if (results.length > 0 && tsvData.length === 0) {
			setTsvData(convertToTsvData());
		}
	});

	// データの変更を処理する関数
	const handleDataChange = (rowIndex: number, column: string, value: string) => {
		const newData = [...tsvData];
		if (!newData[rowIndex]) {
			return;
		}
		
		newData[rowIndex][column] = value;
		setTsvData(newData);
		
		// データ変更後に検証を再実行
		validateData(newData);
	};

	// TSVデータの検証
	const validateData = (data: TsvRowData[] = tsvData) => {
		const errors: {row: number, column: string, message: string}[] = [];

		// 各行のデータを検証
		data.forEach((row, rowIndex) => {
			// 各カラムをルールに従って検証
			Object.entries(row).forEach(([column, value]) => {
				const rule = columnRules[column];
				if (!rule) return;

				// 必須項目チェック
				if (rule.required && value === "") {
					errors.push({
						row: rowIndex + 1,
						column: column,
						message: `必須項目が入力されていません`
					});
				}

				// 条件付き必須項目チェック
				if (rule.conditionallyRequired && value === "") {
					const dependsOn = rule.dependsOn || "";
					const dependsOnValue = row[dependsOn] || "";

					// 依存項目が空の場合、いずれかが必須の項目
					if (dependsOnValue === "" && column === "作詞者名" && dependsOn === "作曲者名") {
						errors.push({
							row: rowIndex + 1,
							column: column,
							message: `作詞者名と作曲者名のいずれかは必須です`
						});
					}

					// 依存項目の値によって必須の項目
					if (rule.dependsOnValues && dependsOn && rule.dependsOnValues.includes(dependsOnValue)) {
						errors.push({
							row: rowIndex + 1,
							column: column,
							message: `${dependsOn}が「${dependsOnValue}」の場合、この項目は必須です`
						});
					}
				}

				// 固定値チェック
				if (rule.fixedValue && value !== "" && value !== rule.fixedValue) {
					errors.push({
						row: rowIndex + 1,
						column: column,
						message: `「${rule.fixedValue}」を入力してください`
					});
				}

				// 有効な値のリストチェック
				if (rule.validValues && value !== "" && !rule.validValues.includes(value)) {
					errors.push({
						row: rowIndex + 1,
						column: column,
						message: `有効な値は「${rule.validValues.join("、")}」のいずれかです`
					});
				}
			});
		});

		// 検証結果を設定
		setDataValidationErrors(errors);
		setHasDataWarnings(errors.length > 0);
		setIsValid(true); // 警告があっても基本的にはエクスポート可能とする
		
		return errors.length === 0;
	};

	// TSVデータの検証
	const validateTsvData = () => {
		return validateData();
	};

	// ファイル名の検証
	const validateFilename = (): boolean => {
		// ファイル名のみをチェックする
		if (!filename.trim()) {
			setFilenameError("ファイル名を入力してください");
			return false;
		}

		// JASRAC提出用フォーマットでチェックする
		if (licenseNumber || useYearMonth) {
			// 許諾番号: 10文字の英数字
			if (licenseNumber && (licenseNumber.length !== 10 || !/^[a-zA-Z0-9]+$/.test(licenseNumber))) {
				setFilenameError("許諾番号は10文字の英数字で入力してください");
				return false;
			}
			
			// 利用年月: YYYYMM形式 (6桁)
			if (useYearMonth && (useYearMonth.length !== 6 || !/^\d{6}$/.test(useYearMonth))) {
				setFilenameError("利用年月はYYYYMM形式で入力してください（例：202404）");
				return false;
			}
			
			// 追加テキスト: 100文字以内の英数字
			if (additionalText && (additionalText.length > 100 || !/^[a-zA-Z0-9]*$/.test(additionalText))) {
				setFilenameError("追加テキストは100文字以内の英数字で入力してください");
				return false;
			}
		}
		
		setFilenameError("");
		return true;
	};

	// TSVをエクスポートする
	const exportTsv = () => {
		if (tsvData.length === 0) {
			alert("エクスポートするデータがありません");
			return;
		}

		// データを検証
		validateTsvData();

		// ファイル名を検証
		if (!validateFilename()) {
			return;
		}

		// 大量のエラーがある場合は警告を表示（5件以上）
		if (dataValidationErrors.length > 5) {
			if (!window.confirm(`${dataValidationErrors.length}件の検証エラーがあります。このままエクスポートしますか？`)) {
				return;
			}
		}
		
		// ヘッダー行
		const headerRow = expectedHeaders.join("\t");
		
		// データ行
		const dataRows = tsvData.map(row => {
			return expectedHeaders.map(header => row[header] || "").join("\t");
		});
		
		// 最終的なTSV内容
		const tsvContent = [headerRow, ...dataRows].join("\n");

		// Shift-JISに変換
		const blob = createShiftJisBlob(tsvContent);
		
		// ファイル名の生成
		let exportFilename = "jasrac_report";
		if (licenseNumber && useYearMonth) {
			exportFilename = `${licenseNumber}${useYearMonth}${additionalText || ""}`;
		}

		// ダウンロード
		downloadBlob(blob, `${exportFilename}.txt`);
	};

	// 表示する行数を増やす
	const handleShowMoreRows = () => {
		setShowRowCount(prev => prev + 10);
	};

	// データを初期検証
	if (isValid === null && results.length > 0) {
		// 初期データをセット
		if (tsvData.length === 0) {
			setTsvData(convertToTsvData());
		}
		// 検証実行
		validateTsvData();
	}

	if (results.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>TSV検証</CardTitle>
					<CardDescription>
						検証する曲が選択されていません。検索結果から曲を選択してください。
					</CardDescription>
				</CardHeader>
			</Card>
		);
	}

	return (
		<div className="space-y-6">
			{isValid !== null && (
				<Alert className={isValid ? (hasDataWarnings ? "bg-yellow-50" : "bg-green-50") : "bg-red-50"}>
					{isValid ? (
						hasDataWarnings ? (
							<AlertCircle className="h-4 w-4 text-yellow-500" />
						) : (
							<CheckCircle className="h-4 w-4 text-green-500" />
						)
					) : (
						<XCircle className="h-4 w-4 text-red-500" />
					)}
					<AlertTitle>
						{isValid 
							? (hasDataWarnings ? "検証完了（警告あり）" : "検証成功") 
							: "検証失敗"}
					</AlertTitle>
					<AlertDescription>
						{isValid
							? (hasDataWarnings 
								? `TSVデータに${dataValidationErrors.length}件の警告があります。修正するか、このままエクスポートできます。`
								: "TSVデータは正常です。エクスポートできます。")
							: "TSVデータの検証に失敗しました。"}
					</AlertDescription>
				</Alert>
			)}

			{/* 検証結果データ */}
			<Card>
				<CardHeader>
					<CardTitle>TSV出力データ</CardTitle>
					<CardDescription>
						以下のデータが出力されます。必要に応じて編集してください ({tsvData.length}行)
					</CardDescription>
				</CardHeader>
				<CardContent className="p-0 sm:p-0">
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									{expectedHeaders.map((header, index) => (
										<TableHead key={index} className="px-2 py-1 text-xs whitespace-nowrap">
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<div className="flex items-center gap-1 cursor-help">
															{header}
															{columnRules[header] && (
																<HelpCircle className="h-3 w-3 text-gray-400" />
															)}
															{columnRules[header]?.required && (
                                                                <span className="text-red-500">*</span>
                                                            )}
														</div>
													</TooltipTrigger>
													{columnRules[header] && (
														<TooltipContent className="max-w-sm">
															<div className="space-y-2">
																<p className="font-medium">{header}</p>
																<p>{columnRules[header].rule}</p>
																{columnRules[header].example && (
																	<p className="text-sm text-gray-500">例: {columnRules[header].example}</p>
																)}
																{columnRules[header].required && (
																	<p className="text-sm text-red-500">必須項目</p>
																)}
																{columnRules[header].conditionallyRequired && (
																	<p className="text-sm text-orange-500">条件付き必須項目</p>
																)}
																{columnRules[header].fixedValue && (
																	<p className="text-sm text-blue-500">固定値: {columnRules[header].fixedValue}</p>
																)}
																{columnRules[header].validValues && (
																	<p className="text-sm text-blue-500">有効値: {columnRules[header].validValues.join(', ')}</p>
																)}
																{columnRules[header].isReadOnly && (
																	<p className="text-sm text-gray-500">編集不可</p>
																)}
																{/* JASRACから取得した項目であることを示す表示を追加 */}
																{tsvData.length > 0 && (tsvData[0] as any)._jasracFields && (tsvData[0] as any)._jasracFields[header] && (
																	<p className="text-sm text-blue-600">JASRACから取得した情報</p>
																)}
															</div>
														</TooltipContent>
													)}
												</Tooltip>
											</TooltipProvider>
										</TableHead>
									))}
								</TableRow>
							</TableHeader>
							<TableBody>
								{tsvData.slice(0, showRowCount).map((row, rowIndex) => (
									<TableRow key={rowIndex}>
										{expectedHeaders.map((header, cellIndex) => {
											const value = row[header] || "";
											const rule = columnRules[header];
											
											// ルール違反の判定
											let isError = false;
											if (rule) {
												if (rule.required && value === "") isError = true;
												if (rule.fixedValue && value !== "" && value !== rule.fixedValue) isError = true;
												if (rule.validValues && value !== "" && !rule.validValues.includes(value)) isError = true;
											}
											
											// JASRACから取得したデータかどうかを判定
											const jasracFields = (row as any)._jasracFields || {};
											const isJasracField = jasracFields[header] === true;
											
											// 入力可能かを判定（isReadOnlyプロパティを使用）
											const isEditable = !(rule?.isReadOnly === true || rule?.fixedValue || isJasracField);
											
											return (
												<TableCell 
													key={cellIndex} 
													className={`p-1 ${isError ? "bg-red-50" : ""}`}
												>
													{isEditable ? (
														<Input
															className={`h-8 text-xs ${isError ? "border-red-500" : ""}`}
															value={value}
															onChange={(e) => handleDataChange(rowIndex, header, e.target.value)}
															placeholder={rule?.example || ""}
														/>
													) : (
														<div className={`text-sm px-2 py-1 rounded ${isJasracField ? "bg-blue-50" : "bg-gray-50"}`}>
															{value || <span className="text-gray-400 italic">空欄</span>}
														</div>
													)}
												</TableCell>
											);
										})}
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
					
					{/* もっと表示ボタン */}
					{tsvData.length > showRowCount && (
						<div className="mt-4 text-center pb-4">
							<Button 
								variant="outline" 
								onClick={handleShowMoreRows}
							>
								さらに表示（あと{tsvData.length - showRowCount}行）
							</Button>
						</div>
					)}
				</CardContent>
			</Card>

			{/* 検証エラー表示 */}
			{dataValidationErrors.length > 0 && (
				<Card className="border-yellow-300">
					<CardHeader>
						<CardTitle className="text-yellow-700">データ検証の警告</CardTitle>
						<CardDescription>
							以下のデータ項目に問題があります
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="max-h-60 overflow-y-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>行</TableHead>
										<TableHead>列</TableHead>
										<TableHead>警告メッセージ</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{dataValidationErrors.map((error, index) => (
										<TableRow key={index}>
											<TableCell>{error.row}</TableCell>
											<TableCell>{error.column}</TableCell>
											<TableCell>{error.message}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					</CardContent>
				</Card>
			)}

			{/* ファイル出力設定 */}
			<Card>
				<CardHeader>
					<CardTitle>ファイル出力設定</CardTitle>
					<CardDescription>
						Shift_JISエンコードのタブ区切りテキストファイルとして保存します
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
						<div>
							<Label htmlFor="license-number" className="block text-sm font-medium mb-1">許諾番号（10文字）</Label>
							<Input
								id="license-number"
								className="w-full"
								value={licenseNumber}
								onChange={(e) => setLicenseNumber(e.target.value)}
								placeholder="例: J240841199"
								maxLength={10}
							/>
						</div>
						<div>
							<Label htmlFor="use-year-month" className="block text-sm font-medium mb-1">利用年月（YYYYMM）</Label>
							<Input
								id="use-year-month"
								className="w-full"
								value={useYearMonth}
								onChange={(e) => setUseYearMonth(e.target.value)}
								placeholder="例: 202404"
								maxLength={6}
							/>
						</div>
						<div>
							<Label htmlFor="additional-text" className="block text-sm font-medium mb-1">追加テキスト（任意、英数字）</Label>
							<Input
								id="additional-text"
								className="w-full"
								value={additionalText}
								onChange={(e) => setAdditionalText(e.target.value)}
								placeholder="例: A01"
								maxLength={100}
							/>
						</div>
					</div>
					{filenameError && (
						<p className="text-red-500 text-sm mb-4">{filenameError}</p>
					)}
					<div className="flex justify-center mt-4">
						<Button 
							onClick={exportTsv} 
							className="flex items-center gap-2"
							disabled={tsvData.length === 0}
						>
							<Download className="h-4 w-4" />
							ファイルとしてエクスポート
						</Button>
						<a ref={downloadLinkRef} className="hidden"></a>
					</div>
				</CardContent>
				<CardFooter className="text-sm text-gray-500">
					<div className="space-y-2 w-full">
						<p>ファイル名は「許諾番号 + 利用年月 + 追加テキスト.txt」の形式で保存されます。<br />例: J240841199202404A01.txt</p>
						<div>
							<h3 className="font-medium">全体注記:</h3>
							<ul className="list-disc pl-5 space-y-1">
								{generalNotes.map((note, index) => (
									<li key={index}>{note.note}</li>
								))}
							</ul>
						</div>
					</div>
				</CardFooter>
			</Card>
		</div>
	);
} 