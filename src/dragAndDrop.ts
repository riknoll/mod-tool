import { uint8ArrayToString } from "./util";

export function setupDragAndDrop(r: HTMLElement, filter: (file: File) => boolean, dragged: (files: File[]) => void) {
    r.addEventListener('paste', function (e: ClipboardEvent) {
        if (e.clipboardData) {
            // has file?
            let files: File[] = [];
            for (let i = 0; i < e.clipboardData.files.length; i++) {
                if (e.clipboardData.files.item(i)) files.push(e.clipboardData.files.item(i) as File);
            }
            files = files.filter(filter);
            if (files.length > 0) {
                e.stopPropagation(); // Stops some browsers from redirecting.
                e.preventDefault();
                dragged(files);
            }
            // has item?
            else if (e.clipboardData.items && e.clipboardData.items.length > 0) {
                let f = e.clipboardData.items[0].getAsFile()
                if (f) {
                    e.stopPropagation(); // Stops some browsers from redirecting.
                    e.preventDefault();
                    dragged([f])
                }
            }
        }
    })
    r.addEventListener('dragover', function (e: DragEvent) {
        if (e.dataTransfer) {
            let types = e.dataTransfer.types;
            let found = false;
            for (let i = 0; i < types.length; ++i)
                if (types[i] === "Files")
                    found = true;
            if (found) {
                if (e.preventDefault) e.preventDefault(); // Necessary. Allows us to drop.
                e.dataTransfer.dropEffect = 'copy';  // See the section on the DataTransfer object.
                return false;
            }
        }
        return true;
    }, false);
    r.addEventListener('drop', function (e: DragEvent) {
        if (e.dataTransfer) {
            const files: File[] = [];
            for (let i = 0; i < e.dataTransfer.files.length; i++) {
                if (e.dataTransfer.files.item(i)) files.push(e.dataTransfer.files.item(i) as File);
            }
            if (files.length > 0) {
                e.stopPropagation(); // Stops some browsers from redirecting.
                e.preventDefault();
                dragged(files);
            }
        }
        return false;
    }, false);
    r.addEventListener('dragend', function (e: DragEvent) {
        return false;
    }, false);
}

export function fileReadAsBufferAsync(f: File): Promise<Uint8Array | null> { // ArrayBuffer
    if (!f)
        return Promise.resolve<Uint8Array | null>(null);
    else {
        return new Promise<Uint8Array | null>((resolve, reject) => {
            let reader = new FileReader();
            reader.onerror = (ev) => resolve(null);
            reader.onload = (ev) => resolve(new Uint8Array(reader.result as ArrayBuffer));
            reader.readAsArrayBuffer(f);
        });
    }
}

export function fileReadAsTextAsync(f: File): Promise<string | null> {
    if (!f)
        return Promise.resolve<string| null>(null);
    else {
        return new Promise<string | null>((resolve, reject) => {
            let reader = new FileReader();
            reader.onerror = (ev) => resolve(null);
            reader.onload = (ev) => resolve(reader.result as string);
            reader.readAsText(f);
        });
    }
}

export async function decodePNG(file: File) {
    const buffer = await fileReadAsBufferAsync(file);
    if (!buffer) return;

    return decodeBlobAsync("data:image/png;base64," + btoa(uint8ArrayToString(buffer)));
}

async function decodeBlobAsync(dataURL: string) {
    const canvas = await loadCanvasAsync(dataURL);

    const ctx = canvas.getContext("2d")!
    const imgdat = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const d = imgdat.data
    const bpp = (d[0] & 1) | ((d[1] & 1) << 1) | ((d[2] & 1) << 2)
    // Safari sometimes just reads a buffer full of 0's so we also need to bail if bpp == 0
    if (bpp > 5 || bpp === 0)
        return Promise.reject(new Error("Invalid encoded PNG format"))

    function decode(ptr: number, bpp: number, trg: Uint8Array) {
        let shift = 0
        let i = 0
        let acc = 0
        const mask = (1 << bpp) - 1
        while (i < trg.length) {
            acc |= (d[ptr++] & mask) << shift
            if ((ptr & 3) == 3)
                ptr++ // skip alpha
            shift += bpp
            if (shift >= 8) {
                trg[i++] = acc & 0xff
                acc >>= 8
                shift -= 8
            }
        }
        return ptr
    }

    const hd = new Uint8Array(imageHeaderSize)
    let ptr = decode(4, bpp, hd)
    const dhd = decodeU32LE(hd)
    if (dhd[0] !== imageMagic)
        return Promise.reject(new Error("Invalid magic in encoded PNG"))
    const res = new Uint8Array(dhd[1])
    const addedLines = dhd[2]
    if (addedLines > 0) {
        const origSize = (canvas.height - addedLines) * canvas.width
        const imgCap = (origSize - 1) * 3 * bpp >> 3
        const tmp = new Uint8Array(imgCap - imageHeaderSize)
        decode(ptr, bpp, tmp)
        res.set(tmp)
        const added = new Uint8Array(res.length - tmp.length)
        decode(origSize * 4, 8, added)
        res.set(added, tmp.length)
    } else {
        decode(ptr, bpp, res)
    }
    return res
}

function loadImageAsync(data: string): Promise<HTMLImageElement | undefined> {
    const img = document.createElement("img")
    return new Promise<HTMLImageElement | undefined>((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = () => resolve(undefined);
        img.crossOrigin = "anonymous";
        img.src = data;
    });
}

function loadCanvasAsync(url: string): Promise<HTMLCanvasElement> {
    return loadImageAsync(url)
        .then(img => {
            const canvas = document.createElement("canvas")
            canvas.width = img!.width
            canvas.height = img!.height
            const ctx = canvas.getContext("2d")
            ctx!.drawImage(img!, 0, 0);
            return canvas;
        })
}

function read32(buf: ArrayLike<number>, pos: number) {
    return (buf[pos] | (buf[pos + 1] << 8) | (buf[pos + 2] << 16) | (buf[pos + 3] << 24)) >>> 0
}

function decodeU32LE(buf: Uint8Array) {
    let res: number[] = []
    for (let i = 0; i < buf.length; i += 4)
        res.push(read32(buf, i))
    return res
}

const imageMagic = 0x59347a7d // randomly selected
const imageHeaderSize = 36 // has to be divisible by 9