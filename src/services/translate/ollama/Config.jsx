import PromptListEditor, { CHAT_PROMPT_SCHEMA } from '../../../components/ServiceConfigForm/PromptListEditor';
import { Button, Card, CardContent, InputGroup, Label, Link, ProgressBar, TextField, Tooltip } from '@heroui/react';
import {
    HelpLink,
    ConfigItem,
    SwitchConfigField,
    TextConfigField,
} from '../../../components/ServiceConfigForm/ConfigField';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import ServiceConfigForm from '../../../components/ServiceConfigForm';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ollama } from 'ollama/browser';

import { translate } from './index';
import { Language } from './index';

const defaultPromptList = [
    {
        role: 'system',
        content:
            'You are a professional translation engine, please translate the text into a colloquial, professional, elegant and fluent content, without the style of machine translation. You must only translate the text content, never interpret it.',
    },
    { role: 'user', content: `Translate into $to:\n"""\n$text\n"""` },
];

// A component rather than the render prop's body: the model list is fetched
// from the Ollama host, which needs state and an effect, and hooks cannot live
// inside a render callback.
function OllamaFields({ config, setConfig }) {
    const { t } = useTranslation();
    const [isPulling, setIsPulling] = useState(false);
    const [progress, setProgress] = useState(0);
    const [pullingStatus, setPullingStatus] = useState('');
    const [installedModels, setInstalledModels] = useState(null);

    async function getModles() {
        try {
            const ollama = new Ollama({ host: config.requestPath });
            const list = await ollama.list();
            setInstalledModels(list);
        } catch {
            setInstalledModels(null);
        }
    }

    // Keyed on the host alone. The old effect watched the whole config, so it
    // re-listed the models on every keystroke in the model name too.
    useEffect(() => {
        getModles();
    }, [config.requestPath]);

    async function pullModel() {
        setIsPulling(true);
        const ollama = new Ollama({ host: config.requestPath });
        const stream = await ollama.pull({ model: config.model, stream: true });
        for await (const part of stream) {
            if (part.digest) {
                let percent = 0;
                if (part.completed && part.total) {
                    percent = Math.round((part.completed / part.total) * 100);
                }
                setProgress(percent);
                setPullingStatus(part.status);
            } else {
                setProgress(0);
                setPullingStatus(part.status);
            }
        }
        setProgress(0);
        setPullingStatus('');
        setIsPulling(false);
        getModles();
    }

    const isModelInstalled =
        installedModels !== null && installedModels.models.map((model) => model.name).includes(config['model']);

    return (
        <>
            {installedModels === null && (
                <Card
                    isBlurred
                    className='border-none bg-danger/20 dark:bg-danger/10'
                    shadow='sm'
                >
                    <CardContent>
                        <div>
                            {t('services.translate.ollama.install_ollama')}
                            <br />
                            <Link
                                isExternal
                                href='https://ollama.com/download'
                                color='primary'
                            >
                                {t('services.translate.ollama.install_ollama_link')}
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            )}
            <HelpLink url='https://pot-app.com/docs/api/translate/ollama.html' />
            <SwitchConfigField
                label={t('services.translate.ollama.stream')}
                value={config['stream']}
                onChange={(value) => setConfig({ ...config, stream: value })}
            />
            <TextConfigField
                label={t('services.translate.ollama.request_path')}
                value={config['requestPath']}
                onChange={(value) => setConfig({ ...config, requestPath: value })}
            />
            {/* Not a TextConfigField: this box carries the pull button. */}
            <ConfigItem>
                <TextField
                    className='flex w-full flex-row items-center justify-between'
                    value={config['model']}
                    onChange={(value) => {
                        setConfig({ ...config, model: value });
                    }}
                >
                    <Label className='text-base my-auto'>{t('services.translate.ollama.model')}</Label>
                    {/* InputGroup, not a child of Input: v3's Input renders a
                        real <input>, which is a void element. The pull button
                        is a Suffix, which is what v2's `endContent` meant. */}
                    <InputGroup className='max-w-[50%]'>
                        <InputGroup.Input />
                        <InputGroup.Suffix>
                            {installedModels && !isModelInstalled ? (
                                <Tooltip>
                                    <Tooltip.Trigger>
                                        <Button
                                            size='sm'
                                            variant='tertiary'
                                            isPending={isPulling}
                                            onPress={pullModel}
                                        >
                                            {t('services.translate.ollama.install_model')}
                                        </Button>
                                    </Tooltip.Trigger>
                                    <Tooltip.Content>{t('services.translate.ollama.not_installed')}</Tooltip.Content>
                                </Tooltip>
                            ) : (
                                <Button
                                    size='sm'
                                    variant='tertiary'
                                    disabled
                                >
                                    {t('services.translate.ollama.ready')}
                                </Button>
                            )}
                        </InputGroup.Suffix>
                    </InputGroup>
                </TextField>
            </ConfigItem>
            <Card
                isBlurred
                className='border-none bg-success/20 dark:bg-success/10'
                shadow='sm'
            >
                <CardContent>
                    {/* See the Updater window for the same shape: v3 drops
                        `label`, `showValueLabel` and `classNames`, so the
                        status line is markup and each slot becomes a className
                        on the part it named. */}
                    {isPulling && (
                        <ProgressBar
                            aria-label={pullingStatus}
                            value={progress}
                            className='max-w-md'
                        >
                            <div className='flex justify-between'>
                                <span className='tracking-wider font-medium text-muted'>{pullingStatus}</span>
                                <ProgressBar.Output className='text-foreground/60' />
                            </div>
                            <ProgressBar.Track className='drop-shadow-md border border-default'>
                                <ProgressBar.Fill className='bg-linear-to-r from-pink-500 to-yellow-500' />
                            </ProgressBar.Track>
                        </ProgressBar>
                    )}
                    <div className='flex justify-center'>
                        <Link
                            isExternal
                            href='https://ollama.com/library'
                            color='primary'
                        >
                            {t('services.translate.ollama.supported_models')}
                        </Link>
                    </div>
                </CardContent>
            </Card>
            <PromptListEditor
                promptList={config.promptList}
                schema={CHAT_PROMPT_SCHEMA}
                description={t('services.translate.ollama.prompt_description')}
                addLabel={t('services.translate.ollama.add')}
                onChange={(promptList) => setConfig({ ...config, promptList })}
            />
        </>
    );
}

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();

    return (
        <ServiceConfigForm
            instanceKey={instanceKey}
            defaultConfig={{
                [INSTANCE_NAME_CONFIG_KEY]: t('services.translate.ollama.title'),
                stream: true,
                model: 'gemma:2b',
                requestPath: 'http://localhost:11434',
                promptList: defaultPromptList,
            }}
            onTest={(config) => translate('hello', Language.auto, Language.zh_cn, { config })}
            updateServiceList={updateServiceList}
            onClose={onClose}
        >
            {(config, setConfig) => (
                <OllamaFields
                    config={config}
                    setConfig={setConfig}
                />
            )}
        </ServiceConfigForm>
    );
}
