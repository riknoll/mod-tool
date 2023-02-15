const PATCH_DB_NAME = "APPROVED_DB";
let _db: IDBDatabase;
let openPromise: Promise<IDBDatabase>;

interface StringEntry {
    str: string;
    approved: boolean;
    time: number
}

async function initDBAsync() {
    if (_db) return _db;

    if (!openPromise) {
        openPromise = new Promise((resolve, reject) => {

            const request = indexedDB.open(PATCH_DB_NAME, 2);

            request.onerror = event => {
                reject();
            };

            request.onupgradeneeded = event => {
                const db = request.result;
                const objectStore = db.createObjectStore(
                    "approved",
                    {
                        keyPath: "str"
                    }
                );
                objectStore.createIndex("str", "str", { unique: true });
                objectStore.createIndex("approved", "approved", { unique: false });
                objectStore.createIndex("time", "time", { unique: false });
            };

            request.onsuccess = event => {
                _db = request.result;
                resolve(_db);
            }
        });
    }

    return openPromise;
}

async function lookupEntryAsync(str: string): Promise<StringEntry | undefined> {
    const db = await initDBAsync();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["approved"], "readwrite");
        const objectStore = transaction.objectStore("approved");
        const request = objectStore.get(str) as IDBRequest<StringEntry>;
        request.onerror = event => {
            reject();
        };
        request.onsuccess = event => {
            resolve(request.result);
        };
    })
}

async function addEntryAsync(str: string, approved: boolean): Promise<void> {
    const db = await initDBAsync();

    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(["approved"], "readwrite");
        const objectStore = transaction.objectStore("approved");
        const request = objectStore.add({
            str,
            approved,
            time: Date.now()
        });
        request.onerror = event => {
            reject();
        };
        request.onsuccess = event => {
            resolve()
        };
    })
}


export async function isStringApprovedAsync(str: string) {
    const entry = await lookupEntryAsync(str);

    if (entry) return entry.approved;
    return false;
}

export async function markStringApprovedAsync(str: string) {
    await addEntryAsync(str, true);
}
