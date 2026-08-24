import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

import * as builtinServices from '../../../services/translate';
import { getServiceName, whetherPluginService } from '../../../utils/service_instance';
import { applyGlossaryToConfig, applyGlossaryToResult, glossarySignature } from '../../../utils/glossary';
import { buildCacheKey, getActiveGlossary, getCachedTranslation, setCachedTranslation } from '../../../utils/db';
import { linuxLangMap, windowsLangMap } from '../../../services/recognize/system';
import { invoke_plugin } from '../../../utils/invoke_plugin';
import { store } from '../../../utils/store';
import { osType } from '../../../utils/env';

// The two backends spell a language differently -- Windows OCR wants a BCP-47
// tag, tesseract a three-letter code -- and the window's language atom holds
// pot's own. Reusing the system recognize service's tables keeps the two paths
// from drifting apart, and keeps the code in step with the
// `tesseract-ocr-<lang>` package the Rust side names when the data is missing.
function toOcrLanguage(language) {
    const map = osType === 'Linux' ? linuxLangMap : windowsLangMap;
    return map[language ?? 'auto'] ?? 'auto';
}

// Both engines put spaces between CJK glyphs, which the system recognize
// service strips for the same reason: they are not real word boundaries and
// they make the translation noticeably worse.
function normalizeText(text, language) {
    return ['zh_cn', 'zh_tw', 'ja', 'yue'].includes(language) ? text.replaceAll(' ', '') : text;
}

// The OCR engine finds lines, not paragraphs, and translating a wrapped sentence
// one line at a time gives noticeably worse results. Lines that sit directly
// under one another, are similar heights and overlap horizontally are almost
// always one block of prose, so they are merged before translating and the
// result is laid back over the union of their boxes.
function groupLines(lines) {
    const sorted = [...lines].sort((a, b) => a.y - b.y || a.x - b.x);
    const groups = [];
    for (const line of sorted) {
        const last = groups[groups.length - 1];
        if (last) {
            const prev = last.lines[last.lines.length - 1];
            const gap = line.y - (prev.y + prev.height);
            const heightRatio = Math.min(line.height, prev.height) / Math.max(line.height, prev.height);
            const overlap =
                Math.min(line.x + line.width, prev.x + prev.width) - Math.max(line.x, prev.x) >
                Math.min(line.width, prev.width) * 0.3;
            if (gap >= -prev.height * 0.5 && gap < prev.height * 0.8 && heightRatio > 0.7 && overlap) {
                last.lines.push(line);
                continue;
            }
        }
        groups.push({ lines: [line] });
    }
    return groups.map((group) => {
        const x = Math.min(...group.lines.map((l) => l.x));
        const y = Math.min(...group.lines.map((l) => l.y));
        const right = Math.max(...group.lines.map((l) => l.x + l.width));
        const bottom = Math.max(...group.lines.map((l) => l.y + l.height));
        return {
            x,
            y,
            width: right - x,
            height: bottom - y,
            lineHeight: group.lines[0].height,
            text: group.lines.map((l) => l.text).join(' '),
        };
    });
}

// The OCR rectangles bound the ink of the words, which is tighter than the type
// they were set in: descenders on q, y and g, and the tops of tall glyphs, fall
// outside it and show as debris around the replacement text. A margin taken from
// the line height covers them without swallowing the neighbours, since lines
// close enough to collide have already been merged into one block.
function padBox(box, imageWidth, imageHeight) {
    const padY = box.lineHeight * 0.2;
    const padX = box.lineHeight * 0.12;
    const x = Math.max(0, box.x - padX);
    const y = Math.max(0, box.y - padY);
    return {
        ...box,
        x,
        y,
        width: Math.min(imageWidth, box.x + box.width + padX) - x,
        height: Math.min(imageHeight, box.y + box.height + padY) - y,
    };
}

// The colour to paint over the original text. Sampling the whole box would
// average in the glyphs themselves; the one pixel border around it is nearly
// always background, so the median of that ring is a good stand-in.
function sampleBackground(ctx, box, imageWidth, imageHeight) {
    const x0 = Math.max(0, Math.floor(box.x) - 1);
    const y0 = Math.max(0, Math.floor(box.y) - 1);
    const x1 = Math.min(imageWidth - 1, Math.ceil(box.x + box.width) + 1);
    const y1 = Math.min(imageHeight - 1, Math.ceil(box.y + box.height) + 1);
    if (x1 <= x0 || y1 <= y0) return { bg: 'rgb(255,255,255)', fg: '#000' };

    const samples = [];
    const push = (x, y) => {
        const d = ctx.getImageData(x, y, 1, 1).data;
        samples.push([d[0], d[1], d[2]]);
    };
    const step = Math.max(1, Math.floor((x1 - x0) / 24));
    for (let x = x0; x <= x1; x += step) {
        push(x, y0);
        push(x, y1);
    }
    const vstep = Math.max(1, Math.floor((y1 - y0) / 8));
    for (let y = y0; y <= y1; y += vstep) {
        push(x0, y);
        push(x1, y);
    }

    const median = (i) => {
        const v = samples.map((s) => s[i]).sort((a, b) => a - b);
        return v[Math.floor(v.length / 2)];
    };
    const [r, g, b] = [median(0), median(1), median(2)];
    // Rec. 709 luma, so the replacement text stays readable on either.
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return { bg: `rgb(${r},${g},${b})`, fg: luma > 140 ? '#000' : '#fff' };
}

// Issuing one request per block at once would hammer the provider and, for the
// keyed services, risk a rate limit. Four at a time keeps it responsive without
// looking like an attack.
async function mapLimit(items, limit, fn) {
    const results = new Array(items.length);
    let next = 0;
    await Promise.all(
        Array.from({ length: Math.min(limit, items.length) }, async () => {
            while (next < items.length) {
                const i = next++;
                results[i] = await fn(items[i], i);
            }
        })
    );
    return results;
}

async function translateBlocks(blocks, instanceKey, pluginList, from, to, onProgress) {
    const serviceName = getServiceName(instanceKey);
    const isPlugin = whetherPluginService(instanceKey);
    const savedConfig = (await store.get(instanceKey)) ?? {};
    if (isPlugin) {
        savedConfig['enable'] = 'true';
    }

    // This path asks for no streaming, whatever the instance is configured for.
    // It translates every block at once and paints each one only when it is
    // finished, so there is nowhere to put partial text -- which is why it
    // passes `setResult: null`. Asked to stream with no `setResult` to hand it
    // to, ollama, openai and geminipro all give up and return the literal
    // string '[STREAM]', and that is what got painted over the image and then
    // cached under the block's key.
    //
    // Only when the instance actually carries the option, so the services that
    // have no `stream` at all keep the cache keys they already had -- the config
    // is hashed into the key, so adding a field to it would miss every entry.
    const baseConfig = 'stream' in savedConfig ? { ...savedConfig, stream: false } : savedConfig;

    // Same two-tier glossary as the Translate window, and for the same reason
    // this file duplicates the dispatch at all: there is no shared path to put
    // it on. `from` here is already the recognised language, never 'auto'.
    const glossaryEntries = await getActiveGlossary(from, to).catch(() => []);
    const instanceConfig = applyGlossaryToConfig(baseConfig, serviceName, glossaryEntries);
    const glossaryWentIntoPrompt = instanceConfig !== baseConfig;
    const glossarySignatureValue = glossarySignature(glossaryEntries);

    const languageMap = isPlugin
        ? pluginList['translate'][serviceName].language
        : builtinServices[serviceName].Language;
    if (!(from in languageMap) || !(to in languageMap)) {
        throw new Error('Language not supported');
    }

    let done = 0;
    return mapLimit(blocks, 4, async (block) => {
        const cacheKey = buildCacheKey({
            instanceKey,
            config: instanceConfig,
            from,
            to,
            detect: from,
            text: block.text,
            glossary: glossarySignatureValue,
        });
        let result = null;
        try {
            result = await getCachedTranslation(cacheKey, 30);
        } catch {
            // A broken cache must never stop a translation.
        }
        if (result === null) {
            if (isPlugin) {
                // `invoke_plugin` hands back the entry point and the `utils`
                // object the plugin protocol expects to receive alongside it.
                const [func, utils] = await invoke_plugin('translate', serviceName);
                result = await func(block.text, languageMap[from], languageMap[to], {
                    config: instanceConfig,
                    detect: from,
                    setResult: null,
                    utils,
                });
            } else {
                result = await builtinServices[serviceName].translate(block.text, languageMap[from], languageMap[to], {
                    config: instanceConfig,
                    detect: from,
                    setResult: null,
                });
            }
            // Rewritten before it is cached, since the glossary is part of the key.
            if (!glossaryWentIntoPrompt) {
                result = applyGlossaryToResult(result, glossaryEntries);
            }
            if (typeof result === 'string' && result.trim() !== '') {
                setCachedTranslation(cacheKey, result.trim()).catch(() => {});
            }
        }
        onProgress(++done);
        // Dictionary services resolve with an object; there is nothing sensible
        // to paint for those.
        return typeof result === 'string' ? result.trim() : '';
    });
}

const InPlaceOverlay = forwardRef(function InPlaceOverlay(props, ref) {
    const { imgRef, base64, language, pluginList, onStatus } = props;
    const [blocks, setBlocks] = useState(null);
    const [geometry, setGeometry] = useState(null);
    const layoutRef = useRef(null);

    // Where the painted pixels sit, in the coordinates the overlay is positioned
    // in. Two separate gaps, and only the second used to be accounted for:
    //
    //   - the <img> element's own place inside the box the overlay is absolutely
    //     positioned against. The overlay is `top-0 left-0 w-full h-full` over
    //     the whole pane, while the element is sized to the image and centred in
    //     it, so a wide, short capture left the element a hundred pixels below
    //     the pane's top edge -- and every box was painted that much too high.
    //   - the letterboxing `object-contain` leaves inside the element when the
    //     two aspect ratios still differ.
    //
    // `offsetLeft`/`offsetTop` are measured against the nearest positioned
    // ancestor, which is the same element the overlay's `top: 0` resolves
    // against, so the two agree by construction.
    const measure = useCallback(() => {
        const img = imgRef.current;
        const layout = layoutRef.current;
        if (!img || !layout || !img.naturalWidth) return;
        const scale = Math.min(img.clientWidth / img.naturalWidth, img.clientHeight / img.naturalHeight);
        setGeometry({
            scale,
            offsetX: img.offsetLeft + (img.clientWidth - img.naturalWidth * scale) / 2,
            offsetY: img.offsetTop + (img.clientHeight - img.naturalHeight * scale) / 2,
        });
    }, [imgRef]);

    useEffect(() => {
        if (blocks === null) return;
        measure();
        const observer = new ResizeObserver(measure);
        if (imgRef.current) observer.observe(imgRef.current);
        window.addEventListener('resize', measure);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, [blocks, measure, imgRef]);

    // A new screenshot invalidates everything.
    useEffect(() => {
        setBlocks(null);
        layoutRef.current = null;
    }, [base64]);

    const run = useCallback(async () => {
        onStatus({ state: 'ocr' });
        const layout = await invoke('system_ocr_layout', { lang: toOcrLanguage(language) });
        if (layout.lines.length === 0) {
            onStatus({ state: 'error', message: 'No text found in the image' });
            return;
        }
        layoutRef.current = layout;

        const grouped = groupLines(layout.lines).map((block) => ({
            ...padBox(block, layout.image_width, layout.image_height),
            text: normalizeText(block.text, language),
        }));

        // Sample colours from the original bitmap before anything is painted over it.
        const image = new Image();
        await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = () => reject(new Error('Failed to read the captured image'));
            image.src = 'data:image/png;base64,' + base64;
        });
        const canvas = document.createElement('canvas');
        canvas.width = layout.image_width;
        canvas.height = layout.image_height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(image, 0, 0);
        const coloured = grouped.map((block) => ({
            ...block,
            ...sampleBackground(ctx, block, layout.image_width, layout.image_height),
        }));

        const serviceList = (await store.get('translate_service_list')) ?? ['deepl'];
        const targetLanguage = (await store.get('translate_target_language')) ?? 'zh_cn';
        onStatus({ state: 'translating', done: 0, total: coloured.length });
        const translations = await translateBlocks(
            coloured,
            serviceList[0],
            pluginList,
            'auto',
            targetLanguage,
            (done) => onStatus({ state: 'translating', done, total: coloured.length })
        );

        setBlocks(coloured.map((block, i) => ({ ...block, translated: translations[i] })));
        onStatus({ state: 'done' });
    }, [base64, language, pluginList, onStatus]);

    // The button that starts this lives in the card footer, not here.
    useImperativeHandle(ref, () => ({ run, clear: () => setBlocks(null), active: blocks !== null }), [run, blocks]);

    if (blocks === null || geometry === null) return null;

    return (
        <div className='absolute top-0 left-0 w-full h-full pointer-events-none'>
            {blocks.map((block, i) =>
                block.translated === '' ? null : (
                    <div
                        key={i}
                        className='absolute flex items-center overflow-hidden pointer-events-auto select-text'
                        style={{
                            left: geometry.offsetX + block.x * geometry.scale,
                            top: geometry.offsetY + block.y * geometry.scale,
                            width: block.width * geometry.scale,
                            height: block.height * geometry.scale,
                            background: block.bg,
                            color: block.fg,
                            // Sized off the source line rather than the whole
                            // block, so a wrapped paragraph does not get one
                            // enormous glyph per line.
                            fontSize: Math.max(8, block.lineHeight * geometry.scale * 0.82),
                            lineHeight: 1.15,
                        }}
                        title={block.text}
                    >
                        <span className='w-full break-words'>{block.translated}</span>
                    </div>
                )
            )}
        </div>
    );
});

export default InPlaceOverlay;
