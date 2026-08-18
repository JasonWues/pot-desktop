import { readDir, BaseDirectory, readTextFile, exists } from '@tauri-apps/plugin-fs';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { currentMonitor } from '@tauri-apps/api/window';
import { appConfigDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/core';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
import { BsPinFill } from 'react-icons/bs';

import LanguageArea from './components/LanguageArea';
import SourceArea from './components/SourceArea';
import TargetArea from './components/TargetArea';
import { osType } from '../../utils/env';
import { useConfig } from '../../hooks';
import { store } from '../../utils/store';
import { info } from '@tauri-apps/plugin-log';

const appWindow = getCurrentWebviewWindow();

let blurTimeout = null;
let resizeTimeout = null;
let moveTimeout = null;

const listenBlur = () => {
    return listen('tauri://blur', () => {
        if (appWindow.label === 'translate') {
            if (blurTimeout) {
                clearTimeout(blurTimeout);
            }
            info('Blur');
            // 100ms后关闭窗口，因为在 windows 下拖动窗口时会先切换成 blur 再立即切换成 focus
            // 如果直接关闭将导致窗口无法拖动
            blurTimeout = setTimeout(async () => {
                info('Confirm Blur');
                await appWindow.close();
            }, 100);
        }
    });
};

let unlisten = listenBlur();
// 取消 blur 监听
const unlistenBlur = () => {
    unlisten.then((f) => {
        f();
    });
};

// 监听 focus 事件取消 blurTimeout 时间之内的关闭窗口
void listen('tauri://focus', () => {
    info('Focus');
    if (blurTimeout) {
        info('Cancel Close');
        clearTimeout(blurTimeout);
    }
});
// 监听 move 事件取消 blurTimeout 时间之内的关闭窗口
void listen('tauri://move', () => {
    info('Move');
    if (blurTimeout) {
        info('Cancel Close');
        clearTimeout(blurTimeout);
    }
});

export default function Translate() {
    const [closeOnBlur] = useConfig('translate_close_on_blur', true);
    const [alwaysOnTop] = useConfig('translate_always_on_top', false);
    const [windowPosition] = useConfig('translate_window_position', 'mouse');
    const [rememberWindowSize] = useConfig('translate_remember_window_size', false);
    const [translateServiceInstanceList, setTranslateServiceInstanceList] = useConfig('translate_service_list', [
        'deepl',
        'bing',
        'lingva',
        'yandex',
        'google',
        'ecdict',
    ]);
    const [recognizeServiceInstanceList] = useConfig('recognize_service_list', ['system', 'tesseract']);
    const [ttsServiceInstanceList] = useConfig('tts_service_list', ['lingva_tts']);
    const [collectionServiceInstanceList] = useConfig('collection_service_list', []);
    const [hideLanguage] = useConfig('hide_language', false);
    const [pined, setPined] = useState(false);
    const [pluginList, setPluginList] = useState(null);
    const [serviceInstanceConfigMap, setServiceInstanceConfigMap] = useState(null);
    const { t } = useTranslation();
    const reorder = (list, startIndex, endIndex) => {
        const result = Array.from(list);
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);
        return result;
    };

    const onDragEnd = async (result) => {
        if (!result.destination) return;
        const items = reorder(translateServiceInstanceList, result.source.index, result.destination.index);
        setTranslateServiceInstanceList(items);
    };
    // 是否自动关闭窗口
    useEffect(() => {
        if (closeOnBlur !== null && !closeOnBlur) {
            unlistenBlur();
        }
    }, [closeOnBlur]);
    // 是否默认置顶
    useEffect(() => {
        if (alwaysOnTop !== null && alwaysOnTop) {
            appWindow.setAlwaysOnTop(true);
            unlistenBlur();
            setPined(true);
        }
    }, [alwaysOnTop]);
    // 保存窗口位置
    useEffect(() => {
        if (windowPosition !== null && windowPosition === 'pre_state') {
            const unlistenMove = listen('tauri://move', async () => {
                if (moveTimeout) {
                    clearTimeout(moveTimeout);
                }
                moveTimeout = setTimeout(async () => {
                    if (appWindow.label === 'translate') {
                        let position = await appWindow.outerPosition();
                        const monitor = await currentMonitor();
                        const factor = monitor.scaleFactor;
                        position = position.toLogical(factor);
                        await store.set('translate_window_position_x', parseInt(position.x));
                        await store.set('translate_window_position_y', parseInt(position.y));
                        await store.save();
                    }
                }, 100);
            });
            return () => {
                unlistenMove.then((f) => {
                    f();
                });
            };
        }
    }, [windowPosition]);
    // 保存窗口大小
    useEffect(() => {
        if (rememberWindowSize !== null && rememberWindowSize) {
            const unlistenResize = listen('tauri://resize', async () => {
                if (resizeTimeout) {
                    clearTimeout(resizeTimeout);
                }
                resizeTimeout = setTimeout(async () => {
                    if (appWindow.label === 'translate') {
                        let size = await appWindow.outerSize();
                        const monitor = await currentMonitor();
                        const factor = monitor.scaleFactor;
                        size = size.toLogical(factor);
                        await store.set('translate_window_height', parseInt(size.height));
                        await store.set('translate_window_width', parseInt(size.width));
                        await store.save();
                    }
                }, 100);
            });
            return () => {
                unlistenResize.then((f) => {
                    f();
                });
            };
        }
    }, [rememberWindowSize]);

    const loadPluginList = async () => {
        const serviceTypeList = ['translate', 'tts', 'recognize', 'collection'];
        let temp = {};
        for (const serviceType of serviceTypeList) {
            temp[serviceType] = {};
            if (await exists(`plugins/${serviceType}`, { baseDir: BaseDirectory.AppConfig })) {
                const plugins = await readDir(`plugins/${serviceType}`, { baseDir: BaseDirectory.AppConfig });
                for (const plugin of plugins) {
                    const infoStr = await readTextFile(`plugins/${serviceType}/${plugin.name}/info.json`, {
                        baseDir: BaseDirectory.AppConfig,
                    });
                    let pluginInfo = JSON.parse(infoStr);
                    if ('icon' in pluginInfo) {
                        const appConfigDirPath = await appConfigDir();
                        const iconPath = await join(
                            appConfigDirPath,
                            `/plugins/${serviceType}/${plugin.name}/${pluginInfo.icon}`
                        );
                        pluginInfo.icon = convertFileSrc(iconPath);
                    }
                    temp[serviceType][plugin.name] = pluginInfo;
                }
            }
        }
        setPluginList({ ...temp });
    };

    useEffect(() => {
        loadPluginList();
        if (!unlisten) {
            unlisten = listen('reload_plugin_list', loadPluginList);
        }
    }, []);

    const loadServiceInstanceConfigMap = async () => {
        const config = {};
        for (const serviceInstanceKey of translateServiceInstanceList) {
            config[serviceInstanceKey] = (await store.get(serviceInstanceKey)) ?? {};
        }
        for (const serviceInstanceKey of recognizeServiceInstanceList) {
            config[serviceInstanceKey] = (await store.get(serviceInstanceKey)) ?? {};
        }
        for (const serviceInstanceKey of ttsServiceInstanceList) {
            config[serviceInstanceKey] = (await store.get(serviceInstanceKey)) ?? {};
        }
        for (const serviceInstanceKey of collectionServiceInstanceList) {
            config[serviceInstanceKey] = (await store.get(serviceInstanceKey)) ?? {};
        }
        setServiceInstanceConfigMap({ ...config });
    };
    useEffect(() => {
        if (
            translateServiceInstanceList !== null &&
            recognizeServiceInstanceList !== null &&
            ttsServiceInstanceList !== null &&
            collectionServiceInstanceList !== null
        ) {
            loadServiceInstanceConfigMap();
        }
    }, [
        translateServiceInstanceList,
        recognizeServiceInstanceList,
        ttsServiceInstanceList,
        collectionServiceInstanceList,
    ]);

    return (
        pluginList && (
            <div
                className={`translate-window bg-background h-screen w-screen ${osType === 'Linux' ? 'rounded-[10px] border-1 border-border' : ''}`}
            >
                {/*
                    The titlebar carries the drag region itself rather than an
                    absolutely positioned strip laid over it. `data-tauri-drag-region`
                    is matched against the element the click actually landed on, so
                    the two controls inside stay clickable -- and the brand, which
                    does carry it, becomes a handle instead of dead space.

                    No brand on macOS: `TitleBarStyle::Overlay` floats the native
                    traffic lights over the top-left corner, which is exactly where
                    it would sit.
                */}
                <header
                    className='translate-titlebar'
                    data-tauri-drag-region='true'
                >
                    {osType !== 'Darwin' && (
                        <span
                            className='translate-brand'
                            data-tauri-drag-region='true'
                        >
                            Pot · {t('translate.translate')}
                        </span>
                    )}
                    <div className='flex items-center gap-[10px] ml-auto'>
                        <button
                            type='button'
                            className='translate-iconbtn'
                            title={t('config.translate.always_on_top')}
                            aria-label={t('config.translate.always_on_top')}
                            aria-pressed={pined}
                            onClick={() => {
                                if (pined) {
                                    if (closeOnBlur) {
                                        unlisten = listenBlur();
                                    }
                                    appWindow.setAlwaysOnTop(false);
                                } else {
                                    unlistenBlur();
                                    appWindow.setAlwaysOnTop(true);
                                }
                                setPined(!pined);
                            }}
                        >
                            <BsPinFill className={`text-[13px] ${pined ? 'text-accent' : ''}`} />
                        </button>
                        {osType !== 'Darwin' && (
                            <button
                                type='button'
                                className='translate-close'
                                title={t('common.close')}
                                aria-label={t('common.close')}
                                onClick={() => {
                                    void appWindow.close();
                                }}
                            />
                        )}
                    </div>
                </header>
                {/*
                    One scrolling column of sections with no padding and no spacers
                    between them: each section draws its own bottom rule, and the
                    seam between two of them IS that rule.
                */}
                <div className='flex-1 min-h-0 overflow-y-auto'>
                    {serviceInstanceConfigMap !== null && (
                        <SourceArea
                            pluginList={pluginList}
                            serviceInstanceConfigMap={serviceInstanceConfigMap}
                        />
                    )}
                    <div className={`${hideLanguage ? 'hidden' : ''}`}>
                        <LanguageArea />
                    </div>
                    <DragDropContext onDragEnd={onDragEnd}>
                        <Droppable
                            droppableId='droppable'
                            direction='vertical'
                        >
                            {(provided) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                >
                                    {translateServiceInstanceList !== null &&
                                        serviceInstanceConfigMap !== null &&
                                        translateServiceInstanceList.map((serviceInstanceKey, index) => {
                                            const config = serviceInstanceConfigMap[serviceInstanceKey] ?? {};
                                            const enable = config['enable'] ?? true;

                                            return enable ? (
                                                <Draggable
                                                    key={serviceInstanceKey}
                                                    draggableId={serviceInstanceKey}
                                                    index={index}
                                                >
                                                    {(provided) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                        >
                                                            <TargetArea
                                                                {...provided.dragHandleProps}
                                                                index={index}
                                                                name={serviceInstanceKey}
                                                                translateServiceInstanceList={
                                                                    translateServiceInstanceList
                                                                }
                                                                pluginList={pluginList}
                                                                serviceInstanceConfigMap={serviceInstanceConfigMap}
                                                            />
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ) : // `null`, not an empty fragment: a fragment is a
                                            // child of this list and React wants a key for it.
                                            null;
                                        })}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
                </div>
            </div>
        )
    );
}
