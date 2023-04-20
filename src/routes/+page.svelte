<script lang="ts">
	import HandsonTable from '$lib/HandsonTable.svelte';
	import SideBar from '$lib/SideBar.svelte';
	import { Button } from 'carbon-components-svelte';
	import { onMount } from 'svelte';
	import csv from 'csvtojson';
	import {
		createDatabase,
		getParsedFile,
		getTreeViewFilesFromDB,
		saveDirectoryToDB
	} from '$lib/database';
	import { TreeView } from 'carbon-components-svelte';
	import { derived, writable } from 'svelte/store';

	let tree: Awaited<ReturnType<typeof getTreeViewFilesFromDB>>;
	const dataHeader = writable<string[]>([]);
	const dataBody = writable<string[][]>([]);
	const data = derived([dataHeader, dataBody], ([dataHeader, dataBody]) => {
		return [dataHeader, ...dataBody];
	});

	onMount(async () => {
		await createDatabase();
		tree = await getTreeViewFilesFromDB();
	});

	$: options = {
		data: $data,
		rowHeaders: true,
		colHeaders: false,
		height: 'auto',
		licenseKey: 'non-commercial-and-evaluation' // for non-commercial use only
	};
</script>

<div class="flex w-full min-h-screen">
	<SideBar>
		<Button on:click={saveDirectoryToDB}>Select a folder</Button>
		{#if tree}
			<TreeView
				children={tree.tree}
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
	</SideBar>
	{#if $dataHeader.length > 0 && $dataBody.length > 0}
		<HandsonTable {options} data={$data} />
	{/if}
</div>
