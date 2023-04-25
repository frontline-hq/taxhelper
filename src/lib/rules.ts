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

const taxCategories = ['Versicherungen (privat)'] as const;

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
				taxCategory: specify ? { enum: taxCategories } : { type: 'string' },
				needsAttachment: { type: 'boolean' },
				temporary: { type: 'boolean' }
			},
			required: ['matchers', 'taxCategory'],
			oneOf: [
				{
					properties: {
						tax: { enum: [7, 19] }
					},
					required: ['tax']
				},
				{
					properties: {
						tax: {
							type: 'array',
							items: {
								type: 'object',
								properties: {
									percent: { enum: [7, 19] },
									amount: { type: 'number' }
								},
								required: ['percent', 'amount']
							},
							minItems: 1
						}
					},
					required: ['tax']
				}
			]
		}
	};
}
