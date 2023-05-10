<script lang="ts" context="module">
	import type Handsontable from 'handsontable';
	import type { Renderers } from 'handsontable/renderers';
	import type { GridSettings } from 'handsontable/settings';
	import { writable, get } from 'svelte/store';
	export const textRenderer = writable<Renderers['text']>();

	export const greenRowRenderer = ((instance, td, ...rest) => {
		if (get(textRenderer)) get(textRenderer).apply(this, [instance, td, ...rest]);
		//td.style.fontWeight = 'bold';
		td.style.color = 'green';
		td.style.background = '#CEC';
	}) satisfies Renderers['text'];
	export const redRowRenderer = ((instance, td, ...rest) => {
		if (get(textRenderer)) get(textRenderer).apply(this, [instance, td, ...rest]);
		//td.style.fontWeight = 'bold';
		td.style.color = 'red';
		td.style.background = '#FFB3B3';
	}) satisfies Renderers['text'];
</script>

<script lang="ts">
	import { browser } from '$app/environment';
	export let options: GridSettings;
	export let data: string[][];
	$: browser &&
		import('handsontable/renderers').then(({ textRenderer: tr }) => {
			textRenderer.set(tr);
		});
	let handson: Handsontable | undefined;
	$: handson?.updateData(data);
	$: handson?.updateSettings(options);
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
