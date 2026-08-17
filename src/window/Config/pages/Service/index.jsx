import { readDir, BaseDirectory, readTextFile, exists } from '@tauri-apps/plugin-fs';
import { listen } from '@tauri-apps/api/event';
import { useTranslation } from 'react-i18next';
/*
  v3 splits each v2 `<Tab title=…>content</Tab>` in two: a Tabs.Tab carrying the
  label, inside Tabs.List, and a separate Tabs.Panel carrying the content. The
  two are matched by `id`, where v2 used React's `key`.

  Tabs is a collection component, so getting this wrong is not a layout problem:
  the v2 arrangement threw "cannot be rendered outside a collection" and took the
  whole Service page down with it.
*/
import { Tabs } from '@heroui/react';
import { appConfigDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/core';
import React, { useEffect, useState } from 'react';
import Translate from './Translate';
import Recognize from './Recognize';
import Collection from './Collection';
import Tts from './Tts';
import { ServiceType } from '../../../../utils/service_instance';

let unlisten = null;

export default function Service() {
    const [pluginList, setPluginList] = useState(null);
    const { t } = useTranslation();

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
        if (unlisten) {
            unlisten.then((f) => {
                f();
            });
        }
        unlisten = listen('reload_plugin_list', loadPluginList);
        return () => {
            if (unlisten) {
                unlisten.then((f) => {
                    f();
                });
            }
        };
    }, []);
    return (
        pluginList !== null && (
            /*
              v2 put `className` on the tab-list wrapper, so `justify-center
              max-h-[calc(100%-40px)] overflow-y-auto` here only ever constrained
              the strip of tab labels. v3 puts it on the root, which also wraps
              every panel -- the clamp then cut the panel short and gave the page
              a second scrollbar outside the list's own, with the two "add
              service" buttons stranded past the fold. The panel content already
              carries `h-[calc(100vh-120px)] overflow-y-auto`, which is the one
              scroller this page should have.
            */
            <Tabs className='flex h-full flex-col'>
                <Tabs.ListContainer>
                    <Tabs.List
                        className='justify-center'
                        aria-label={t('config.service.label')}
                    >
                        <Tabs.Tab id='translate'>
                            {t(`config.service.translate`)}
                            <Tabs.Indicator />
                        </Tabs.Tab>
                        <Tabs.Tab id='recognize'>
                            {t(`config.service.recognize`)}
                            <Tabs.Indicator />
                        </Tabs.Tab>
                        <Tabs.Tab id='tts'>
                            {t(`config.service.tts`)}
                            <Tabs.Indicator />
                        </Tabs.Tab>
                        <Tabs.Tab id='collection'>
                            {t(`config.service.collection`)}
                            <Tabs.Indicator />
                        </Tabs.Tab>
                    </Tabs.List>
                </Tabs.ListContainer>
                <Tabs.Panel id='translate'>
                    <Translate pluginList={pluginList[ServiceType.TRANSLATE]} />
                </Tabs.Panel>
                <Tabs.Panel id='recognize'>
                    <Recognize pluginList={pluginList[ServiceType.RECOGNIZE]} />
                </Tabs.Panel>
                <Tabs.Panel id='tts'>
                    <Tts pluginList={pluginList[ServiceType.TTS]} />
                </Tabs.Panel>
                <Tabs.Panel id='collection'>
                    <Collection pluginList={pluginList[ServiceType.COLLECTION]} />
                </Tabs.Panel>
            </Tabs>
        )
    );
}
