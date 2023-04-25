<script lang="ts" context="module">
	import type Handsontable from 'handsontable';
	import type { GridSettings } from 'handsontable/settings';
</script>

<script lang="ts">
	export let options: GridSettings;
	export let data: string[][];
	let handson: Handsontable | undefined;
	$: handson?.updateData(data);
	function setHandsonStore(container: HTMLElement, options: GridSettings) {
		import('handsontable').then((HandsontableImport) => {
			handson = new HandsontableImport.default(container, options);
		});
	}
	function initHandson(container: HTMLElement) {
		setHandsonStore(container, { ...options, data });
		return {
			destroy() {
				handson?.destroy();
				handson = undefined;
			}
		};
	}
</script>

<div use:initHandson />
