import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import InstanceNameInput from '../../../components/InstanceNameInput';
import { Input, Button, TextArea, Dropdown, Label, TextField } from '@heroui/react';
import { MdDeleteOutline } from 'react-icons/md';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-shell';
import React, { useState } from 'react';

import { useConfig } from '../../../hooks/useConfig';
import { useToastStyle } from '../../../hooks';
import { translate } from './index';
import { Language } from './index';

// https://docs.bigmodel.cn/cn/guide/start/model-overview#%E6%96%87%E6%9C%AC%E6%A8%A1%E5%9E%8B
const availableModels = [
    'glm-4.5',
    'glm-4.5-x',
    'glm-4.5-air',
    'glm-4.5-airx',
    'glm-4-plus',
    'glm-4-air-250414',
    'glm-4-long',
    'glm-4-airx',
    'glm-4-flashx-250414',
    'glm-z1-air',
    'glm-z1-airx',
    'glm-z1-flashx',
    'glm-4.5-flash',
    'glm-4-flash-250414',
    'glm-z1-flash',
];

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const [serviceConfig, setServiceConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.translate.chatglm.title'),
            model: 'chatglm_turbo',
            apiKey: '',
            promptList: [
                {
                    role: 'user',
                    content:
                        'You are a professional translation engine, please translate the text into a colloquial, professional, elegant and fluent content, without the style of machine translation. You must only translate the text content, never interpret it.',
                },
                { role: 'assistant', content: 'Ok, I will only translate the text content, never interpret it.' },
                { role: 'user', content: `Translate into Chinese\n"""\nhello\n"""` },
                { role: 'assistant', content: '你好' },
                { role: 'user', content: `Translate into $to\n"""\n$text\n"""` },
            ],
        },
        { sync: false }
    );
    const [isLoading, setIsLoading] = useState(false);

    const toastStyle = useToastStyle();

    return (
        serviceConfig !== null && (
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    setIsLoading(true);
                    translate('hello', Language.auto, Language.zh_cn, { config: serviceConfig }).then(
                        () => {
                            setIsLoading(false);
                            setServiceConfig(serviceConfig, true);
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
                    config={serviceConfig}
                    onChange={setServiceConfig}
                />
                <div className='config-item'>
                    <h3 className='my-auto'>{t('services.help')}</h3>
                    <Button
                        onPress={() => {
                            open('https://pot-app.com/docs/api/translate/chatglm.html');
                        }}
                    >
                        {t('services.help')}
                    </Button>
                </div>
                <div className='config-item'>
                    <h3 className='my-auto'>{t('services.translate.chatglm.model')}</h3>
                    <Dropdown>
                        <Button variant='secondary'>{serviceConfig.model}</Button>
                        <Dropdown.Popover>
                            <Dropdown.Menu
                                autoFocus='first'
                                aria-label='model'
                                onAction={(key) => {
                                    setServiceConfig({
                                        ...serviceConfig,
                                        model: key,
                                    });
                                }}
                            >
                                {availableModels.map((it) => (
                                    <Dropdown.Item
                                        key={it}
                                        id={it}
                                    >
                                        {it}
                                    </Dropdown.Item>
                                ))}
                            </Dropdown.Menu>
                        </Dropdown.Popover>
                    </Dropdown>
                </div>
                <div className='config-item'>
                    <TextField
                        className='flex w-full justify-between'
                        value={serviceConfig['apiKey']}
                        onChange={(value) => {
                            setServiceConfig({
                                ...serviceConfig,
                                apiKey: value,
                            });
                        }}
                    >
                        <Label className='text-base my-auto'>{t('services.translate.chatglm.api_key')}</Label>
                        <Input
                            type='password'
                            variant='secondary'
                            className='max-w-[50%]'
                        />
                    </TextField>
                </div>

                <h3 className='my-auto'>Prompt List</h3>
                <p className='text-[10px] text-foreground'>{t('services.translate.chatglm.prompt_description')}</p>

                <div className='bg-surface-secondary rounded-[10px] p-3'>
                    {serviceConfig.promptList &&
                        serviceConfig.promptList.map((prompt, index) => {
                            return (
                                <div className='config-item'>
                                    <TextArea
                                        label={prompt.role}
                                        labelPlacement='outside'
                                        variant='secondary'
                                        value={prompt.content}
                                        placeholder={`Input Some ${prompt.role} Prompt`}
                                        onValueChange={(value) => {
                                            setServiceConfig({
                                                ...serviceConfig,
                                                promptList: serviceConfig.promptList.map((p, i) => {
                                                    if (i === index) {
                                                        return {
                                                            role: index % 2 !== 0 ? 'assistant' : 'user',
                                                            content: value,
                                                        };
                                                    } else {
                                                        return p;
                                                    }
                                                }),
                                            });
                                        }}
                                    />
                                    <Button
                                        isIconOnly
                                        className='my-auto mx-1'
                                        variant='danger-soft'
                                        onPress={() => {
                                            setServiceConfig({
                                                ...serviceConfig,
                                                promptList: serviceConfig.promptList.filter((p, i) => i !== index),
                                            });
                                        }}
                                    >
                                        <MdDeleteOutline className='text-[18px]' />
                                    </Button>
                                </div>
                            );
                        })}
                    <Button
                        fullWidth
                        onPress={() => {
                            setServiceConfig({
                                ...serviceConfig,
                                promptList: [
                                    ...serviceConfig.promptList,
                                    {
                                        role: serviceConfig.promptList.length % 2 === 0 ? 'user' : 'assistant',
                                        content: '',
                                    },
                                ],
                            });
                        }}
                    >
                        {t('services.translate.chatglm.add')}
                    </Button>
                </div>
                <br />
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
