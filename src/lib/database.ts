import { createRxDatabase, addRxPlugin, type RxDocument } from 'rxdb';
import { csv } from 'd3';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { writable, get } from 'svelte/store';
import { RxDBMigrationPlugin } from 'rxdb/plugins/migration';
import { directoryOpen } from 'browser-fs-access';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { getRulesSchema } from './rules';
addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBMigrationPlugin);

const mySchema = {
	title: 'project schema',
	version: 0,
	primaryKey: 'projectId',
	type: 'object',
	properties: {
		projectId: {
			type: 'string',
			maxLength: 100
		},
		files: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					id: {
						type: 'string'
					},
					parsedString: {
						type: 'string'
					}
				}
			}
		},
		rules: { type: 'string' }
	},
	required: ['projectId', 'dirHandle']
};

export const database = writable<undefined | Awaited<ReturnType<typeof createDatabase>>>();

export async function createDatabase() {
	const db = await createRxDatabase({
		name: 'taxhelper',
		storage: getRxStorageDexie()
	});
	await db.addCollections({
		projects: {
			schema: mySchema
		}
	});
	// Find document showing the necessary data or create it
	database.set(db);

	return db;
}

export const getProjectDocument = async (id: string) => {
	const db = get(database);
	if (db) {
		return ((await db.projects
			.findOne({
				selector: {
					projectId: id
				}
			})
			.exec()) ??
			db.projects.insert({
				projectId: id
			})) as RxDocument;
	}
	throw Error('database is not defined');
};

export const getRules = async () => {
	const doc = await getProjectDocument('default project');
	return (doc.get('rules') as string) ?? '[]';
};

export const setRules = async (rules: string) => {
	const doc = await getProjectDocument('default project');
	doc.update({
		$set: {
			rules: rules
		}
	});
};

export const getParsedFiles = async () => {
	const doc = await getProjectDocument('default project');
	return doc.get('files') as { id: string; parsedString: string }[] | undefined;
};

export const getParsedFile = async (id: string) => {
	const files = (await getParsedFiles()) ?? [];
	return files.find((file) => (file.id = id));
};

export const setParsedFiles = async (parsedFiles: { id: string; parsedString: string }[]) => {
	const doc = await getProjectDocument('default project');
	return await doc.update({
		$set: {
			files: parsedFiles
		}
	});
};

export async function saveDirectoryToDB() {
	const blobs = await directoryOpen({ id: 'taxhelper', recursive: true });
	const parsedFiles = await Promise.all(
		(blobs as File[])
			.filter((blob) => blob.webkitRelativePath.endsWith('.csv'))
			.map(async (blob) => {
				const parsed = await blob.text();
				return {
					id: blob.webkitRelativePath,
					parsedString: parsed
				};
			})
	);
	await setParsedFiles(parsedFiles);
}

type TreeEntry = { text: string; id: number; children?: Array<TreeEntry> };

export async function getTreeViewFilesFromDB() {
	const tree = { children: [], text: 'base', id: 0 } as TreeEntry;
	let i = 0;
	const ids: number[] = [];
	const treeFilesIdMap = new Map<number | string, string>();
	const parsedFiles = (await getParsedFiles()) ?? [];
	parsedFiles.forEach((a) => {
		let parent = tree;
		a.id.split('/').forEach((id) => {
			if (!parent.children) {
				parent.children = [];
			}
			let newParentNode = parent.children.find((p) => p.text === id);
			if (!newParentNode) {
				parent.children.push({ text: id, id: i });
				ids.push(i);
				newParentNode = parent.children.at(-1);
			}
			if (newParentNode) parent = newParentNode;
			i++;
		});
		treeFilesIdMap.set(i - 1, a.id);
	});
	return { tree: tree.children, idMap: treeFilesIdMap, ids };
}

export async function parseCsvFile(blob: File) {
	if (!blob.webkitRelativePath.endsWith('.csv')) throw new Error('File to parse must be .csv file');
	const text = blob.toString();
	const data = csv(text);
	return data;
}
