import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import InstanceNameInput from '../../../components/InstanceNameInput';
import { Button, Input, TextField } from '@heroui/react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-shell';
import React, { useState } from 'react';

import { useConfig } from '../../../hooks/useConfig';
import { useToastStyle } from '../../../hooks';
import { Language } from './index';
import { tts } from './index';

export function Config(props) {
    const [isLoading, setIsLoading] = useState(false);
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const [lingvaConfig, setLingvaConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.tts.lingva_tts.title'),
            requestPath: 'lingva.pot-app.com',
        },
        { sync: false }
    );

    const toastStyle = useToastStyle();

    return (
        lingvaConfig !== null && (
            <>
                <Toaster />
                <InstanceNameInput
                    config={lingvaConfig}
                    onChange={setLingvaConfig}
                />
                <div className={'config-item'}>
                    <h3 className='my-auto'>{t('services.help')}</h3>
                    <Button
                        onPress={() => {
                            open('https://pot-app.com/docs/api/tts/lingva.html');
                        }}
                    >
                        {t('services.help')}
                    </Button>
                </div>
                <div className={'config-item'}>
                    <h3 className='my-auto'>{t('services.tts.lingva_tts.request_path')}</h3>
                    <TextField
                        className='flex w-full flex-row items-center justify-between max-w-[50%]'
                        value={lingvaConfig['requestPath']}
                        onChange={(value) => {
                            setLingvaConfig({
                                ...lingvaConfig,
                                requestPath: value,
                            });
                        }}
                        aria-label={t('services.tts.lingva_tts.request_path')}
                    >
                        <Input />
                    </TextField>
                </div>
                <div>
                    <Button
                        variant='primary'
                        isPending={isLoading}
                        fullWidth
                        onPress={() => {
                            setIsLoading(true);
                            tts('hello', Language.en, { config: lingvaConfig }).then(
                                () => {
                                    setIsLoading(false);
                                    setLingvaConfig(lingvaConfig, true);
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
