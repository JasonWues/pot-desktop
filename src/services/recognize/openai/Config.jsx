import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import InstanceNameInput from '../../../components/InstanceNameInput';
import { Input, Button, TextArea, Label, TextField } from '@heroui/react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-shell';
import React, { useState } from 'react';

import { useConfig } from '../../../hooks/useConfig';
import { useToastStyle } from '../../../hooks';
import { recognize } from './index';
import { Language } from './index';

export const defaultRequestArguments = JSON.stringify({
    temperature: 0,
});

export const defaultSystemPrompt =
    'You are a professional OCR engine. Extract the text from the image exactly as it appears, keeping the original line breaks. Output only the extracted text, never explain it, never wrap it in code blocks.';

export const defaultUserPrompt = 'Recognize the text in $language from this image.';

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const [config, setConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.recognize.openai_ocr.title'),
            requestPath: 'https://api.openai.com/v1/chat/completions',
            model: 'gpt-4o-mini',
            apiKey: '',
            systemPrompt: defaultSystemPrompt,
            userPrompt: defaultUserPrompt,
            requestArguments: defaultRequestArguments,
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
                    recognize(
                        'iVBORw0KGgoAAAANSUhEUgAAADsAAAAeCAYAAACSRGY2AAAAAXNSR0IArs4c6QAAArNJREFUWEftl19IU1Ecxz+O5uQiNTCJkNj0ZWhkSOyh7CEy0CWZQQoTWYgvk17KFAdr9GBBYGb/qD0oUpgSCZViGkTRQ/hwEVOYIIhlMF8kUjbGZGPFdGtrGvcWzTa79/Gec+79fb7fc36/38nQ6/Xf+E+eDAV2mzqdns6WtDNRqYP5UQ71D8i2RoGVLdW/mqg4K6287G3sqHtEdYEP8clrdpZXYdCCxzWE/dkHjp5poXa/AMEVZodvU+ea2/Dn0n2NnK8wYsgVQAWEAng+TfHiZTddy75NI83LtdBRfSS2xruIONKNNftccs9sFPbLkpqcXUCmei1At2uO3YU6CKnR7AhDLDJ204bdH4u/tKSdjkodmvCrEKz6A2iE9fWEVhAftmF1JwBnmxm0msjPinzHH2A1U42GFcSJZYzGJCaodVhYnRqgZngUCmw8rStC419gzOnA7iuio8HG8b3wccTC2clIkFkWhppPkKcK4H7bTev7cWbDQ5kHcZxqorpQAO8M929dp+eHPgJtNXepNajh6wx9j+9E3BeoONBCc7mOnCx18rJxFDYGYmbwson85Sm67nXSB9SXO7loFPCIDzj2anwtdOPhTpxlueB+h7W3BzF+w6pM9F8wYxACTPc30jAfHTTR22ymeMP78HicEMkqPX8Ku5kAMV6Ba/VOKvQJu4GIkCzx5sYlWuOOxE8CphcsbBQxjBOFXeD5VQftiekr2aUnOc4qsNvV2W12ZuVlYx9irxWrO82zMXLqbFz5WseVqLNlOnKyU7DOhkP/qx2Uysf05BLFJVvQQf1uUxHdmIY9Fq5UxfW5wQCezxK9sbYKx+mTGPMi/fRW9cbSd4rUnyH71pP6KNIRKrDSGqXnDMXZ9PRNOmrF2USNtFotXq+XYDAoLV8Kz5DlrAKbwg7+KrTvuhRWXxXeDuUAAAAASUVORK5CYII=',
                        Language.auto,
                        { config }
                    ).then(
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
                            open('https://pot-app.com/docs/api/translate/openai.html');
                        }}
                    >
                        {t('services.help')}
                    </Button>
                </div>
                <div className={'config-item'}>
                    <TextField
                        className='flex w-full justify-between'
                        value={config['requestPath']}
                        onChange={(value) => {
                            setConfig({
                                ...config,
                                requestPath: value,
                            });
                        }}
                    >
                        <Label className='text-base my-auto'>{t('services.recognize.openai_ocr.request_path')}</Label>
                        <Input
                            variant='bordered'
                            className='max-w-[50%]'
                        />
                    </TextField>
                </div>
                <div className={'config-item'}>
                    <TextField
                        className='flex w-full justify-between'
                        value={config['apiKey']}
                        onChange={(value) => {
                            setConfig({
                                ...config,
                                apiKey: value,
                            });
                        }}
                    >
                        <Label className='text-base my-auto'>{t('services.recognize.openai_ocr.api_key')}</Label>
                        <Input
                            type='password'
                            variant='bordered'
                            className='max-w-[50%]'
                        />
                    </TextField>
                </div>
                <div className={'config-item'}>
                    <TextField
                        className='flex w-full justify-between'
                        value={config['model']}
                        onChange={(value) => {
                            setConfig({
                                ...config,
                                model: value,
                            });
                        }}
                    >
                        <Label className='text-base my-auto'>{t('services.recognize.openai_ocr.model')}</Label>
                        <Input
                            variant='bordered'
                            className='max-w-[50%]'
                        />
                    </TextField>
                </div>
                <h3 className='my-auto'>Prompt</h3>
                <p className='text-[10px] text-foreground'>{t('services.recognize.openai_ocr.prompt_description')}</p>
                <div className={'config-item'}>
                    <TextArea
                        label='system'
                        labelPlacement='outside'
                        variant='faded'
                        value={config['systemPrompt']}
                        placeholder='Input Some System Prompt'
                        onValueChange={(value) => {
                            setConfig({
                                ...config,
                                systemPrompt: value,
                            });
                        }}
                    />
                </div>
                <div className={'config-item'}>
                    <TextArea
                        label='user'
                        labelPlacement='outside'
                        variant='faded'
                        value={config['userPrompt']}
                        placeholder='Input Some User Prompt'
                        onValueChange={(value) => {
                            setConfig({
                                ...config,
                                userPrompt: value,
                            });
                        }}
                    />
                </div>
                <h3 className='my-auto'>Request Arguments</h3>
                <div className={'config-item'}>
                    <TextArea
                        label=''
                        labelPlacement='outside'
                        variant='faded'
                        value={config['requestArguments']}
                        placeholder='Input API Request Arguments'
                        onValueChange={(value) => {
                            setConfig({
                                ...config,
                                requestArguments: value,
                            });
                        }}
                    />
                </div>
                <br />
                <Button
                    type='submit'
                    isLoading={isLoading}
                    color='primary'
                    fullWidth
                >
                    {t('common.save')}
                </Button>
            </form>
        )
    );
}
