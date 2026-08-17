import { Dropdown, Button, Label } from '@heroui/react';
import { atom, useAtom, useSetAtom, useAtomValue } from 'jotai';
import { fetch, Body } from '../../../utils/http';
import { useTranslation } from 'react-i18next';
import { HiTranslate } from 'react-icons/hi';
import { GiCycle } from 'react-icons/gi';
import React, { useEffect } from 'react';
import { nanoid } from 'nanoid';
import * as builtinService from '../../../services/recognize';
import { languageList } from '../../../utils/language';
import { useConfig } from '../../../hooks';
import { textAtom } from '../TextArea';
import { pluginListAtom } from '..';
import { osType } from '../../../utils/env';
import {
    ServiceSourceType,
    getServiceSouceType,
    getServiceName,
    INSTANCE_NAME_CONFIG_KEY,
    getDisplayInstanceName,
} from '../../../utils/service_instance';

export const currentServiceInstanceKeyAtom = atom();
export const languageAtom = atom();
export const recognizeFlagAtom = atom();

export default function ControlArea(props) {
    const { serviceInstanceConfigMap, serviceInstanceList } = props;
    const pluginList = useAtomValue(pluginListAtom);
    const [recognizeLanguage] = useConfig('recognize_language', 'auto');
    const [serverPort] = useConfig('server_port', 60828);
    const setRecognizeFlag = useSetAtom(recognizeFlagAtom);
    const [currentServiceInstanceKey, setCurrentServiceInstanceKey] = useAtom(currentServiceInstanceKeyAtom);
    const [language, setLanguage] = useAtom(languageAtom);
    const text = useAtomValue(textAtom);
    const { t } = useTranslation();

    function getInstanceName(instanceKey, serviceNameSupplier) {
        const instanceConfig = serviceInstanceConfigMap[instanceKey] ?? {};
        return getDisplayInstanceName(instanceConfig[INSTANCE_NAME_CONFIG_KEY], serviceNameSupplier);
    }

    useEffect(() => {
        if (serviceInstanceList) {
            setCurrentServiceInstanceKey(serviceInstanceList[0]);
        }
        if (recognizeLanguage) {
            setLanguage(recognizeLanguage);
        }
    }, [serviceInstanceList, recognizeLanguage]);

    return (
        <div className='flex justify-between px-[12px] h-full'>
            {currentServiceInstanceKey && (
                <Dropdown>
                    <Button
                        className='my-auto'
                        variant='secondary'
                        size='sm'
                    >
                        <img
                            className='h-[16px] w-[16px] my-auto'
                            src={
                                getServiceSouceType(currentServiceInstanceKey) === ServiceSourceType.PLUGIN
                                    ? pluginList[getServiceName(currentServiceInstanceKey)].icon
                                    : builtinService[getServiceName(currentServiceInstanceKey)].info.icon === 'system'
                                      ? `logo/${osType}.svg`
                                      : builtinService[getServiceName(currentServiceInstanceKey)].info.icon
                            }
                        />
                        {getServiceSouceType(currentServiceInstanceKey) === ServiceSourceType.PLUGIN
                            ? getInstanceName(
                                  currentServiceInstanceKey,
                                  () => pluginList[getServiceName(currentServiceInstanceKey)].display
                              )
                            : getInstanceName(currentServiceInstanceKey, () =>
                                  t(`services.recognize.${currentServiceInstanceKey}.title`)
                              )}
                    </Button>
                    <Dropdown.Popover>
                        <Dropdown.Menu
                            aria-label='service name'
                            className='max-h-[70vh] overflow-y-auto'
                            onAction={(key) => {
                                setCurrentServiceInstanceKey(key);
                            }}
                        >
                            {serviceInstanceList.map((instanceKey) => {
                                return (
                                    <Dropdown.Item
                                        key={instanceKey}
                                        id={instanceKey}
                                    >
                                        <img
                                            className='h-[16px] w-[16px] my-auto'
                                            src={
                                                getServiceSouceType(instanceKey) === ServiceSourceType.PLUGIN
                                                    ? pluginList[getServiceName(instanceKey)].icon
                                                    : builtinService[getServiceName(instanceKey)].info.icon === 'system'
                                                      ? `logo/${osType}.svg`
                                                      : builtinService[getServiceName(instanceKey)].info.icon
                                            }
                                        />
                                        {getServiceSouceType(instanceKey) === ServiceSourceType.PLUGIN
                                            ? getInstanceName(
                                                  instanceKey,
                                                  () => pluginList[getServiceName(instanceKey)].display
                                              )
                                            : getInstanceName(instanceKey, () =>
                                                  t(`services.recognize.${instanceKey}.title`)
                                              )}
                                    </Dropdown.Item>
                                );
                            })}
                        </Dropdown.Menu>
                    </Dropdown.Popover>
                </Dropdown>
            )}
            {language && (
                <Dropdown>
                    <Button
                        className='my-auto'
                        variant='secondary'
                        size='sm'
                    >
                        {t(`languages.${language}`)}
                    </Button>
                    <Dropdown.Popover>
                        <Dropdown.Menu
                            aria-label='language'
                            className='max-h-[70vh] overflow-y-auto'
                            onAction={(key) => {
                                setLanguage(key);
                            }}
                        >
                            <Dropdown.Item
                                key='auto'
                                id='auto'
                            >
                                <Label>{t('languages.auto')}</Label>
                            </Dropdown.Item>
                            {languageList.map((name) => {
                                return (
                                    <Dropdown.Item
                                        key={name}
                                        id={name}
                                    >
                                        {t(`languages.${name}`)}
                                    </Dropdown.Item>
                                );
                            })}
                        </Dropdown.Menu>
                    </Dropdown.Popover>
                </Dropdown>
            )}
            <Button
                variant='tertiary'
                size='sm'
                className='my-auto'
                onPress={() => {
                    setRecognizeFlag(nanoid());
                }}
            >
                <GiCycle className='text-[16px]' />
                {t('recognize.recognize')}
            </Button>
            <Button
                variant='tertiary'
                size='sm'
                className='my-auto'
                onPress={async () => {
                    if (text) {
                        void fetch(`http://127.0.0.1:${serverPort}/translate`, {
                            method: 'POST',
                            body: Body.text(text),
                            responseType: 2,
                        });
                    }
                }}
            >
                <HiTranslate className='text-[16px]' />
                {t('recognize.translate')}
            </Button>
        </div>
    );
}
