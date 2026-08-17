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
    const [config, setConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.translate.baidu_field.title'),
            appid: '',
            secret: '',
            field: 'it',
        },
        { sync: false }
    );
    const [isLoading, setIsLoading] = useState(false);
    const fieldList = [
        'it',
        'finance',
        'machinery',
        'senimed',
        'novel',
        'academic',
        'aerospace',
        'wiki',
        'news',
        'law',
        'contract',
    ];

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
                            open('https://pot-app.com/docs/api/translate/baidu.html');
                        }}
                    >
                        {t('services.help')}
                    </Button>
                </div>
                <div className='config-item'>
                    <h3 className='my-auto'>{t('services.translate.deepl.type')}</h3>
                    <Dropdown>
                        <Button variant='outline'>{t(`services.translate.baidu_field.${config.field}`)}</Button>
                        <Dropdown.Popover>
                            <Dropdown.Menu
                                autoFocus='first'
                                aria-label='app language'
                                className='max-h-[50vh] overflow-y-auto'
                                onAction={(key) => {
                                    setConfig({
                                        ...config,
                                        field: key,
                                    });
                                }}
                            >
                                {fieldList.map((item) => {
                                    return (
                                        <Dropdown.Item
                                            key={item}
                                            id={item}
                                        >
                                            {t(`services.translate.baidu_field.${item}`)}
                                        </Dropdown.Item>
                                    );
                                })}
                            </Dropdown.Menu>
                        </Dropdown.Popover>
                    </Dropdown>
                </div>
                <div className={'config-item'}>
                    <TextField
                        className='flex w-full justify-between'
                        value={config['appid']}
                        onChange={(value) => {
                            setConfig({
                                ...config,
                                appid: value,
                            });
                        }}
                    >
                        <Label className='text-base my-auto'>{t('services.translate.baidu.appid')}</Label>
                        <Input className='max-w-[50%]' />
                    </TextField>
                </div>
                <div className={'config-item'}>
                    <TextField
                        className='flex w-full justify-between'
                        value={config['secret']}
                        onChange={(value) => {
                            setConfig({
                                ...config,
                                secret: value,
                            });
                        }}
                    >
                        <Label className='text-base my-auto'>{t('services.translate.baidu.secret')}</Label>
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
