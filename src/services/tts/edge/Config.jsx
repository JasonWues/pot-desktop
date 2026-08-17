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

// SSML takes these as signed offsets from the voice's own baseline, not as
// multipliers, so 0 is "unchanged" rather than "silent"/"stopped".
const RATE_OPTIONS = [-50, -25, -10, 0, 10, 25, 50, 100];
const PITCH_OPTIONS = [-50, -25, -10, 0, 10, 25, 50];
const VOLUME_OPTIONS = [-50, -25, 0, 25, 50];

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const [edgeConfig, setEdgeConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.tts.edge_tts.title'),
            rate: 0,
            pitch: 0,
            volume: 0,
            // Keyed by the BCP-47 tag from `Language`. An absent or empty entry
            // means "let `matchVoice` pick one".
            voice: {},
        },
        { sync: false }
    );
    const [isLoading, setIsLoading] = useState(false);
    const [voiceList, setVoiceList] = useState([]);
    const [voiceListError, setVoiceListError] = useState('');
    const [editingLanguage, setEditingLanguage] = useState('en');

    const toastStyle = useToastStyle();

    useEffect(() => {
        getVoiceList().then(setVoiceList, (e) => setVoiceListError(e.toString()));
    }, []);

    const languageTag = Language[editingLanguage];
    const configuredVoice = edgeConfig?.voice?.[languageTag] ?? '';
    const autoVoice = matchVoice(voiceList, languageTag);
    // The catalogue carries ~500 voices across every locale; showing all of them
    // for one language would be unusable.
    const voicesForLanguage = voiceList.filter(
        (v) => (v.Locale ?? '').toLowerCase().split('-')[0] === (languageTag ?? '').toLowerCase().split('-')[0]
    );

    const setVoiceForCurrentLanguage = (name) => {
        setEdgeConfig({
            ...edgeConfig,
            voice: { ...edgeConfig.voice, [languageTag]: name },
        });
    };

    const offsetDropdown = (label, key, options, unit) => (
        <div className='config-item'>
            <h3 className='my-auto'>{label}</h3>
            <Dropdown>
                <Button variant='bordered'>{`${(edgeConfig[key] ?? 0) > 0 ? '+' : ''}${edgeConfig[key] ?? 0}${unit}`}</Button>
                <Dropdown.Popover>
                    <Dropdown.Menu
                        aria-label={key}
                        className='max-h-[50vh] overflow-y-auto'
                        onAction={(v) => setEdgeConfig({ ...edgeConfig, [key]: Number(v) })}
                    >
                        {options.map((v) => (
                            <Dropdown.Item
                                key={v}
                                id={v}
                            >{`${v > 0 ? '+' : ''}${v}${unit}`}</Dropdown.Item>
                        ))}
                    </Dropdown.Menu>
                </Dropdown.Popover>
            </Dropdown>
        </div>
    );

    return (
        edgeConfig !== null && (
            <>
                <Toaster />
                <InstanceNameInput
                    config={edgeConfig}
                    onChange={setEdgeConfig}
                />

                {offsetDropdown(t('services.tts.edge_tts.rate'), 'rate', RATE_OPTIONS, '%')}
                {offsetDropdown(t('services.tts.edge_tts.pitch'), 'pitch', PITCH_OPTIONS, 'Hz')}
                {offsetDropdown(t('services.tts.edge_tts.volume'), 'volume', VOLUME_OPTIONS, '%')}

                <div className='config-item'>
                    <h3 className='my-auto'>{t('services.tts.edge_tts.language')}</h3>
                    <Dropdown>
                        <Button variant='bordered'>{t(`languages.${editingLanguage}`)}</Button>
                        <Dropdown.Popover>
                            <Dropdown.Menu
                                aria-label='tts language'
                                className='max-h-[50vh] overflow-y-auto'
                                onAction={(key) => setEditingLanguage(key)}
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
                    <h3 className='my-auto'>{t('services.tts.edge_tts.voice')}</h3>
                    <Dropdown>
                        <Button variant='bordered'>
                            {configuredVoice === ''
                                ? `${t('services.tts.edge_tts.auto_voice')}${
                                      autoVoice === null ? '' : ` (${autoVoice.ShortName})`
                                  }`
                                : configuredVoice}
                        </Button>
                        <Dropdown.Popover>
                            <Dropdown.Menu
                                aria-label='tts voice'
                                className='max-h-[50vh] overflow-y-auto'
                                onAction={(key) => setVoiceForCurrentLanguage(key === '__auto__' ? '' : key)}
                            >
                                <Dropdown.Item
                                    key='__auto__'
                                    id='__auto__'
                                >
                                    <Label>{t('services.tts.edge_tts.auto_voice')}</Label>
                                </Dropdown.Item>
                                {voicesForLanguage.map((v) => (
                                    <Dropdown.Item
                                        key={v.ShortName}
                                        id={v.ShortName}
                                    >{`${v.ShortName} (${v.Gender})`}</Dropdown.Item>
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
                            tts('hello', Language.en, { config: edgeConfig }).then(
                                () => {
                                    setIsLoading(false);
                                    setEdgeConfig(edgeConfig, true);
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
