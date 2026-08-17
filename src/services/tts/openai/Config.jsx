import { Button, Input, Dropdown, Label, TextField } from '@heroui/react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-shell';
import React, { useState } from 'react';

import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import InstanceNameInput from '../../../components/InstanceNameInput';
import { useConfig } from '../../../hooks/useConfig';
import { useToastStyle } from '../../../hooks';
import { DEFAULT_MODEL, DEFAULT_REQUEST_PATH, SPEED_OPTIONS, VOICE_OPTIONS } from './index';
import { Language } from './index';
import { tts } from './index';

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const [openaiTtsConfig, setOpenaiTtsConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.tts.openai_tts.title'),
            requestPath: DEFAULT_REQUEST_PATH,
            apiKey: '',
            model: DEFAULT_MODEL,
            voice: 'alloy',
            speed: 1,
        },
        { sync: false }
    );
    const [isLoading, setIsLoading] = useState(false);

    const toastStyle = useToastStyle();

    return (
        openaiTtsConfig !== null && (
            <>
                <Toaster />
                <InstanceNameInput
                    config={openaiTtsConfig}
                    onChange={setOpenaiTtsConfig}
                />
                <div className={'config-item'}>
                    <h3 className='my-auto'>{t('services.help')}</h3>
                    <Button
                        onPress={() => {
                            open('https://platform.openai.com/docs/guides/text-to-speech');
                        }}
                    >
                        {t('services.help')}
                    </Button>
                </div>
                <div className='config-item'>
                    <TextField
                        className='flex w-full flex-row items-center justify-between'
                        value={openaiTtsConfig['requestPath']}
                        onChange={(value) => {
                            setOpenaiTtsConfig({
                                ...openaiTtsConfig,
                                requestPath: value,
                            });
                        }}
                    >
                        <Label className='text-base my-auto'>{t('services.tts.openai_tts.request_path')}</Label>
                        <Input className='max-w-[50%]' />
                    </TextField>
                </div>
                <div className='config-item'>
                    <TextField
                        className='flex w-full flex-row items-center justify-between'
                        value={openaiTtsConfig['apiKey']}
                        onChange={(value) => {
                            setOpenaiTtsConfig({
                                ...openaiTtsConfig,
                                apiKey: value,
                            });
                        }}
                    >
                        <Label className='text-base my-auto'>{t('services.tts.openai_tts.api_key')}</Label>
                        <Input
                            type='password'
                            className='max-w-[50%]'
                        />
                    </TextField>
                </div>
                <div className='config-item'>
                    <TextField
                        className='flex w-full flex-row items-center justify-between'
                        value={openaiTtsConfig['model']}
                        onChange={(value) => {
                            setOpenaiTtsConfig({
                                ...openaiTtsConfig,
                                model: value,
                            });
                        }}
                    >
                        <Label className='text-base my-auto'>{t('services.tts.openai_tts.model')}</Label>
                        <Input className='max-w-[50%]' />
                    </TextField>
                </div>
                <div className='config-item'>
                    <h3 className='my-auto'>{t('services.tts.openai_tts.voice')}</h3>
                    <Dropdown>
                        <Button variant='outline'>{openaiTtsConfig['voice']}</Button>
                        <Dropdown.Popover>
                            <Dropdown.Menu
                                aria-label='openai tts voice'
                                onAction={(key) => {
                                    setOpenaiTtsConfig({
                                        ...openaiTtsConfig,
                                        voice: key,
                                    });
                                }}
                            >
                                {VOICE_OPTIONS.map((voice) => (
                                    <Dropdown.Item
                                        key={voice}
                                        id={voice}
                                    >
                                        <Label>{voice}</Label>
                                    </Dropdown.Item>
                                ))}
                            </Dropdown.Menu>
                        </Dropdown.Popover>
                    </Dropdown>
                </div>
                <div className='config-item'>
                    <h3 className='my-auto'>{t('services.tts.openai_tts.speed')}</h3>
                    <Dropdown>
                        <Button variant='outline'>{`${openaiTtsConfig['speed'] ?? 1}x`}</Button>
                        <Dropdown.Popover>
                            <Dropdown.Menu
                                aria-label='openai tts speed'
                                onAction={(key) => {
                                    setOpenaiTtsConfig({
                                        ...openaiTtsConfig,
                                        speed: Number(key),
                                    });
                                }}
                            >
                                {SPEED_OPTIONS.map((speed) => (
                                    <Dropdown.Item
                                        key={speed}
                                        id={speed}
                                    >{`${speed}x`}</Dropdown.Item>
                                ))}
                            </Dropdown.Menu>
                        </Dropdown.Popover>
                    </Dropdown>
                </div>
                <div>
                    <Button
                        variant='primary'
                        isPending={isLoading}
                        fullWidth
                        onPress={() => {
                            setIsLoading(true);
                            tts('hello', Language.en, { config: openaiTtsConfig }).then(
                                () => {
                                    setIsLoading(false);
                                    setOpenaiTtsConfig(openaiTtsConfig, true);
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
