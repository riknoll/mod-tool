import { ignoredValues } from "./ignoredfields";
import { getJRESImageFromDataString, getJRESImageFromImageLiteral, JRESImage } from "./images";
import { IMAGE_MIME_TYPE } from "./util";

const backendEndpoint = "https://makecode.com/api";

export interface JRes {
    id: string; // something like "sounds.bark"
    data: string;
    dataEncoding?: string; // must be "base64" or missing (meaning the same)
    icon?: string; // URL (usually data-URI) for the icon
    namespace?: string; // used to construct id
    mimeType: string;
    tilemapTile?: boolean;
    tileset?: string[];
}

export const arcadePalette = [
    "#000000",
    "#ffffff",
    "#ff2121",
    "#ff93c4",
    "#ff8135",
    "#fff609",
    "#249ca3",
    "#78dc52",
    "#003fad",
    "#87f2ff",
    "#8e2ec4",
    "#a4839f",
    "#5c406c",
    "#e5cdc4",
    "#91463d",
    "#000000"
];

/*
{
    "kind": "script",
    "id": "62736-71028-62577-28752",
    "shortid": "_UAVXEwU7RAew",
    "time": 1595883166,
    "name": "Untitled",
    "description": "Made with ❤️ in Microsoft MakeCode Arcade.",
    "target": "arcade",
    "editor": "tsprj",
    "meta": {
        "versions": {
            "branch": "v1.0.14",
            "tag": "v1.0.14",
            "commits": "https://github.com/microsoft/pxt-arcade/commits/1460ac1c88950799eb51c9c297588c8abdc91077",
            "target": "1.0.14",
            "pxt": "6.1.41"
        },
        "blocksHeight": 0,
        "blocksWidth": 0
    },
    "thumb": false
}
*/

export interface ScriptMeta {
    kind: "script";
    id: string;
    shortid: string;
    time: number;
    name: string;
    description: string;
    target: string;
    editor: string;
    meta: {
        versions: {
            branch: string;
            tag: string;
            commits: string;
            target: string;
            pxt: string;
        };
        blocksHeight: number;
        blocksWidth: number;
    };
    thumb: boolean;
    isdeleted?: boolean;
}

export interface ScriptInfo {
    meta: ScriptMeta;
    files: {[index: string]: string};
    text: string[];
    customPalette?: string[];
    images: JRESImage[];
}

export interface ImportedScriptInfo {
    meta?: ScriptMeta;
    files: {[index: string]: string};
    text: BlockFields;
    customPalette?: string[];
    projectImages: JRESImage[];
}


export async function fetchMakeCodeScriptAsync(url: string): Promise<ImportedScriptInfo> {
    // https://makecode.com/_UAVXEwU7RAew
    // https://arcade.makecode.com/62736-71028-62577-28752
    let scriptID = url.trim();

    if (scriptID.indexOf("/") !== -1) {
        scriptID = scriptID.substr(scriptID.lastIndexOf("/") + 1)
    }

    const meta: ScriptMeta = await httpGetJSONAsync(backendEndpoint + "/" + scriptID);

    // A mapping of filenames to filecontents
    const filesystem: {[index: string]: string} = await httpGetJSONAsync(backendEndpoint + "/" + scriptID + "/text");

    const config = filesystem["pxt.json"];

    let palette = arcadePalette;
    let paletteIsCustom = false;

    if (config) {
        try {
            let parsedConfig = JSON.parse(config);

            if (parsedConfig?.palette && Array.isArray(parsedConfig.palette)) {
                palette = parsedConfig.palette.slice()
                paletteIsCustom = true;
            }
        }
        catch (e) {
            // ignore
        }
    }

    const projectImages = grabImagesFromProject(filesystem);

    return {
        meta,
        files: filesystem,
        projectImages: projectImages,
        text: grabTextFromProject(filesystem),
        customPalette: paletteIsCustom ? palette : undefined
    };
}

export async function parseProject(filesystem: {[index: string]: string}): Promise<ImportedScriptInfo> {
    const config = filesystem["pxt.json"];

    let palette = arcadePalette;
    let paletteIsCustom = false;

    if (config) {
        try {
            let parsedConfig = JSON.parse(config);

            if (parsedConfig?.palette && Array.isArray(parsedConfig.palette)) {
                palette = parsedConfig.palette.slice()
                paletteIsCustom = true;
            }
        }
        catch (e) {
            // ignore
        }
    }

    const projectImages = grabImagesFromProject(filesystem);

    return {
        files: filesystem,
        projectImages: projectImages,
        text: grabTextFromProject(filesystem),
        customPalette: paletteIsCustom ? palette : undefined
    };
}


export interface BlockFields {
    variableNames: string[];
    assetNames: string[];
    other: string[];
}

export function grabTextFromProject(filesystem: {[index: string]: string}): BlockFields {
    const blocks = filesystem["main.blocks"];
    let strings: string[] = [];
    let variableNames: string[] = [];
    let assetNames: string[] = [];

    const literalRegex = /\s*img\s*`[\s\da-fA-F.#tngrpoywTNGRPOYW]*`\s*/m;
    const numbersymbol = /^[+.\s\d-]*$/

    ignoredValues.forEach(i => {
        if (i.startsWith("Sprite.")) {
            ignoredValues.push(i + "@set")
        }
    });

    if (blocks) {
        const xml = new DOMParser().parseFromString(blocks, "text/xml");
        const fields = xml.getElementsByTagName("field");
        for (let i = 0; i < fields.length; i++) {
            console.log(fields.item(i)!.getAttribute("name"));
            const content = fields.item(i)!.textContent?.trim();
            if (!content || numbersymbol.test(content) || literalRegex.test(content) || ignoredValues.indexOf(content) !== -1) continue;

            const fieldName = fields.item(i)!.getAttribute("name")
            if (fieldName === "VAR") {
                variableNames.push(content);
            }
            else {
                const match = /^(?:assets\s*.)?\s*(?:(?:tilemap)|(?:image)|(?:tile)|(?:animation))\s*`([^`]+)`\s*$/.exec(content);
                if (match) {
                    if (/(?:myImage|tile|level|myAnim)\d+/.test(match[1])) continue;
                    assetNames.push(match[1]);
                }
                else {
                    strings.push(content);
                }
            }
        }

        const comments = xml.getElementsByTagName("comment");
        for (let i = 0; i < comments.length; i++) {
            const content = comments.item(i)!.textContent;
            if (content && !/^[0-9\s]*$/.test(content) && !literalRegex.test(content) && !numbersymbol.test(content) && ignoredValues.indexOf(content) === -1) {
                strings.push(content.trim());
            }
        }
    }

    for (const file of Object.keys(filesystem)) {
        if (file.endsWith(".ts") && !file.endsWith(".gen.ts")) {
            strings.push(...grabCommentsAndStringsFromTypeScript(filesystem[file]));
        }
    }

    let seenStrings: {[index: string]: boolean} = {};

    const dedupe = (strings: string[]) => {
        const out: string[] = []
        strings.forEach(s => {
            if (seenStrings[s]) {
                return;
            }
            seenStrings[s] = true;
            out.push(s);
        })
        return out;
    }

    return {
        assetNames: dedupe(assetNames),
        variableNames: dedupe(variableNames),
        other: dedupe(strings),
    }
}


export function grabImagesFromProject(filesystem: {[index: string]: string}, palette = arcadePalette) {
    // Don't bother checking python and blocks files, they should all get converted to a matching ts
    // file that will also contain all image literals
    const typescriptFiles = Object.keys(filesystem).filter(filename =>
        filename.endsWith(".ts") || filename.endsWith(".jres"));

    // Grab any existing images in the project
    const projectImages: JRESImage[] = [];
    for (const filename of typescriptFiles) {

        const fileText = filesystem[filename];
        if (filename.endsWith("jres")) {
            projectImages.push(...grabImagesFromJRES(fileText, filename, palette));
        }
        else {
            projectImages.push(...grabImagesFromTypeScript(fileText, filename, palette));
        }
    }

    // Dedupe the images based on their content
    const seenImages: {[index: string]: JRESImage} = {};

    for (const image of projectImages) {
        const existing = seenImages[image.data];
        // Prefer images that have qualified names (from JRES)
        if (!existing || (!existing.qualifiedName && image.qualifiedName)) {
            seenImages[image.data] = image;
        }
    }

    return Object.keys(seenImages).map(data => seenImages[data]);
}

function grabImagesFromJRES(jresText: string, filename: string, palette = arcadePalette): JRESImage[] {
    let jres: {[index: string]: JRes | string};

    try {
        jres = JSON.parse(jresText);
    }
    catch (e) {
        return [];
    }

    const metaEntry = jres["*"] as JRes | undefined;

    const metaMime = metaEntry?.mimeType || "";
    const metaNamespace = metaEntry?.namespace || "";

    const result: JRESImage[] = [];

    for (const id of Object.keys(jres)) {
        if (id === "*") continue;

        let entry = jres[id];

        if (typeof entry === "string") {
            if (metaMime === IMAGE_MIME_TYPE) {
                result.push(getJRESImageFromDataString(entry, palette, metaNamespace ? metaNamespace + "." + id : id, false, filename));
            }
        }
        else if (entry.mimeType === IMAGE_MIME_TYPE) {
            result.push(getJRESImageFromDataString(entry.data, palette, metaNamespace ? metaNamespace + "." + id : id, entry.tilemapTile, filename));
        }
    }

    return result
}

function grabImagesFromTypeScript(fileText: string, filename: string, palette = arcadePalette) {
    const literalRegex = /img\s*`[\s\da-f.#tngrpoyw]*`/img;

    const res: JRESImage[] = [];

    fileText.replace(literalRegex, match => {
        res.push(getJRESImageFromImageLiteral(match, palette, filename))
        return "";
    });

    return res;
}


export function httpGetJSONAsync(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();

        request.addEventListener("error", err => {
            reject(err);
        });

        request.addEventListener("load", () => {
            try {
                resolve(JSON.parse(request.responseText));
            }
            catch (e) {
                reject(e);
            }
        });

        request.open("GET", url);
        request.send();
    });
}

function grabCommentsAndStringsFromTypeScript(text: string) {
    const strings: string[] = [];

    let inMultilineComment = false;
    let inSingleLineComment = false;
    let inTemplateString = false;
    let curlyLevel = 0;
    let inQuotes = undefined;
    let currentTokenStart = -1;
    let inIgnoredLiteral = false;

    for (let i = 0; i < text.length; i++) {
        const char = text.charAt(i);

        if (inMultilineComment) {
            if (char === "*" && text.charAt(i + 1) === "/" && i > currentTokenStart) {
                inMultilineComment = false;
                strings.push(text.substring(currentTokenStart, i).trim());
            }
        }
        else if (inSingleLineComment) {
            if (/\n/.test(char)) {
                inSingleLineComment = false;
                strings.push(text.substring(currentTokenStart, i).trim());
            }
        }
        else if (inQuotes) {
            if (char === inQuotes) {
                inQuotes = undefined;
                strings.push(text.substring(currentTokenStart, i).trim());
            }
        }
        else if (inTemplateString) {
            if (curlyLevel) {
                if (char === "}") {
                    curlyLevel--;
                    if (curlyLevel === 0) {
                        strings.push(...grabCommentsAndStringsFromTypeScript(text.substring(currentTokenStart, i)));
                        currentTokenStart = i + 1;
                    }
                }
                else if (char === "{") {
                    curlyLevel++;
                }
            }
            else if (char === "$" && text.charAt(i + 1) === "{") {
                curlyLevel = 1;
                strings.push(text.substring(currentTokenStart, i).trim());
                currentTokenStart = i + 1;
                i++;
            }
            else if (char === "`") {
                inTemplateString = false;
                strings.push(text.substring(currentTokenStart, i).trim());
            }
        }
        else if (inIgnoredLiteral) {
            if (char === "`") {
                inIgnoredLiteral = false;
            }
        }
        else {
            if (char === "/" && text.charAt(i + 1) === "*") {
                inMultilineComment = true;
                currentTokenStart = i + 2;
            }
            else if (char === "/" && text.charAt(i + 1) === "/") {
                inSingleLineComment = true;
                currentTokenStart = i + 2;
            }
            else if (char === "'" || char === '"') {
                inQuotes = char;
                currentTokenStart = i + 1;
            }
            else if (char === "`") {
                inTemplateString = true;
                currentTokenStart = i + 1;
            }
            else if (char === "i" && text.charAt(i + 1) === "m" && text.charAt(i + 2) === "g" && text.charAt(i + 3) === "`") {
                inIgnoredLiteral = true;
                i += 3;
            }
            else if (char === "h" && text.charAt(i + 1) === "e" && text.charAt(i + 2) === "x" && text.charAt(i + 3) === "`") {
                inIgnoredLiteral = true;
                i += 3;
            }
        }
    }

    return strings.filter(s => !!s);
}