import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import InstanceNameInput from '../../../components/InstanceNameInput';
import { Input, Button, Switch, TextArea, Label, TextField } from '@heroui/react';
import { MdDeleteOutline } from 'react-icons/md';
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
    const [serviceConfig, setServiceConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.translate.geminipro.title'),
            stream: true,
            apiKey: '',
            requestPath: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro',
            promptList: [
                {
                    role: 'user',
                    parts: [
                        {
                            text: 'You are a professional translation engine, please translate the text into a colloquial, professional, elegant and fluent content, without the style of machine translation. You must only translate the text content, never interpret it.',
                        },
                    ],
                },
                {
                    role: 'model',
                    parts: [
                        {
                            text: 'Ok, I will only translate the text content, never interpret it.',
                        },
                    ],
                },
                {
                    role: 'user',
                    parts: [
                        {
                            text: `Translate into Chinese\n"""\nhello\n"""`,
                        },
                    ],
                },
                {
                    role: 'model',
                    parts: [
                        {
                            text: '你好',
                        },
                    ],
                },
                {
                    role: 'user',
                    parts: [
                        {
                            text: `Translate into $to\n"""\n$text\n"""`,
                        },
                    ],
                },
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
                            open('https://pot-app.com/docs/api/translate/geminipro.html');
                        }}
                    >
                        {t('services.help')}
                    </Button>
                </div>
                <div className='config-item'>
                    <Switch
                        isSelected={serviceConfig['stream']}
                        onValueChange={(value) => {
                            setServiceConfig({
                                ...serviceConfig,
                                stream: value,
                            });
                        }}
                        className='flex flex-row-reverse justify-between w-full max-w-full'
                    >
                        {t('services.translate.geminipro.stream')}
                    </Switch>
                </div>
                <div className='config-item'>
                    <TextField
                        className='flex w-full justify-between'
                        value={serviceConfig['requestPath']}
                        onChange={(value) => {
                            setServiceConfig({
                                ...serviceConfig,
                                requestPath: value,
                            });
                        }}
                    >
                        <Label className='text-base my-auto'>{t('services.translate.geminipro.request_path')}</Label>
                        <Input
                            variant='bordered'
                            className='max-w-[50%]'
                        />
                    </TextField>
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
                        <Label className='text-base my-auto'>{t('services.translate.geminipro.api_key')}</Label>
                        <Input
                            type='password'
                            variant='bordered'
                            className='max-w-[50%]'
                        />
                    </TextField>
                </div>
                <h3 className='my-auto'>Prompt List</h3>
                <p className='text-[10px] text-foreground'>{t('services.translate.geminipro.prompt_description')}</p>

                <div className='bg-surface-secondary rounded-[10px] p-3'>
                    {serviceConfig.promptList &&
                        serviceConfig.promptList.map((prompt, index) => {
                            return (
                                <div className='config-item'>
                                    <TextArea
                                        label={prompt.role}
                                        labelPlacement='outside'
                                        variant='faded'
                                        value={prompt.parts[0].text}
                                        placeholder={`Input Some ${prompt.role} Prompt`}
                                        onValueChange={(value) => {
                                            setServiceConfig({
                                                ...serviceConfig,
                                                promptList: serviceConfig.promptList.map((p, i) => {
                                                    if (i === index) {
                                                        return {
                                                            role: index % 2 !== 0 ? 'model' : 'user',
                                                            parts: [
                                                                {
                                                                    text: value,
                                                                },
                                                            ],
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
                                        color='danger'
                                        className='my-auto mx-1'
                                        variant='flat'
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
                                        role: serviceConfig.promptList.length % 2 === 0 ? 'user' : 'model',
                                        parts: [
                                            {
                                                text: '',
                                            },
                                        ],
                                    },
                                ],
                            });
                        }}
                    >
                        {t('services.translate.geminipro.add')}
                    </Button>
                </div>
                <br />
                <Button
                    type='submit'
                    isLoading={isLoading}
                    fullWidth
                    color='primary'
                >
                    {t('common.save')}
                </Button>
            </form>
        )
    );
}
