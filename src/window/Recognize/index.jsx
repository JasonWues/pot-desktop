import { readDir, BaseDirectory, readTextFile, exists } from '@tauri-apps/plugin-fs';
import { appConfigDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BsPinFill } from 'react-icons/bs';
import { atom, useAtom } from 'jotai';

import WindowControl from '../../components/WindowControl';
import { store } from '../../utils/store';
import { osType } from '../../utils/env';
import { useCloseOnBlur } from '../../hooks/useWindowLifecycle';
import { useConfig } from '../../hooks';
import ControlArea from './ControlArea';
import ImageArea from './ImageArea';
import TextArea from './TextArea';

const appWindow = getCurrentWebviewWindow();

export const pluginListAtom = atom();

export default function Recognize() {
    const [pluginList, setPluginList] = useAtom(pluginListAtom);
    const [closeOnBlur] = useConfig('recognize_close_on_blur', false);
    const [pined, setPined] = useState(false);
    const [serviceInstanceList] = useConfig('recognize_service_list', ['system', 'tesseract']);
    const [serviceInstanceConfigMap, setServiceInstanceConfigMap] = useState(null);
    const { t } = useTranslation();

    // A pinned window stays put, and so does one the user has told to.
    useCloseOnBlur({ enabled: (closeOnBlur ?? false) && !pined, delay: 50 });

    const loadPluginList = async () => {
        let temp = {};
        if (await exists(`plugins/recognize`, { baseDir: BaseDirectory.AppConfig })) {
            const plugins = await readDir(`plugins/recognize`, { baseDir: BaseDirectory.AppConfig });
            for (const plugin of plugins) {
                const infoStr = await readTextFile(`plugins/recognize/${plugin.name}/info.json`, {
                    baseDir: BaseDirectory.AppConfig,
                });
                let pluginInfo = JSON.parse(infoStr);
                if ('icon' in pluginInfo) {
                    const appConfigDirPath = await appConfigDir();
                    const iconPath = await join(
                        appConfigDirPath,
                        `/plugins/recognize/${plugin.name}/${pluginInfo.icon}`
                    );
                    pluginInfo.icon = convertFileSrc(iconPath);
                }
                temp[plugin.name] = pluginInfo;
            }
        }
        setPluginList({ ...temp });
    };
    const loadServiceInstanceConfigMap = async () => {
        const config = {};
        for (const serviceInstanceKey of serviceInstanceList) {
            config[serviceInstanceKey] = (await store.get(serviceInstanceKey)) ?? {};
        }
        setServiceInstanceConfigMap({ ...config });
    };
    useEffect(() => {
        if (serviceInstanceList !== null) {
            loadServiceInstanceConfigMap();
        }
    }, [serviceInstanceList]);

    useEffect(() => {
        loadPluginList();
    }, []);
    return (
        pluginList &&
        serviceInstanceConfigMap !== null && (
            <div
                className={`recognize-window bg-background h-screen ${osType === 'Linux' ? 'rounded-[10px] border-1 border-border' : ''}`}
            >
                {/*
                    The drag region is the titlebar itself rather than a fixed
                    strip laid over it. Tauri checks the attribute on the event
                    target, so the buttons inside -- which do not carry it --
                    still take their own clicks.
                */}
                <div
                    className={`recognize-titlebar ${osType === 'Darwin' ? 'justify-end' : ''}`}
                    data-tauri-drag-region='true'
                >
                    <button
                        type='button'
                        className='flat-iconbtn'
                        title={t('recognize.pin')}
                        aria-label={t('recognize.pin')}
                        aria-pressed={pined}
                        onClick={() => {
                            appWindow.setAlwaysOnTop(!pined);
                            setPined(!pined);
                        }}
                    >
                        <BsPinFill className={`text-[18px] ${pined ? 'text-accent' : ''}`} />
                    </button>
                    {osType !== 'Darwin' && (
                        <div className='recognize-controls'>
                            <WindowControl />
                        </div>
                    )}
                </div>
                <div className='recognize-panes'>
                    <ImageArea />
                    <TextArea serviceInstanceConfigMap={serviceInstanceConfigMap} />
                </div>
                <ControlArea
                    serviceInstanceList={serviceInstanceList}
                    serviceInstanceConfigMap={serviceInstanceConfigMap}
                />
            </div>
        )
    );
}
