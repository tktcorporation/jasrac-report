declare module "encoding-japanese" {
	export function convert(
		data: number[] | Uint8Array,
		options: {
			to: string;
			from: string;
		},
	): number[];

	export function detect(
		data: number[] | Uint8Array | string,
		options?: {
			suspected?: string | string[];
		},
	): string;

	export function escape(data: string, form: string): string;

	export function stringToCode(string: string): number[];

	export function codeToString(data: number[] | Uint8Array): string;

	export function base64encode(data: number[] | Uint8Array): string;

	export function base64decode(base64: string, returnType?: string): number[];

	export function urlEncode(data: number[] | Uint8Array): string;

	export function urlDecode(url: string): number[];
}
