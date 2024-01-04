import { lzmaCompressAsync } from "./lzma";
import { ScriptMeta, httpGetJSONAsync } from "./share";
import { browserDownloadDataUri } from "./util";

const backendEndpoint = "https://makecode.com/api";

export async function encodeIntoPng(imageURI: string, shareUrl: string) {
    const canvas = await loadCanvasAsync(imageURI);
    let scriptID = shareUrl.trim();

    if (scriptID.indexOf("/") !== -1) {
        scriptID = scriptID.substr(scriptID.lastIndexOf("/") + 1)
    }

    const meta: ScriptMeta = await httpGetJSONAsync(backendEndpoint + "/" + scriptID);

    // A mapping of filenames to filecontents
    const filesystem: {[index: string]: string} = await httpGetJSONAsync(backendEndpoint + "/" + scriptID + "/text");

    const project = {
        meta: {
            cloudId: "pxt/arcade",
            targetVersions: {},
            name: meta.name,
            editor: meta.editor
        },
        source: JSON.stringify(filesystem)
    };

    const blob = await lzmaCompressAsync(JSON.stringify(project));

    const encoded = encodeProjectAsPNG(canvas, blob);

    browserDownloadDataUri(encoded.toDataURL("png"), "encoded.png")
}

export function loadImageAsync(data: string): Promise<HTMLImageElement> {
    const img = document.createElement("img")
    return new Promise<HTMLImageElement>((resolve, reject) => {
        img.onload = () => resolve(img);
        img.crossOrigin = "anonymous";
        img.src = data;
    });
}

export function loadCanvasAsync(url: string): Promise<HTMLCanvasElement> {
    return loadImageAsync(url)
        .then(img => {
            const canvas = document.createElement("canvas")
            canvas.width = img.width
            canvas.height = img.height
            const ctx = canvas.getContext("2d")!
            ctx.drawImage(img, 0, 0);
            return canvas;
        })
}


export const imageMagic = 0x59347a7d // randomly selected
export const imageHeaderSize = 36 // has to be divisible by 9
export function encodeProjectAsPNG(canvas: HTMLCanvasElement, blob: Uint8Array) {
    const neededBytes = imageHeaderSize + blob.length
    const usableBytes = (canvas.width * canvas.height - 1) * 3
    let bpp = 1
    while (bpp < 4) {
        if (usableBytes * bpp >= neededBytes * 8)
            break
        bpp++
    }
    let imgCapacity = (usableBytes * bpp) >> 3
    let missing = neededBytes - imgCapacity
    let addedLines = 0
    let addedOffset = canvas.width * canvas.height * 4
    if (missing > 0) {
        const bytesPerLine = canvas.width * 3
        addedLines = Math.ceil(missing / bytesPerLine)
        const c2 = document.createElement("canvas")
        c2.width = canvas.width
        c2.height = canvas.height + addedLines
        const ctx = c2.getContext("2d")!
        ctx.drawImage(canvas, 0, 0)
        canvas = c2
    }

    let header = encodeU32LE([
        imageMagic,
        blob.length,
        addedLines,
        0,
        0,
        0,
        0,
        0,
        0,
    ])

    function encode(img: Uint8ClampedArray, ptr: number, bpp: number, data: ArrayLike<number>) {
        let shift = 0
        let dp = 0
        let v = data[dp++]
        const bppMask = (1 << bpp) - 1
        let keepGoing = true
        while (keepGoing) {
            let bits = (v >> shift) & bppMask
            let left = 8 - shift
            if (left <= bpp) {
                if (dp >= data.length) {
                    if (left == 0) break
                    else keepGoing = false
                }
                v = data[dp++]
                bits |= (v << left) & bppMask
                shift = bpp - left
            } else {
                shift += bpp
            }
            img[ptr] = ((img[ptr] & ~bppMask) | bits) & 0xff
            ptr++
            if ((ptr & 3) == 3) {
                // set alpha to 0xff
                img[ptr++] = 0xff
            }
        }
        return ptr
    }

    const ctx = canvas.getContext("2d")!
    const imgdat = ctx.getImageData(0, 0, canvas.width, canvas.height)

    // first pixel holds bpp (LSB are written first, so we can skip what it writes in second and third pixel)
    encode(imgdat.data, 0, 1, [bpp])
    let ptr = 4
    // next, the header
    ptr = encode(imgdat.data, ptr, bpp, header)
    if (addedLines === 0)
        ptr = encode(imgdat.data, ptr, bpp, blob)
    else {
        let firstChunk = imgCapacity - header.length
        ptr = encode(imgdat.data, ptr, bpp, blob.slice(0, firstChunk))
        ptr = encode(imgdat.data, addedOffset, 8, blob.slice(firstChunk))
    }
    // set remaining alpha
    ptr |= 3
    while (ptr < imgdat.data.length) {
        imgdat.data[ptr] = 0xff
        ptr += 4
    }

    ctx.putImageData(imgdat, 0, 0)
    return canvas;
}

export function write32(buf: Uint8Array, pos: number, v: number) {
    buf[pos + 0] = (v >> 0) & 0xff;
    buf[pos + 1] = (v >> 8) & 0xff;
    buf[pos + 2] = (v >> 16) & 0xff;
    buf[pos + 3] = (v >> 24) & 0xff;
}

export function encodeU32LE(words: number[]) {
    let r = new Uint8Array(words.length * 4)
    for (let i = 0; i < words.length; ++i)
        write32(r, i * 4, words[i])
    return r
}