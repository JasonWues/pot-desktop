import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import InstanceNameInput from '../../../components/InstanceNameInput';
import { Input, Button, Label, TextField } from '@heroui/react';
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
    const [config, setConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.translate.youdao.title'),
            appkey: '',
            key: '',
        },
        { sync: false }
    );
    const [isLoading, setIsLoading] = useState(false);

    const toastStyle = useToastStyle();

    return (
        config !== null && (
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    setIsLoading(true);
                    translate('hello', Language.auto, Language.zh_cn, { config }).then(
                        () => {
                            setIsLoading(false);
                            setConfig(config, true);
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
                    config={config}
                    onChange={setConfig}
                />
                <div className={'config-item'}>
                    <h3 className='my-auto'>{t('services.help')}</h3>
                    <Button
                        onPress={() => {
                            open('https://pot-app.com/docs/api/translate/youdao.html');
                        }}
                    >
                        {t('services.help')}
                    </Button>
                </div>
                <div className={'config-item'}>
                    <TextField
                        className='flex w-full justify-between'
                        value={config['appkey']}
                        onChange={(value) => {
                            setConfig({
                                ...config,
                                appkey: value,
                            });
                        }}
                    >
                        <Label className='text-base my-auto'>{t('services.translate.youdao.appkey')}</Label>
                        <Input className='max-w-[50%]' />
                    </TextField>
                </div>
                <div className={'config-item'}>
                    <TextField
                        className='flex w-full justify-between'
                        value={config['key']}
                        onChange={(value) => {
                            setConfig({
                                ...config,
                                key: value,
                            });
                        }}
                    >
                        <Label className='text-base my-auto'>{t('services.translate.youdao.key')}</Label>
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
