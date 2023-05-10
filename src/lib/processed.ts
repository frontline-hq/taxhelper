import { type Readable, derived, get } from 'svelte/store';
import { initialData } from './database';
import { rulesString } from './rules';

const additionalEntriesTemplate = {
	taxCategory: '',
	vat19: '',
	vat7: '',
	vat0: '',
	needsAttachment: '',
	cancels: ''
};

export function rowIsProcessed(row: string[], header: string[]) {
	// does header contain the necessary fields?
	const additionalKeys = Object.keys(additionalEntriesTemplate);
	const columnValues: Record<string, number> = {};
	header.forEach((col, i) => {
		if (additionalKeys.includes(col)) columnValues[col] = i;
	});
	return Object.values(columnValues).some((i) => row[i] !== '');
}

export function rowIsOverDefined(row: string[], header: string[]) {
	// does header contain the necessary fields?
	const additionalKeys = Object.keys(additionalEntriesTemplate);
	const columnValues: Record<string, number> = {};
	header.forEach((col, i) => {
		if (additionalKeys.includes(col)) columnValues[col] = i;
	});
	return Object.values(columnValues).some((i) => row[i].includes(';'));
}

async function digestMessage(message: string) {
	const msgUint8 = new TextEncoder().encode(message); // encode as (utf-8) Uint8Array
	const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8); // hash the message
	const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
	return hashHex;
}

async function processData(data: string[][], rulesString: string) {
	if (data.length < 2) throw new Error('Data has unsufficient length');
	else {
		const rules = JSON.parse(rulesString);
		const headerRow = data[0];
		const newHeader = [...headerRow, ...Object.keys(additionalEntriesTemplate), 'UUID'];
		const newDataBody = await Promise.all(
			data.slice(1).map(async (row) => {
				const additionalEntries = {
					...additionalEntriesTemplate,
					uuid: await digestMessage(row.join(''))
				};
				for await (const rule of rules) {
					const {
						matchers,
						taxCategory,
						vat,
						needsAttachment,
						isCancellation
					}: {
						matchers: { column: string; regex: string; flags?: string }[];
						taxCategory?: string;
						vat?:
							| 19
							| 7
							| 0
							| [
									{ percent: 19; amount: string },
									{ percent: 7; amount: string },
									{ percent: 0; amount: string }
							  ];
						needsAttachment?: boolean;
						isCancellation?: boolean;
					} = rule;
					const amountColumn = headerRow.findIndex((column) => column === 'Betrag');
					const dateColumn = headerRow.findIndex((column) => column === 'Valutadatum');
					const usageColumn = headerRow.findIndex((column) => column === 'Verwendungszweck');
					// Does this row match this rule?
					// If yes, concatenate entries in each column, separated by ,
					const applicableIndexesWithMatchers = matchers.map((matcher) => {
						return {
							matcher,
							index: newHeader.findIndex((column) => matcher.column === column)
						};
					});
					const rowMatchesAll = applicableIndexesWithMatchers.every((indexWithMatcher) => {
						const columnValue = row[indexWithMatcher.index];
						const regex = new RegExp(
							indexWithMatcher.matcher.regex,
							indexWithMatcher.matcher.flags
						);
						return columnValue.match(regex) !== null;
					});
					let vat19 = amountColumn !== -1 && vat === 19 ? row[amountColumn] : '';
					let vat7 = amountColumn !== -1 && vat === 7 ? row[amountColumn] : '';
					let vat0 = amountColumn !== -1 && vat === 0 ? row[amountColumn] : '';
					if (vat !== undefined && typeof vat !== 'number') {
						vat19 =
							vat.find((t) => {
								t.percent === 19;
							})?.amount ?? '';
						vat7 =
							vat.find((t) => {
								t.percent === 7;
							})?.amount ?? '';
						vat0 =
							vat.find((t) => {
								t.percent === 0;
							})?.amount ?? '';
					}
					if (rowMatchesAll) {
						// If row is a cancellation, find the entry that it cancels.
						if (isCancellation) {
							const amount = row[amountColumn].startsWith('-')
								? row[amountColumn].slice(1)
								: '-' + row[amountColumn];
							const cancelledRow = data
								.slice(1)
								.find(
									(r) =>
										r !== row &&
										r[amountColumn] === amount &&
										row[usageColumn].includes(r[usageColumn]) &&
										new Date(r[dateColumn]).getTime() <= new Date(row[dateColumn]).getTime()
								);
							if (cancelledRow)
								additionalEntries.cancels = await digestMessage(cancelledRow.join(''));
						}
						if (taxCategory) additionalEntries.taxCategory += ';' + taxCategory;
						additionalEntries.vat19 += ';' + vat19;
						additionalEntries.vat7 += ';' + vat7;
						additionalEntries.vat0 += ';' + vat0;
						additionalEntries.needsAttachment +=
							';' + (needsAttachment === undefined ? 'false' : needsAttachment.toString());
					}
				}
				return [...row, ...Object.values(additionalEntries).map((e) => e.slice(1))];
			})
		);
		return [newHeader, ...newDataBody];
	}
}

export const processedData = derived<[Readable<string>, Readable<string[][]>], string[][]>(
	[rulesString, initialData],
	([$rulesString, $initialData], set) => {
		(async () => {
			try {
				if ($initialData.length < 2) set($initialData);
				else {
					const processed = await processData($initialData, $rulesString);
					set(processed);
				}
			} catch (error) {
				console.error(error);
				set($initialData);
			}
		})();
	}
);

export const processedDataBody = derived(processedData, ($processedData) => {
	return $processedData.slice(1);
});

export const processedDataHeader = derived(processedData, ($processedData) => {
	return $processedData[0];
});

export const countUnprocessed = derived(processedDataBody, ($processedDataBody) => {
	if ($processedDataBody.length === 0) return 0;
	const header = get(processedDataHeader);
	return $processedDataBody.filter((row) => !rowIsProcessed(row, header)).length;
});

export const countErroneous = derived(processedDataBody, ($processedDataBody) => {
	if ($processedDataBody.length === 0) return 0;
	const header = get(processedDataHeader);
	return $processedDataBody.filter((row) => rowIsOverDefined(row, header)).length;
});
