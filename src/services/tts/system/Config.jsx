import { Button, Dropdown, Label } from '@heroui/react';
import React, { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import InstanceNameInput from '../../../components/InstanceNameInput';
import { useConfig } from '../../../hooks/useConfig';
import { useToastStyle } from '../../../hooks';
import { getVoiceList, matchVoice } from './index';
import { Language } from './index';
import { tts } from './index';

const RATE_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const [systemTtsConfig, setSystemTtsConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.tts.system_tts.title'),
            rate: 1,
            // Keyed by the BCP-47 tag from `Language`, so zh_cn and zh_tw can
            // hold different voices. An absent or empty entry means "let
            // `matchVoice` pick one".
            voice: {},
        },
        { sync: false }
    );
    const [isLoading, setIsLoading] = useState(false);
    const [voiceList, setVoiceList] = useState([]);
    const [voiceListError, setVoiceListError] = useState('');
    // Which language the voice dropdown below is editing. Configuring all 30
    // languages at once would be a wall of dropdowns, and almost nobody needs
    // more than one or two.
    const [editingLanguage, setEditingLanguage] = useState('en');

    const toastStyle = useToastStyle();

    useEffect(() => {
        getVoiceList().then(setVoiceList, (e) => setVoiceListError(e.toString()));
    }, []);

    const languageTag = Language[editingLanguage];
    const configuredVoice = systemTtsConfig?.voice?.[languageTag] ?? '';
    const autoVoice = matchVoice(voiceList, languageTag);

    const setVoiceForCurrentLanguage = (name) => {
        setSystemTtsConfig({
            ...systemTtsConfig,
            voice: {
                ...systemTtsConfig.voice,
                [languageTag]: name,
            },
        });
    };

    return (
        systemTtsConfig !== null && (
            <>
                <Toaster />
                <InstanceNameInput
                    config={systemTtsConfig}
                    onChange={setSystemTtsConfig}
                />

                <div className='config-item'>
                    <h3 className='my-auto'>{t('services.tts.system_tts.rate')}</h3>
                    <Dropdown>
                        <Button variant='bordered'>{`${systemTtsConfig.rate ?? 1}x`}</Button>
                        <Dropdown.Popover>
                            <Dropdown.Menu
                                aria-label='tts rate'
                                onAction={(key) => {
                                    setSystemTtsConfig({
                                        ...systemTtsConfig,
                                        rate: Number(key),
                                    });
                                }}
                            >
                                {RATE_OPTIONS.map((rate) => (
                                    <Dropdown.Item
                                        key={rate}
                                        id={rate}
                                    >{`${rate}x`}</Dropdown.Item>
                                ))}
                            </Dropdown.Menu>
                        </Dropdown.Popover>
                    </Dropdown>
                </div>

                <div className='config-item'>
                    <h3 className='my-auto'>{t('services.tts.system_tts.language')}</h3>
                    <Dropdown>
                        <Button variant='bordered'>{t(`languages.${editingLanguage}`)}</Button>
                        <Dropdown.Popover>
                            <Dropdown.Menu
                                aria-label='tts language'
                                className='max-h-[50vh] overflow-y-auto'
                                onAction={(key) => {
                                    setEditingLanguage(key);
                                }}
                            >
                                {Object.keys(Language).map((language) => (
                                    <Dropdown.Item
                                        key={language}
                                        id={language}
                                    >
                                        {t(`languages.${language}`)}
                                    </Dropdown.Item>
                                ))}
                            </Dropdown.Menu>
                        </Dropdown.Popover>
                    </Dropdown>
                </div>

                <div className='config-item'>
                    <h3 className='my-auto'>{t('services.tts.system_tts.voice')}</h3>
                    <Dropdown>
                        <Button variant='bordered'>
                            {configuredVoice === ''
                                ? `${t('services.tts.system_tts.auto_voice')}${
                                      autoVoice === null ? '' : ` (${autoVoice.name})`
                                  }`
                                : configuredVoice}
                        </Button>
                        <Dropdown.Popover>
                            <Dropdown.Menu
                                aria-label='tts voice'
                                className='max-h-[50vh] overflow-y-auto'
                                onAction={(key) => {
                                    setVoiceForCurrentLanguage(key === '__auto__' ? '' : key);
                                }}
                            >
                                <Dropdown.Item
                                    key='__auto__'
                                    id='__auto__'
                                >
                                    <Label>{t('services.tts.system_tts.auto_voice')}</Label>
                                </Dropdown.Item>
                                {voiceList.map((v) => (
                                    <Dropdown.Item
                                        key={v.name}
                                        id={v.name}
                                    >{`${v.name} (${v.language})`}</Dropdown.Item>
                                ))}
                            </Dropdown.Menu>
                        </Dropdown.Popover>
                    </Dropdown>
                </div>

                {voiceListError !== '' && (
                    <div className='config-item'>
                        <p className='text-danger text-sm'>{voiceListError}</p>
                    </div>
                )}

                <div>
                    <Button
                        isLoading={isLoading}
                        fullWidth
                        color='primary'
                        onPress={() => {
                            setIsLoading(true);
                            tts('hello', Language.en, { config: systemTtsConfig }).then(
                                () => {
                                    setIsLoading(false);
                                    setSystemTtsConfig(systemTtsConfig, true);
                                    updateServiceList(instanceKey);
                                    onClose();
                                },
                                (e) => {
                                    setIsLoading(false);
                                    toast.error(t('config.service.test_failed') + e.toString(), { style: toastStyle });
                                }
                            );
                        }}
                    >
                        {t('common.save')}
                    </Button>
                </div>
            </>
        )
    );
}
