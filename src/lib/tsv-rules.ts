// 各カラムの入力ルール定義
export interface ColumnRule {
	required: boolean;
	rule: string;
	example?: string;
	defaultValue?: string;
	fixedValue?: string;
	validValues?: string[];
	conditionallyRequired?: boolean;
	dependsOn?: string;
	dependsOnValues?: string[];
	source?: string; // 出典情報
	isReadOnly?: boolean; // 入力不要フィールドを示すフラグ
}

export const columnRules: Record<string, ColumnRule> = {
	"インターフェイスキーコード": {
		required: true,
		rule: "楽曲データ毎のキーコードです。１から順に数字をふってください。",
		example: "1, 2, 3...",
		source: "Googleスプレッドシート「nb-report-sample.xlsx」のセルA2コメント (2025年5月9日参照)",
		isReadOnly: true // 自動で設定されるため入力不要
	},
	"コンテンツ区分": {
		required: false,
		rule: "記入不要です。",
		defaultValue: "",
		source: "Googleスプレッドシート「nb-report-sample.xlsx」のセルB2コメント (2025年5月9日参照)",
		isReadOnly: true
	},
	"コンテンツ枝番": {
		required: true,
		rule: "必ず「000」（文字列で）を入力してください。",
		fixedValue: "000",
		example: "000",
		source: "Googleスプレッドシート「nb-report-sample.xlsx」のセルC2コメント (2025年5月9日参照)",
		isReadOnly: true
	},
	"メドレー区分": {
		required: false,
		rule: "記入不要です。",
		defaultValue: "",
		source: "Googleスプレッドシート「nb-report-sample.xlsx」のセルD2コメント (2025年5月9日参照)",
		isReadOnly: true
	},
	"メドレー枝番": {
		required: true,
		rule: "必ず「000」（文字列で）を入力してください。",
		fixedValue: "000",
		example: "000",
		source: "Googleスプレッドシート「nb-report-sample.xlsx」のセルE2コメント (2025年5月9日参照)",
		isReadOnly: true
	},
	"コレクトコード": {
		required: false,
		rule: "記入不要です。",
		defaultValue: "",
		source: "Googleスプレッドシート「nb-report-sample.xlsx」のセルF2コメント (2025年5月9日参照)",
		isReadOnly: true
	},
	"ＪＡＳＲＡＣ作品コード": {
		required: false,
		rule: "「J-WID」で検索のうえ(文字列で）入力してください。コード内のハイフンは不要です。どうしても不明の場合はブランク可。",
		example: "12345678",
		source: "Googleスプレッドシート「nb-report-sample.xlsx」のセルG2コメント (2025年5月9日参照)"
	},
	"原題名": {
		required: true,
		rule: "「J-WID」の表記にあわせて入力してください。",
		example: "曲名",
		source: "Googleスプレッドシート「nb-report-sample.xlsx」のセルH2コメント (2025年5月9日参照)"
	},
	"副題・邦題": {
		required: false,
		rule: "副題・邦題がある場合は入力してください。",
		defaultValue: "",
		source: "Googleスプレッドシート「nb-report-sample.xlsx」のセルI2コメント (2025年5月9日参照)"
	},
	"作詞者名": {
		required: false,
		rule: "作曲者名といずれか必須です。「J-WID」の表記にあわせて入力してください。",
		conditionallyRequired: true,
		dependsOn: "作曲者名",
		example: "作詞者",
		source: "Googleスプレッドシート「nb-report-sample.xlsx」のセルJ2コメント (2025年5月9日参照)"
	},
	"補作詞・訳詞者名": {
		required: false,
		rule: "補作詞・訳詞者がある場合は入力してください。",
		defaultValue: "",
		source: "Googleスプレッドシート「nb-report-sample.xlsx」のセルK2コメント (2025年5月9日参照)"
	},
	"作曲者名": {
		required: false,
		rule: "作詞者名といずれか必須です。「J-WID」の表記にあわせて入力してください。",
		conditionallyRequired: true,
		dependsOn: "作詞者名",
		example: "作曲者",
		source: "Googleスプレッドシート「nb-report-sample.xlsx」のセルL2コメント (2025年5月9日参照)"
	},
	"編曲者名": {
		required: false,
		rule: "編曲者がある場合は入力してください。",
		defaultValue: "",
		source: "Googleスプレッドシート「nb-report-sample.xlsx」のセルM2コメント (2025年5月9日参照)"
	},
	"アーティスト名": {
		required: false,
		rule: "",
		defaultValue: "",
		source: "Googleスプレッドシート「nb-report-sample.xlsx」の規定 (2025年5月9日参照)"
	},
	"情報料（税抜）": {
		required: true,
		rule: "必ず「０」（ゼロ）を入力してください。",
		fixedValue: "0",
		example: "0",
		source: "Googleスプレッドシート「nb-report-sample.xlsx」のセルO2コメント (2025年5月9日参照)",
		isReadOnly: true
	},
	"ＩＶＴ区分": {
		required: true,
		rule: "曲のみ利用の場合：「I」、詞曲利用の場合：「V」、詞のみ利用の場合：「T」を入力してください。",
		validValues: ["I", "V", "T"],
		example: "I",
		source: "Googleスプレッドシート「nb-report-sample.xlsx」のセルP2コメント (2025年5月9日参照)"
	},
	"原詞訳詞区分": {
		required: false,
		rule: "IVT区分が「V」又は「T」のとき必須です。原詞を利用の場合：「1」、訳詞を利用の場合：「2」、不明の場合：「3」を入力してください。",
		conditionallyRequired: true,
		dependsOn: "ＩＶＴ区分",
		dependsOnValues: ["V", "T"],
		validValues: ["1", "2", "3"],
		example: "1",
		source: "Googleスプレッドシート「nb-report-sample.xlsx」のセルQ2コメント (2025年5月9日参照)"
	},
	"IL区分": {
		required: false,
		rule: "記入不要です。",
		defaultValue: "",
		source: "Googleスプレッドシート「nb-report-sample.xlsx」のセルR2コメント (2025年5月9日参照)",
		isReadOnly: true
	},
	"リクエスト回数": {
		required: true,
		rule: "「0」（ゼロ）と記入してください。",
		fixedValue: "0",
		example: "0",
		source: "Googleスプレッドシート「nb-report-sample.xlsx」のセルS2コメント (2025年5月9日参照)",
		isReadOnly: true
	}
};

// 全体注記
export const generalNotes = [
	{
		note: "報告の際は、項目タイトル行は不要ですので削除してください。",
		source: "Googleスプレッドシート「nb-report-sample.xlsx」のセルA1コメント (2025年5月9日参照)"
	},
	{
		note: "著作権の消滅している楽曲もご報告ください。",
		source: "Googleスプレッドシート「nb-report-sample.xlsx」のセルH12コメント (2025年5月9日参照)"
	}
];

// TSVヘッダー（期待される順序）
export const expectedHeaders = [
	"インターフェイスキーコード", "コンテンツ区分", "コンテンツ枝番", 
	"メドレー区分", "メドレー枝番", "コレクトコード", 
	"ＪＡＳＲＡＣ作品コード", "原題名", "副題・邦題", 
	"作詞者名", "補作詞・訳詞者名", "作曲者名", 
	"編曲者名", "アーティスト名", "情報料（税抜）", 
	"ＩＶＴ区分", "原詞訳詞区分", "IL区分", "リクエスト回数"
]; 