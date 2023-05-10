/* const jsonData = [
    {
        matchers: [
            {
                column: 'colName',
                regex: '',
                // optional
                flags: ''
            }
        ],
        taxCategory: 'category',
        tax: 19 || [
            {
                percent: 19,
                amount: 40
            }
        ],
        // below all optional
        needsAttachment: true,
        temporary: true
    }
]; */

import { derived, type Readable, type Unsubscriber } from 'svelte/store';
import { initialDataHeader, database, getProjectDocument } from './database';

export const rulesString: Readable<string> = {
	subscribe: (run) => {
		let rxdbUnsubscriber: Unsubscriber | undefined;
		const databaseUnsubscriber = database.subscribe(async ($database) => {
			if ($database) {
				if (rxdbUnsubscriber) rxdbUnsubscriber();
				const doc = await getProjectDocument('default project');
				rxdbUnsubscriber = doc
					.get$('rules')
					.subscribe((newRules: string) => run(newRules)).unsubscribe;
			} else {
				run('[]');
			}
		});
		return () => {
			databaseUnsubscriber();
			if (rxdbUnsubscriber) rxdbUnsubscriber();
		};
	}
};

const taxCategories = [
	'Versicherungen (privat)',
	'Privat',
	'Kontoführung/Kartengebühr',
	'Geldtransit',
	'Miete/Pacht',
	'Krankheitskosten',
	'Nettogehälter',
	'Mobil',
	'Festnetz',
	'Internet',
	'Lizenzen und Konzessionen',
	'Sozialabgaben',
	'Privatentnahmen',
	'Fremdleistungen §13b',
	'Umsatzsteuer-Vorauszahlungen',
	'Dienstleister',
	'Privateinlagen',
	'Fahrtkosten',
	'Sonstige Ausgaben'
] as const;

export const rulesSchema = derived(initialDataHeader, ($dataHeader) => {
	return Array.isArray($dataHeader) && $dataHeader.length > 0
		? getRulesSchema({ columns: $dataHeader })
		: null;
});

export function getRulesSchema(specify?: { columns: string[] }) {
	return {
		type: 'array',
		items: {
			type: 'object',
			properties: {
				matchers: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							column: specify?.columns ? { enum: specify.columns } : { type: 'string' },
							regex: { type: 'string' },
							flags: { type: 'string' }
						},
						required: ['column', 'regex']
					}
				},
				needsAttachment: { type: 'boolean' },
				temporary: { type: 'boolean' }
			},
			required: ['matchers'],
			oneOf: [
				{
					properties: {
						vat: { enum: [0, 7, 19] },
						taxCategory: specify ? { enum: taxCategories } : { type: 'string' }
					},
					required: ['vat', 'taxCategory']
				},
				{
					properties: {
						vat: {
							type: 'array',
							items: {
								type: 'object',
								properties: {
									percent: { enum: [0, 7, 19] },
									amount: { type: 'number' }
								},
								required: ['percent', 'amount']
							},
							minItems: 1
						},
						taxCategory: specify ? { enum: taxCategories } : { type: 'string' }
					},
					required: ['vat', 'taxCategory']
				},
				{
					properties: {
						isCancellation: { type: 'boolean' }
					},
					required: ['isCancellation']
				}
			]
		}
	};
}
