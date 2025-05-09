import * as Encoding from "encoding-japanese";

/**
 * UTF-8の文字列をShift-JIS (CP932) に変換する関数
 * @param text UTF-8の文字列
 * @returns Shift-JISにエンコードされたUint8Array
 */
export function convertToShiftJis(text: string): Uint8Array {
	// encoding-japanese を使用してUTF-8からShift-JISへ変換
	const unicodeArray = Encoding.stringToCode(text);
	const sjisArray = Encoding.convert(unicodeArray, {
		to: "SJIS",
		from: "UNICODE",
	});

	return new Uint8Array(sjisArray);
}

/**
 * Blob オブジェクトをShift-JISエンコードされたBlobに変換する関数
 * @param content 変換したい文字列コンテンツ
 * @param mimeType MIMEタイプ（デフォルトは 'text/tab-separated-values'）
 * @returns ShiftJISエンコードされたBlob
 */
export function createShiftJisBlob(
	content: string,
	mimeType = "text/tab-separated-values",
): Blob {
	const sjisArray = convertToShiftJis(content);
	return new Blob([sjisArray], { type: mimeType });
}

/**
 * ファイルをダウンロードする関数
 * @param blob ダウンロードするBlob
 * @param filename ファイル名
 */
export function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();

	// 不要なオブジェクトを解放
	window.setTimeout(() => {
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}, 0);
}
