import { readDir, BaseDirectory, readTextFile, exists } from '@tauri-apps/plugin-fs';
import { useCloseOnBlur, usePersistWindowGeometry } from '../../hooks/useWindowLifecycle';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
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

const appWindow = getCurrentWebviewWindow();

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

    // A pinned window stays put, and so does one the user has told to. While the
    // setting is still loading, `?? true` keeps the default behaviour rather
    // than leaving the window uncloseable for that first tick.
    useCloseOnBlur({ enabled: (closeOnBlur ?? true) && !pined, delay: 100 });
    usePersistWindowGeometry({
        position: windowPosition === 'pre_state',
        size: rememberWindowSize === true,
    });

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

    const setPinned = (next) => {
        appWindow.setAlwaysOnTop(next);
        setPined(next);
    };

    // 是否默认置顶
    useEffect(() => {
        if (alwaysOnTop !== null && alwaysOnTop) {
            setPinned(true);
        }
    }, [alwaysOnTop]);

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
        // This used to be guarded by `if (!unlisten)`, testing the variable that
        // held the blur subscription -- always set, so the reload never got a
        // listener and installing a plugin did not show up until the window was
        // reopened.
        const unlisten = listen('reload_plugin_list', loadPluginList);
        return () => {
            unlisten.then((f) => f());
        };
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
                                setPinned(!pined);
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
