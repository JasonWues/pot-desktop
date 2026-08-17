import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import InstanceNameInput from '../../../components/InstanceNameInput';
import { Button, Input, Label, TextField } from '@heroui/react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-shell';
import React, { useState } from 'react';

import { useConfig } from '../../../hooks';
import { useToastStyle } from '../../../hooks';
import { collection } from './index';

export function Config(props) {
    const [isLoading, setIsLoading] = useState(false);
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const [config, setConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.collection.eudic.title'),
            name: 'pot',
            token: '',
        },
        { sync: false }
    );

    const toastStyle = useToastStyle();

    return (
        config !== null && (
            <>
                <Toaster />
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        setIsLoading(true);
                        collection('test', '测试', { config }).then(
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
                    <InstanceNameInput
                        config={config}
                        onChange={setConfig}
                    />
                    <div className={'config-item'}>
                        <h3 className='my-auto'>{t('services.help')}</h3>
                        <Button
                            onPress={() => {
                                open('https://pot-app.com/docs/api/collection/eudic.html');
                            }}
                        >
                            {t('services.help')}
                        </Button>
                    </div>
                    <div className={'config-item'}>
                        <TextField
                            className='flex w-full justify-between'
                            value={config['name']}
                            onChange={(value) => {
                                setConfig({
                                    ...config,
                                    name: value,
                                });
                            }}
                        >
                            <Label className='text-base my-auto'>{t('services.collection.eudic.name')}</Label>
                            <Input
                                variant='secondary'
                                className='max-w-[50%]'
                            />
                        </TextField>
                    </div>
                    <div className={'config-item'}>
                        <TextField
                            className='flex w-full justify-between'
                            value={config['token']}
                            onChange={(value) => {
                                setConfig({
                                    ...config,
                                    token: value,
                                });
                            }}
                        >
                            <Label className='text-base my-auto'>{t('services.collection.eudic.token')}</Label>
                            <Input
                                variant='secondary'
                                className='max-w-[50%]'
                            />
                        </TextField>
                    </div>
                    <div>
                        <Button
                            variant='primary'
                            type='submit'
                            isPending={isLoading}
                            fullWidth
                        >
                            {t('common.save')}
                        </Button>
                    </div>
                </form>
            </>
        )
    );
}
