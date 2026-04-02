import {parseDocument} from "yaml";

function normalizeText(value) {
    return value.replace(/\r\n?/g, "\n");
}

function parseYamlBlock(raw) {
    if (!raw.trim()) {
        return {};
    }

    try {
        const parsed = parseDocument(raw).toJS({});
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

function parseAspectRatio(value) {
    if (typeof value === "number" && value > 0) {
        return {numeric: value, text: String(value)};
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        const slashMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
        if (slashMatch) {
            const width = Number.parseFloat(slashMatch[1]);
            const height = Number.parseFloat(slashMatch[2]);
            if (width > 0 && height > 0) {
                return {numeric: width / height, text: `${width}/${height}`};
            }
        }

        const direct = Number.parseFloat(trimmed);
        if (!Number.isNaN(direct) && direct > 0) {
            return {numeric: direct, text: trimmed};
        }
    }

    return {numeric: 16 / 9, text: "16/9"};
}

function scanTopFrontmatter(lines) {
    if (lines[0] !== "---") {
        return {headmatter: {}, nextIndex: 0};
    }

    let cursor = 1;
    while (cursor < lines.length && lines[cursor] !== "---") {
        cursor += 1;
    }

    if (cursor >= lines.length) {
        return {headmatter: {}, nextIndex: 0};
    }

    return {
        headmatter: parseYamlBlock(lines.slice(1, cursor).join("\n")),
        nextIndex: cursor + 1,
    };
}

function looksLikeFrontmatter(lines) {
    const block = lines.join("\n").trim();
    if (!block) {
        return false;
    }
    if (!block.includes(":")) {
        return false;
    }
    const parsed = parseYamlBlock(block);
    return parsed && typeof parsed === "object" && Object.keys(parsed).length > 0;
}

function parseSlides(lines, startIndex, headmatter, defaults) {
    const slides = [];
    let currentFrontmatter = {...headmatter};
    let contentBuffer = [];
    let cursor = startIndex;
    let activeFence = null;
    let isFirstSlide = true;

    function flushCurrentSlide() {
        const content = contentBuffer.join("\n").trim();
        if (!content && Object.keys(currentFrontmatter).length === 0) {
            contentBuffer = [];
            return;
        }
        slides.push({
            frontmatter: currentFrontmatter,
            content,
        });
        contentBuffer = [];
    }

    while (cursor < lines.length) {
        const line = lines[cursor];
        const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})/);

        if (!activeFence && line === "---") {
            flushCurrentSlide();
            isFirstSlide = false;
            cursor += 1;

            const frontmatterStart = cursor;
            while (cursor < lines.length && lines[cursor] !== "---") {
                cursor += 1;
            }

            if (cursor < lines.length && cursor > frontmatterStart && looksLikeFrontmatter(lines.slice(frontmatterStart, cursor))) {
                currentFrontmatter = {
                    ...(isFirstSlide ? headmatter : defaults),
                    ...parseYamlBlock(lines.slice(frontmatterStart, cursor).join("\n")),
                };
                cursor += 1;
            } else {
                currentFrontmatter = {...defaults};
                cursor = frontmatterStart;
            }
            continue;
        }

        contentBuffer.push(line);
        if (fenceMatch) {
            const marker = fenceMatch[2];
            if (!activeFence) {
                activeFence = {char: marker[0], size: marker.length};
            } else if (marker[0] === activeFence.char && marker.length >= activeFence.size) {
                activeFence = null;
            }
        }
        cursor += 1;
    }

    flushCurrentSlide();
    return slides.filter((slide) => slide.content || Object.keys(slide.frontmatter).length > 0);
}

export function parseDeck(source) {
    const lines = normalizeText(source).split("\n");
    const {headmatter, nextIndex} = scanTopFrontmatter(lines);
    const defaults = headmatter.defaults && typeof headmatter.defaults === "object"
        ? headmatter.defaults
        : {};

    return {
        headmatter,
        defaults,
        slides: parseSlides(lines, nextIndex, headmatter, defaults),
    };
}

export function getDeckViewport(deck) {
    const ratio = parseAspectRatio(deck.headmatter.aspectRatio);
    const canvasWidth = typeof deck.headmatter.canvasWidth === "number" && deck.headmatter.canvasWidth > 0
        ? deck.headmatter.canvasWidth
        : 1280;

    return {
        aspectRatio: ratio.numeric,
        aspectRatioText: ratio.text,
        canvasWidth,
        canvasHeight: Math.round(canvasWidth / ratio.numeric),
    };
}

export function getDeckTitle(deck, fallbackTitle = "Untitled Slides") {
    return typeof deck.headmatter.title === "string" && deck.headmatter.title.trim()
        ? deck.headmatter.title
        : fallbackTitle;
}
