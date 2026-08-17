import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import InstanceNameInput from '../../../components/InstanceNameInput';
import { Input, Button, Dropdown, Label, TextField } from '@heroui/react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-shell';
import React, { useState } from 'react';

import { useConfig } from '../../../hooks/useConfig';
import { useToastStyle } from '../../../hooks';
import { translate } from './index';
import { Language } from './index';

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const [deeplConfig, setDeeplConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.translate.deepl.title'),
            type: 'free',
            authKey: '',
            customUrl: '',
        },
        { sync: false }
    );
    const [isLoading, setIsLoading] = useState(false);

    const toastStyle = useToastStyle();

    return (
        deeplConfig !== null && (
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    setIsLoading(true);
                    translate('hello', Language.auto, Language.zh_cn, { config: deeplConfig }).then(
                        () => {
                            setIsLoading(false);
                            setDeeplConfig(deeplConfig, true);
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
                <Toaster />
                <InstanceNameInput
                    config={deeplConfig}
                    onChange={setDeeplConfig}
                />
                <div className={`config-item ${deeplConfig.type === 'free' ? 'hidden' : ''}`}>
                    <h3 className='my-auto'>{t('services.help')}</h3>
                    <Button
                        onPress={() => {
                            const url =
                                deeplConfig.type === 'api'
                                    ? 'https://pot-app.com/docs/api/translate/deepl.html'
                                    : 'https://github.com/OwO-Network/DeepLX';
                            open(url);
                        }}
                    >
                        {t('services.help')}
                    </Button>
                </div>
                <div className='config-item'>
                    <h3 className='my-auto'>{t('services.translate.deepl.type')}</h3>
                    <Dropdown>
                        <Button variant='outline'>{t(`services.translate.deepl.${deeplConfig.type}`)}</Button>
                        <Dropdown.Popover>
                            <Dropdown.Menu
                                autoFocus='first'
                                aria-label='app language'
                                onAction={(key) => {
                                    setDeeplConfig({
                                        ...deeplConfig,
                                        type: key,
                                    });
                                }}
                            >
                                <Dropdown.Item
                                    key='free'
                                    id='free'
                                >
                                    <Label>{t(`services.translate.deepl.free`)}</Label>
                                </Dropdown.Item>
                                <Dropdown.Item
                                    key='api'
                                    id='api'
                                >
                                    <Label>{t(`services.translate.deepl.api`)}</Label>
                                </Dropdown.Item>
                                <Dropdown.Item
                                    key='deeplx'
                                    id='deeplx'
                                >
                                    <Label>{t(`services.translate.deepl.deeplx`)}</Label>
                                </Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown.Popover>
                    </Dropdown>
                </div>
                <div className={`config-item ${deeplConfig.type !== 'api' ? 'hidden' : ''}`}>
                    <TextField
                        className='flex w-full justify-between'
                        value={deeplConfig['authKey']}
                        onChange={(value) => {
                            setDeeplConfig({
                                ...deeplConfig,
                                authKey: value,
                            });
                        }}
                    >
                        <Label className='text-base my-auto'>{t('services.translate.deepl.auth_key')}</Label>
                        <Input
                            type='password'
                            className='max-w-[50%]'
                        />
                    </TextField>
                </div>
                <div className={`config-item ${deeplConfig.type !== 'deeplx' ? 'hidden' : ''}`}>
                    <TextField
                        className='flex w-full justify-between'
                        value={deeplConfig.customUrl}
                        onChange={(value) => {
                            setDeeplConfig({
                                ...deeplConfig,
                                customUrl: value,
                            });
                        }}
                    >
                        <Label className='text-base my-auto'>{t('services.translate.deepl.custom_url')}</Label>
                        <Input className='max-w-[50%]' />
                    </TextField>
                </div>
                <Button
                    variant='primary'
                    type='submit'
                    isPending={isLoading}
                    fullWidth
                >
                    {t('common.save')}
                </Button>
            </form>
        )
    );
}
