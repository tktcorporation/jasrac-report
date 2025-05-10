// SongInfo型定義
export interface SongInfo {
	title: string;
	artist?: string;
	composer?: string;
	lyricist?: string;
}

// JasracInfo型定義
export interface JasracInfo {
	workCode: string;
	title: string;
	lyricist: string;
	composer: string;
	artist: string;
	arranger: string;
	duration: string;
	workType: string;
	nationality: string;
	creationDate: string;
	rightsInfo: RightInfo[];
	usageCategory: string;
	publisher: string;
	usagePermissions: UsagePermission;
	rawHtml: string;
	selected?: boolean;
	playwrightLogs?: string[];
	alternatives?: JasracInfo[];
}

// 権利者情報
export interface RightInfo {
	name: string;
	role: string;
	shares: string;
	society: string;
}

// 利用分野の許可情報
export interface UsagePermission {
	// 演奏カテゴリ
	performance: {
		concert: boolean;
		bgm: boolean;
		karaoke: boolean;
	};
	// 複製カテゴリ
	reproduction: {
		recording: boolean;
		publication: boolean;
		rental: boolean;
		video: boolean;
		movie: boolean;
	};
	// 公衆送信カテゴリ
	transmission: {
		broadcast: boolean;
		distribution: boolean;
		karaoke_comm: boolean;
	};
	// 広告カテゴリ
	advertisement: {
		cm: boolean;
		movie_ad: boolean;
		recording_ad: boolean;
		video_ad: boolean;
		publication_ad: boolean;
	};
	// ゲームカテゴリ
	game: {
		recording_game: boolean;
		video_game: boolean;
	};
	// 管理状況の詳細テキスト
	managementDetails: Record<string, string>;
}
