import { Clipboard, Edit, Search, Trash } from "lucide-react";
import { useCallback, useState } from "react";
import type { SongInfo } from "../lib/jasrac-types";
import { Button } from "./ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "./ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog";
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
import { Textarea } from "./ui/textarea";

interface SongInputFormProps {
	onSearch: (songs: SongInfo[]) => Promise<void>;
	isLoading: boolean;
}

export function SongInputForm({ onSearch, isLoading }: SongInputFormProps) {
	const [songList, setSongList] = useState<SongInfo[]>([]);
	const [currentSong, setCurrentSong] = useState<SongInfo>({ title: "" });
	const [pasteDialogOpen, setPasteDialogOpen] = useState<boolean>(false);
	const [pasteContent, setPasteContent] = useState<string>("");
	const [pasteError, setPasteError] = useState<string>("");

	// 曲情報を追加する関数
	const addSong = useCallback(() => {
		if (currentSong.title.trim()) {
			setSongList((prev) => [...prev, { ...currentSong }]);
			setCurrentSong({ title: "" });
		}
	}, [currentSong]);

	// 曲情報を削除する関数
	const removeSong = useCallback((index: number) => {
		setSongList((prev) => prev.filter((_, i) => i !== index));
	}, []);

	// テキスト貼り付けから曲情報を解析して追加する関数
	const parseSongsFromText = useCallback(() => {
		if (!pasteContent.trim()) {
			setPasteError("テキストが入力されていません");
			return;
		}

		try {
			// 行ごとに分割
			const lines = pasteContent.trim().split("\n");
			if (lines.length === 0) {
				setPasteError("有効なデータがありません");
				return;
			}

			// 各行を解析
			const parsedSongs: SongInfo[] = [];

			for (const line of lines) {
				if (!line.trim()) continue;

				// タブまたはカンマで分割（タブ優先）
				const parts = line.includes("\t") ? line.split("\t") : line.split(",");

				const title = parts[0]?.trim();
				if (!title) continue; // タイトルがない行はスキップ

				const newSong: SongInfo = {
					title,
					artist: parts[1]?.trim() || "",
					composer: parts[2]?.trim() || "",
					lyricist: parts[3]?.trim() || "",
				};

				parsedSongs.push(newSong);
			}

			if (parsedSongs.length === 0) {
				setPasteError("有効な曲情報が見つかりませんでした");
				return;
			}

			// 既存の曲リストに追加
			setSongList((prev) => [...prev, ...parsedSongs]);

			// ダイアログを閉じて状態をリセット
			setPasteDialogOpen(false);
			setPasteContent("");
			setPasteError("");
		} catch (error) {
			console.error("テキスト解析エラー:", error);
			setPasteError("テキストの解析中にエラーが発生しました");
		}
	}, [pasteContent]);

	// 検索実行
	const handleSearch = useCallback(() => {
		if (songList.length === 0) {
			alert("検索する曲が登録されていません");
			return;
		}
		onSearch(songList);
	}, [songList, onSearch]);

	return (
		<div>
			<Card className="mb-6">
				<CardHeader>
					<CardTitle>曲情報の入力</CardTitle>
					<CardDescription>
						検索したい曲の情報を入力してください
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<Label htmlFor="title">曲名 (必須)</Label>
								<Input
									id="title"
									value={currentSong.title}
									onChange={(e) =>
										setCurrentSong((prev) => ({
											...prev,
											title: e.target.value,
										}))
									}
									placeholder="例: Butter-Fly"
								/>
							</div>
							<div>
								<Label htmlFor="artist">アーティスト名</Label>
								<Input
									id="artist"
									value={currentSong.artist || ""}
									onChange={(e) =>
										setCurrentSong((prev) => ({
											...prev,
											artist: e.target.value,
										}))
									}
									placeholder="例: 和田光司"
								/>
							</div>
						</div>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<Label htmlFor="composer">作曲者</Label>
								<Input
									id="composer"
									value={currentSong.composer || ""}
									onChange={(e) =>
										setCurrentSong((prev) => ({
											...prev,
											composer: e.target.value,
										}))
									}
									placeholder="例: 千綿偉功"
								/>
							</div>
							<div>
								<Label htmlFor="lyricist">作詞者</Label>
								<Input
									id="lyricist"
									value={currentSong.lyricist || ""}
									onChange={(e) =>
										setCurrentSong((prev) => ({
											...prev,
											lyricist: e.target.value,
										}))
									}
									placeholder="例: 和田光司"
								/>
							</div>
						</div>
						<div className="flex justify-end gap-2">
							<Button
								variant="outline"
								onClick={() => setPasteDialogOpen(true)}
								className="flex items-center gap-2"
							>
								<Clipboard className="h-4 w-4" />
								テキストから一括追加
							</Button>
							<Button onClick={addSong} disabled={!currentSong.title.trim()}>
								曲を追加
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card className="mb-6">
				<CardHeader>
					<CardTitle>検索リスト</CardTitle>
					<CardDescription>
						検索対象の曲リスト ({songList.length}曲)
					</CardDescription>
				</CardHeader>
				<CardContent>
					{songList.length > 0 ? (
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>曲名</TableHead>
										<TableHead>アーティスト</TableHead>
										<TableHead>作曲者</TableHead>
										<TableHead>作詞者</TableHead>
										<TableHead className="w-24">操作</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{songList.map((song, index) => (
										<TableRow key={`song-${song.title}-${index}`}>
											<TableCell>{song.title}</TableCell>
											<TableCell>{song.artist || "-"}</TableCell>
											<TableCell>{song.composer || "-"}</TableCell>
											<TableCell>{song.lyricist || "-"}</TableCell>
											<TableCell>
												<Button
													variant="outline"
													size="sm"
													onClick={() => removeSong(index)}
												>
													削除
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					) : (
						<div className="text-center py-6 text-gray-500">
							曲が追加されていません
						</div>
					)}
				</CardContent>
				<CardFooter>
					<Button
						className="w-full flex items-center justify-center gap-2"
						onClick={handleSearch}
						disabled={songList.length === 0 || isLoading}
					>
						{isLoading ? (
							<>
								<div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
								検索中...
							</>
						) : (
							<>
								<Search className="h-4 w-4" />
								JASRACで検索
							</>
						)}
					</Button>
					{songList.length > 5 && (
						<p className="mt-2 text-xs text-yellow-600">
							検索対象の曲数が多いと、処理に時間がかかる場合があります。
						</p>
					)}
				</CardFooter>
			</Card>

			{/* テキスト貼り付けダイアログ */}
			<Dialog open={pasteDialogOpen} onOpenChange={setPasteDialogOpen}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>テキストから曲情報を一括追加</DialogTitle>
						<DialogDescription>
							下記の形式でテキストを貼り付けてください。各行に1曲の情報を記入します。
							<br />
							書式:
							曲名[タブまたはカンマ]アーティスト[タブまたはカンマ]作曲者[タブまたはカンマ]作詞者
						</DialogDescription>
					</DialogHeader>
					<div className="py-4">
						<Textarea
							placeholder="例：
バタフライ	和田光司	千綿偉功	和田光司
brave heart	宮﨑歩	和田一也	大森祥子"
							className="min-h-[200px] font-mono"
							value={pasteContent}
							onChange={(e) => setPasteContent(e.target.value)}
						/>
						{pasteError && (
							<p className="text-red-500 text-sm mt-2">{pasteError}</p>
						)}
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setPasteDialogOpen(false);
								setPasteContent("");
								setPasteError("");
							}}
						>
							キャンセル
						</Button>
						<Button onClick={parseSongsFromText}>曲を追加</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
