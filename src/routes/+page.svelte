<script lang="ts">
	import HandsonTable from '$lib/HandsonTable.svelte';
	import { Button } from 'carbon-components-svelte';
	import { onMount } from 'svelte';
	import {
		JSONEditor,
		Mode,
		createAjvValidator,
		isJSONContent,
		isTextContent
	} from 'svelte-jsoneditor';
	import csv from 'csvtojson';
	import {
		createDatabase,
		getParsedFile,
		getRules,
		getTreeViewFilesFromDB,
		saveDirectoryToDB,
		setRules
	} from '$lib/database';
	import { TreeView } from 'carbon-components-svelte';
	import { derived, writable } from 'svelte/store';

	import { Tabs, Tab, TabContent } from 'carbon-components-svelte';
	import { getRulesSchema } from '$lib/rules';

	let tree: Awaited<ReturnType<typeof getTreeViewFilesFromDB>>;
	const dataHeader = writable<string[]>([]);
	const dataBody = writable<string[][]>([]);
	const data = derived([dataHeader, dataBody], ([dataHeader, dataBody]) => {
		return [dataHeader, ...dataBody];
	});
	const jsonMode = 'text' as Mode;
	$: schema =
		Array.isArray($dataHeader) && $dataHeader.length > 0
			? getRulesSchema({ columns: $dataHeader })
			: null;

	onMount(async () => {
		await createDatabase();
		tree = await getTreeViewFilesFromDB();
	});

	$: console.log(tree);

	$: options = {
		data: $data,
		readOnly: true,
		rowHeaders: true,
		colHeaders: false,
		height: 'auto',
		licenseKey: 'non-commercial-and-evaluation' // for non-commercial use only
	};
</script>

<div class="fixed inset-0 flex">
	<div class="h-full bg-gray-100 w-80">
		<Button on:click={saveDirectoryToDB}>Select a folder</Button>
		{#if tree}
			<TreeView
				children={tree.tree}
				expandedIds={tree.ids}
				on:select={async ({ detail }) => {
					if (detail.leaf) {
						const fileId = tree.idMap.get(detail.id);
						if (fileId) {
							const file = await getParsedFile(fileId);
							if (file) {
								csv({ delimiter: ';', output: 'csv' })
									.fromString(file.parsedString)
									.on('header', (header) => {
										dataHeader.set(header);
									})
									.then((csvRow) => {
										dataBody.set(csvRow);
									});
							}
						}
					}
				}}
			/>
		{/if}
	</div>
	<div class="flex flex-col w-full">
		<Tabs>
			<Tab label="Initial data" />
			<Tab label="Processed" />
			<Tab label="Tab label 3" />
			<svelte:fragment slot="content">
				<TabContent class="overflow-scroll">
					{#if $dataHeader.length > 0 && $dataBody.length > 0}
						<HandsonTable {options} data={$data} />
					{/if}
				</TabContent>
				<TabContent>Content 2</TabContent>
				<TabContent>Content 3</TabContent>
			</svelte:fragment>
		</Tabs>
		<div class="h-40vh">
			{#if schema}
				{#await getRules() then rules}
					<JSONEditor
						mode={jsonMode}
						onChange={(content, previousContent, { contentErrors, patchResult }) => {
							if (!contentErrors) {
								if (isTextContent(content)) setRules(content.text);
								else setRules(JSON.stringify(content.json));
								console.log('blue');
							}
						}}
						content={{ text: rules }}
						validator={createAjvValidator({ schema })}
					/>
				{/await}
			{/if}
		</div>
	</div>
</div>
