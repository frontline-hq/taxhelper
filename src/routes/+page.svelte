<script lang="ts">
	import HandsonTable, { greenRowRenderer, redRowRenderer } from '$lib/HandsonTable.svelte';
	import type { CellProperties, GridSettings } from 'handsontable/settings';
	import { Button } from 'carbon-components-svelte';
	import { onMount } from 'svelte';
	import { JSONEditor, Mode, createAjvValidator, isTextContent } from 'svelte-jsoneditor';
	import csv from 'csvtojson';
	import {
		createDatabase,
		getParsedFile,
		getRules,
		getTreeViewFilesFromDB,
		saveDirectoryToDB,
		setRules,
		initialData,
		initialDataBody,
		initialDataHeader
	} from '$lib/database';
	import { rulesSchema } from '$lib/rules';
	import { TreeView } from 'carbon-components-svelte';
	import { Tabs, Tab, TabContent } from 'carbon-components-svelte';
	import {
		processedData,
		rowIsProcessed,
		countUnprocessed,
		processedDataHeader,
		processedDataBody,
		rowIsOverDefined,
		countErroneous
	} from '$lib/processed';

	let fileTree: Awaited<ReturnType<typeof getTreeViewFilesFromDB>>;
	const jsonMode = 'text' as Mode;

	onMount(async () => {
		await createDatabase();
		fileTree = await getTreeViewFilesFromDB();
	});

	$: initialDataHandsonOptions = {
		readOnly: true,
		rowHeaders: true,
		colHeaders: $initialDataHeader,
		height: '50vh',
		licenseKey: 'non-commercial-and-evaluation' // for non-commercial use only
	};

	$: processedDataHandsonOptions = {
		readOnly: true,
		rowHeaders: true,
		colHeaders: $processedDataHeader,
		height: '50vh',
		cells: (row) => {
			const cellProperties = {} as CellProperties;
			if (rowIsOverDefined($processedDataBody[row], $processedDataHeader))
				cellProperties.renderer = redRowRenderer;
			else if (rowIsProcessed($processedDataBody[row], $processedDataHeader))
				cellProperties.renderer = greenRowRenderer;
			return cellProperties;
		},
		licenseKey: 'non-commercial-and-evaluation' // for non-commercial use only
	} as GridSettings;
</script>

<div class="fixed inset-0 flex">
	<div class="h-full bg-gray-100 w-80">
		<Button on:click={saveDirectoryToDB}>Select a folder</Button>
		{#if fileTree}
			<TreeView
				children={fileTree.tree}
				expandedIds={fileTree.ids}
				on:select={async ({ detail }) => {
					if (detail.leaf) {
						const fileId = fileTree.idMap.get(detail.id);
						if (fileId) {
							const file = await getParsedFile(fileId);
							if (file) {
								csv({ delimiter: ';', output: 'csv' })
									.fromString(file.parsedString)
									.on('header', (header) => {
										initialDataHeader.set(header);
									})
									.then((csvRow) => {
										initialDataBody.set(csvRow);
									});
							}
						}
					}
				}}
			/>
		{/if}
	</div>
	<div class="flex flex-col w-full justify-end">
		<Tabs class="flex-none" autoWidth>
			<Tab label="Initial data" />
			<Tab label={`Processed, ${$countUnprocessed} remaining, ${$countErroneous} errors`} />
			<Tab label="Tab label 3" />
			<svelte:fragment slot="content">
				<TabContent class="overflow-scroll">
					{#if $initialDataHeader.length > 0 && $initialDataBody.length > 0}
						<HandsonTable options={initialDataHandsonOptions} data={$initialDataBody} />
					{/if}
				</TabContent>
				<TabContent class="overflow-scroll">
					{#if $processedData}
						<HandsonTable options={processedDataHandsonOptions} data={$processedDataBody} />
					{/if}
				</TabContent>
				<TabContent>Content 3</TabContent>
			</svelte:fragment>
		</Tabs>
		<div class="flex-1 overflow-hidden">
			{#if $rulesSchema}
				{#await getRules() then rules}
					<JSONEditor
						mode={jsonMode}
						onChange={(content, previousContent, { contentErrors, patchResult }) => {
							if (!contentErrors) {
								if (isTextContent(content)) setRules(content.text);
								else setRules(JSON.stringify(content.json));
							}
						}}
						content={{ text: rules }}
						validator={createAjvValidator({ schema: $rulesSchema })}
					/>
				{/await}
			{/if}
		</div>
	</div>
</div>
