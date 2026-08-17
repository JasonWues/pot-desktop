import {
    Card,
    CardContent,
    CardHeader,
    CardFooter,
    Button,
    ButtonGroup,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
    Spinner,
    Tooltip,
} from '@heroui/react';
import { BiCollapseVertical, BiExpandVertical } from 'react-icons/bi';
import { BaseDirectory, readTextFile } from '@tauri-apps/plugin-fs';
import { sendNotification } from '@tauri-apps/plugin-notification';
import React, { useEffect, useState, useRef } from 'react';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { TbTransformFilled } from 'react-icons/tb';
import { HiOutlineVolumeUp } from 'react-icons/hi';
import toast, { Toaster } from 'react-hot-toast';
import { MdContentCopy } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { GiCycle } from 'react-icons/gi';
import { useAtomValue } from 'jotai';
import { nanoid } from 'nanoid';
import { motion } from 'framer-motion';

import * as builtinCollectionServices from '../../../../services/collection';
import { sourceLanguageAtom, targetLanguageAtom, aiPresetAtom } from '../LanguageArea';
import { useConfig, useToastStyle, useVoice } from '../../../../hooks';
import { sourceTextAtom, detectLanguageAtom } from '../SourceArea';
import { invoke_plugin } from '../../../../utils/invoke_plugin';
import { applyPreset, DEFAULT_PRESET } from '../../../../utils/ai_presets';
import * as builtinServices from '../../../../services/translate';
import * as builtinTtsServices from '../../../../services/tts';
import { addToHistory, buildCacheKey, getCachedTranslation, setCachedTranslation } from '../../../../utils/db';

import { info, error as logError } from '@tauri-apps/plugin-log';
import {
    INSTANCE_NAME_CONFIG_KEY,
    ServiceSourceType,
    getDisplayInstanceName,
    getServiceName,
    getServiceSouceType,
    whetherPluginService,
} from '../../../../utils/service_instance';

let translateID = [];

export default function TargetArea(props) {
    const { index, name, translateServiceInstanceList, pluginList, serviceInstanceConfigMap, ...drag } = props;

    const [currentTranslateServiceInstanceKey, setCurrentTranslateServiceInstanceKey] = useState(name);
    function getInstanceName(instanceKey, serviceNameSupplier) {
        const instanceConfig = serviceInstanceConfigMap[instanceKey] ?? {};
        return getDisplayInstanceName(instanceConfig[INSTANCE_NAME_CONFIG_KEY], serviceNameSupplier);
    }

    const [appFontSize] = useConfig('app_font_size', 16);
    const [collectionServiceList] = useConfig('collection_service_list', []);
    const [ttsServiceList] = useConfig('tts_service_list', ['lingva_tts']);
    const [translateSecondLanguage] = useConfig('translate_second_language', 'en');
    const [historyDisable] = useConfig('history_disable', false);
    const [cacheEnable] = useConfig('translate_cache_enable', true);
    const [cacheTtlDays] = useConfig('translate_cache_ttl', 7);
    const [isLoading, setIsLoading] = useState(false);
    const [hide, setHide] = useState(true);

    const [result, setResult] = useState('');
    const [error, setError] = useState('');

    const sourceText = useAtomValue(sourceTextAtom);
    const sourceLanguage = useAtomValue(sourceLanguageAtom);
    const targetLanguage = useAtomValue(targetLanguageAtom);
    const aiPreset = useAtomValue(aiPresetAtom);
    const [autoCopy] = useConfig('translate_auto_copy', 'disable');
    const [hideWindow] = useConfig('translate_hide_window', false);
    const [clipboardMonitor] = useConfig('clipboard_monitor', false);

    const detectLanguage = useAtomValue(detectLanguageAtom);
    const [ttsPluginInfo, setTtsPluginInfo] = useState();
    const { t } = useTranslation();
    const textAreaRef = useRef();
    const toastStyle = useToastStyle();
    const speak = useVoice();

    useEffect(() => {
        if (error) {
            logError(`[${currentTranslateServiceInstanceKey}]happened error: ` + error);
        }
    }, [error]);

    // listen to translation
    useEffect(() => {
        setResult('');
        setError('');
        if (
            sourceText.trim() !== '' &&
            sourceLanguage &&
            targetLanguage &&
            autoCopy !== null &&
            hideWindow !== null &&
            clipboardMonitor !== null
        ) {
            if (autoCopy === 'source' && !clipboardMonitor) {
                writeText(sourceText).then(() => {
                    if (hideWindow) {
                        sendNotification({ title: t('common.write_clipboard'), body: sourceText });
                    }
                });
            }
            translate();
        }
    }, [
        sourceText,
        sourceLanguage,
        targetLanguage,
        autoCopy,
        hideWindow,
        currentTranslateServiceInstanceKey,
        clipboardMonitor,
        aiPreset,
    ]);

    function invokeOnce(fn) {
        let isInvoke = false;

        return (...args) => {
            if (isInvoke) {
                return;
            } else {
                fn(...args);
                isInvoke = true;
            }
        };
    }

    const translate = async () => {
        let id = nanoid();
        translateID[index] = id;

        const translateServiceName = getServiceName(currentTranslateServiceInstanceKey);
        const isPluginService = whetherPluginService(currentTranslateServiceInstanceKey);
        const savedConfig = serviceInstanceConfigMap[currentTranslateServiceInstanceKey];
        if (isPluginService && savedConfig) {
            // The plugin protocol expects this flag on the config. Setting it
            // before the cache key is derived keeps the key stable across calls.
            savedConfig['enable'] = 'true';
        }
        // A non-default preset swaps the prompt for this request only. It returns
        // a copy, so the saved config is untouched and -- because the cache key is
        // derived from the config that is actually used -- a polished result
        // cannot come back from the cache as a translation.
        const instanceConfig = applyPreset(savedConfig, translateServiceName, aiPreset);

        // Plugins declare their languages in info.json, built-in services in a
        // Language enum; both are keyed by pot's own language codes.
        const languageMap = isPluginService
            ? pluginList['translate'][translateServiceName].language
            : builtinServices[translateServiceName].Language;
        if (!(sourceLanguage in languageMap && targetLanguage in languageMap)) {
            setError('Language not supported');
            return;
        }

        // Translating into the language the text is already written in is not
        // useful, so fall back to the configured second language. That reasoning
        // only holds for translation: a summary of Chinese text into Chinese is
        // exactly what was asked for, and swapping to the second language there
        // would silently answer in the wrong one.
        const newTargetLanguage =
            aiPreset === DEFAULT_PRESET && sourceLanguage === 'auto' && targetLanguage === detectLanguage
                ? translateSecondLanguage
                : targetLanguage;

        const setHideOnce = invokeOnce(setHide);

        // Everything that has to happen once a translation exists, whether it
        // came back from the service or straight out of the cache.
        const finishTranslate = (v) => {
            setResult(typeof v === 'string' ? v.trim() : v);
            setIsLoading(false);
            if (v !== '') {
                setHideOnce(false);
            }
            if (!historyDisable) {
                addToHistory(
                    sourceText.trim(),
                    detectLanguage,
                    newTargetLanguage,
                    translateServiceName,
                    typeof v === 'string' ? v.trim() : v
                ).catch((e) => logError(`write history failed: ${e}`));
            }
            if (index === 0 && !clipboardMonitor) {
                switch (autoCopy) {
                    case 'target':
                        writeText(v).then(() => {
                            if (hideWindow) {
                                sendNotification({ title: t('common.write_clipboard'), body: v });
                            }
                        });
                        break;
                    case 'source_target':
                        writeText(sourceText.trim() + '\n\n' + v).then(() => {
                            if (hideWindow) {
                                sendNotification({
                                    title: t('common.write_clipboard'),
                                    body: sourceText.trim() + '\n\n' + v,
                                });
                            }
                        });
                        break;
                    default:
                        break;
                }
            }
        };

        const cacheKey = buildCacheKey({
            instanceKey: currentTranslateServiceInstanceKey,
            config: instanceConfig,
            from: sourceLanguage,
            to: newTargetLanguage,
            detect: detectLanguage,
            text: sourceText.trim(),
        });

        if (cacheEnable) {
            let cached = null;
            try {
                cached = await getCachedTranslation(cacheKey, cacheTtlDays);
            } catch (e) {
                // A broken cache must never stop a translation.
                logError(`read translation cache failed: ${e}`);
            }
            if (cached !== null) {
                if (translateID[index] !== id) return;
                info(`[${currentTranslateServiceInstanceKey}]cache hit`);
                finishTranslate(cached);
                return;
            }
        }

        setIsLoading(true);
        setHide(true);

        const onResolve = (v) => {
            info(`[${currentTranslateServiceInstanceKey}]resolve:` + v);
            if (translateID[index] !== id) return;
            // Only plain text is cached; dictionary services resolve with an
            // object whose shape is service specific.
            if (cacheEnable && typeof v === 'string' && v.trim() !== '') {
                setCachedTranslation(cacheKey, v.trim()).catch((e) => logError(`write translation cache failed: ${e}`));
            }
            finishTranslate(v);
        };

        const onReject = (e) => {
            info(`[${currentTranslateServiceInstanceKey}]reject:` + e);
            if (translateID[index] !== id) return;
            setError(e.toString());
            setIsLoading(false);
        };

        // Streaming services push partial text through this before resolving.
        const onPartialResult = (v) => {
            if (translateID[index] !== id) return;
            setResult(v);
            setHideOnce(false);
        };

        if (isPluginService) {
            let [func, utils] = await invoke_plugin('translate', translateServiceName);
            func(sourceText.trim(), languageMap[sourceLanguage], languageMap[newTargetLanguage], {
                config: instanceConfig,
                detect: detectLanguage,
                setResult: onPartialResult,
                utils,
            }).then(onResolve, onReject);
        } else {
            builtinServices[translateServiceName]
                .translate(sourceText.trim(), languageMap[sourceLanguage], languageMap[newTargetLanguage], {
                    config: instanceConfig,
                    detect: detectLanguage,
                    setResult: onPartialResult,
                })
                .then(onResolve, onReject);
        }
    };

    // hide empty textarea
    useEffect(() => {
        if (textAreaRef.current !== null) {
            textAreaRef.current.style.height = '0px';
            if (result !== '') {
                textAreaRef.current.style.height = textAreaRef.current.scrollHeight + 'px';
            }
        }
    }, [result]);

    // refresh tts config
    useEffect(() => {
        // `[]` is truthy, so the length check is what keeps `[0]` from being undefined
        // when every tts service has been removed.
        if (ttsServiceList?.length && getServiceSouceType(ttsServiceList[0]) === ServiceSourceType.PLUGIN) {
            readTextFile(`plugins/tts/${getServiceName(ttsServiceList[0])}/info.json`, {
                baseDir: BaseDirectory.AppConfig,
            }).then((infoStr) => {
                setTtsPluginInfo(JSON.parse(infoStr));
            });
        }
    }, [ttsServiceList]);

    // handle tts speak
    const handleSpeak = async () => {
        const instanceKey = ttsServiceList[0];
        if (getServiceSouceType(instanceKey) === ServiceSourceType.PLUGIN) {
            const pluginConfig = serviceInstanceConfigMap[instanceKey];
            if (!(targetLanguage in ttsPluginInfo.language)) {
                throw new Error('Language not supported');
            }
            let [func, utils] = await invoke_plugin('tts', getServiceName(instanceKey));
            let data = await func(result, ttsPluginInfo.language[targetLanguage], {
                config: pluginConfig,
                utils,
            });
            speak(data);
        } else {
            if (!(targetLanguage in builtinTtsServices[getServiceName(instanceKey)].Language)) {
                throw new Error('Language not supported');
            }
            const instanceConfig = serviceInstanceConfigMap[instanceKey];
            let data = await builtinTtsServices[getServiceName(instanceKey)].tts(
                result,
                builtinTtsServices[getServiceName(instanceKey)].Language[targetLanguage],
                {
                    config: instanceConfig,
                }
            );
            speak(data);
        }
    };

    return (
        <Card
            shadow='none'
            className='rounded-[10px]'
        >
            <Toaster />
            <CardHeader
                className={`flex justify-between py-1 px-0 bg-surface-secondary h-[30px] ${hide ? 'rounded-[10px]' : 'rounded-t-[10px]'}`}
                {...drag}
            >
                {/* current service instance and available service instance to change */}
                <div className='flex'>
                    <Dropdown>
                        <DropdownTrigger>
                            <Button
                                size='sm'
                                variant='solid'
                                className='bg-transparent'
                                startContent={
                                    whetherPluginService(currentTranslateServiceInstanceKey) ? (
                                        <img
                                            src={
                                                pluginList['translate'][
                                                    getServiceName(currentTranslateServiceInstanceKey)
                                                ].icon
                                            }
                                            className='h-[20px] my-auto'
                                        />
                                    ) : (
                                        <img
                                            src={
                                                builtinServices[getServiceName(currentTranslateServiceInstanceKey)].info
                                                    .icon
                                            }
                                            className='h-[20px] my-auto'
                                        />
                                    )
                                }
                            >
                                {whetherPluginService(currentTranslateServiceInstanceKey) ? (
                                    <div className='my-auto'>{`${getInstanceName(currentTranslateServiceInstanceKey, () => pluginList['translate'][getServiceName(currentTranslateServiceInstanceKey)].display)} `}</div>
                                ) : (
                                    <div className='my-auto'>
                                        {getInstanceName(currentTranslateServiceInstanceKey, () =>
                                            t(
                                                `services.translate.${getServiceName(currentTranslateServiceInstanceKey)}.title`
                                            )
                                        )}
                                    </div>
                                )}
                            </Button>
                        </DropdownTrigger>
                        <DropdownMenu
                            aria-label='app language'
                            className='max-h-[40vh] overflow-y-auto'
                            onAction={(key) => {
                                setCurrentTranslateServiceInstanceKey(key);
                            }}
                        >
                            {translateServiceInstanceList.map((instanceKey) => {
                                return (
                                    <DropdownItem
                                        key={instanceKey}
                                        startContent={
                                            whetherPluginService(instanceKey) ? (
                                                <img
                                                    src={pluginList['translate'][getServiceName(instanceKey)].icon}
                                                    className='h-[20px] my-auto'
                                                />
                                            ) : (
                                                <img
                                                    src={builtinServices[getServiceName(instanceKey)].info.icon}
                                                    className='h-[20px] my-auto'
                                                />
                                            )
                                        }
                                    >
                                        {whetherPluginService(instanceKey) ? (
                                            <div className='my-auto'>{`${getInstanceName(instanceKey, () => pluginList['translate'][getServiceName(instanceKey)].display)} `}</div>
                                        ) : (
                                            <div className='my-auto'>
                                                {getInstanceName(instanceKey, () =>
                                                    t(`services.translate.${getServiceName(instanceKey)}.title`)
                                                )}
                                            </div>
                                        )}
                                    </DropdownItem>
                                );
                            })}
                        </DropdownMenu>
                    </Dropdown>
                    {/* `size` is deliberately not set. For the dots variant it sizes a fixed
                        square wrapper -- 40px at `lg` -- and this header is 30px tall, so the
                        wrapper is sized to the dots instead. That also lays them out as a row
                        rather than spreading them across that square.

                        `default-500` rather than `color='default'`, which is a lighter shade:
                        500 is what this spinner has always used, and a utility class resolves
                        against whatever theme class is on <html> exactly as the var reference
                        it replaces did. */}
                    {isLoading && (
                        <Spinner
                            variant='dots'
                            classNames={{
                                base: 'my-auto ml-[20px]',
                                wrapper: 'w-auto h-2 gap-1',
                                dots: 'size-2 bg-muted',
                            }}
                        />
                    )}
                </div>
                {/* content collapse */}
                <div className='flex'>
                    <Button
                        size='sm'
                        isIconOnly
                        variant='light'
                        className='h-[20px] w-[20px]'
                        onPress={() => setHide(!hide)}
                    >
                        {hide ? (
                            <BiExpandVertical className='text-[16px]' />
                        ) : (
                            <BiCollapseVertical className='text-[16px]' />
                        )}
                    </Button>
                </div>
            </CardHeader>
            {/* `height: auto` is measured by framer-motion itself, which is why this
                needs neither react-spring nor a measuring hook. */}
            <motion.div
                initial={{ height: 0 }}
                animate={{ height: hide ? 0 : 'auto' }}
                style={{ overflow: 'hidden' }}
            >
                <div>
                    {/* result content */}
                    <CardContent className={`p-[12px] pb-0 ${hide ? 'h-0 p-0' : ''}`}>
                        {typeof result === 'string' ? (
                            <textarea
                                ref={textAreaRef}
                                className={`text-[${appFontSize}px] h-0 resize-none bg-transparent select-text outline-hidden`}
                                readOnly
                                value={result}
                            />
                        ) : (
                            <div>
                                {result['pronunciations'] &&
                                    result['pronunciations'].map((pronunciation) => {
                                        return (
                                            <div key={nanoid()}>
                                                {pronunciation['region'] && (
                                                    <span
                                                        className={`text-[${appFontSize}px] mr-[12px] text-muted`}
                                                    >
                                                        {pronunciation['region']}
                                                    </span>
                                                )}
                                                {pronunciation['symbol'] && (
                                                    <span
                                                        className={`text-[${appFontSize}px] mr-[12px] text-muted`}
                                                    >
                                                        {pronunciation['symbol']}
                                                    </span>
                                                )}
                                                {pronunciation['voice'] && pronunciation['voice'] !== '' && (
                                                    <HiOutlineVolumeUp
                                                        className={`text-[${appFontSize}px] inline-block my-auto cursor-pointer`}
                                                        onClick={() => {
                                                            speak(pronunciation['voice']);
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                {result['explanations'] &&
                                    result['explanations'].map((explanations) => {
                                        return (
                                            <div key={nanoid()}>
                                                {explanations['explains'] &&
                                                    explanations['explains'].map((explain, index) => {
                                                        return (
                                                            <span key={nanoid()}>
                                                                {index === 0 ? (
                                                                    <>
                                                                        <span
                                                                            className={`text-[${appFontSize - 2}px] text-muted mr-[12px]`}
                                                                        >
                                                                            {explanations['trait']}
                                                                        </span>
                                                                        <span
                                                                            className={`font-bold text-[${appFontSize}px] select-text`}
                                                                        >
                                                                            {explain}
                                                                        </span>
                                                                        <br />
                                                                    </>
                                                                ) : (
                                                                    <span
                                                                        className={`text-[${appFontSize - 2}px] text-muted select-text mr-1`}
                                                                        key={nanoid()}
                                                                    >
                                                                        {explain}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        );
                                                    })}
                                            </div>
                                        );
                                    })}
                                <br />
                                {result['associations'] &&
                                    result['associations'].map((association) => {
                                        return (
                                            <div key={nanoid()}>
                                                <span className={`text-[${appFontSize}px] text-muted`}>
                                                    {association}
                                                </span>
                                            </div>
                                        );
                                    })}
                                {result['sentence'] &&
                                    result['sentence'].map((sentence, index) => {
                                        return (
                                            <div key={nanoid()}>
                                                <span className={`text-[${appFontSize - 2}px] mr-[12px]`}>
                                                    {index + 1}.
                                                </span>
                                                <>
                                                    {sentence['source'] && (
                                                        <span
                                                            className={`text-[${appFontSize}px] select-text`}
                                                            dangerouslySetInnerHTML={{
                                                                __html: sentence['source'],
                                                            }}
                                                        />
                                                    )}
                                                </>
                                                <>
                                                    {sentence['target'] && (
                                                        <div
                                                            className={`text-[${appFontSize}px] select-text text-muted`}
                                                            dangerouslySetInnerHTML={{
                                                                __html: sentence['target'],
                                                            }}
                                                        />
                                                    )}
                                                </>
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                        {error !== '' ? (
                            error.split('\n').map((v) => {
                                return (
                                    <p
                                        key={v}
                                        className={`text-[${appFontSize}px] text-red-500`}
                                    >
                                        {v}
                                    </p>
                                );
                            })
                        ) : (
                            <></>
                        )}
                    </CardContent>
                    <CardFooter
                        className={`bg-surface rounded-none rounded-b-[10px] flex px-[12px] p-[5px] ${hide ? 'hidden' : ''}`}
                    >
                        <ButtonGroup>
                            {/* speak button */}
                            <Tooltip content={t('translate.speak')}>
                                <Button
                                    isIconOnly
                                    variant='light'
                                    size='sm'
                                    isDisabled={typeof result !== 'string' || result === ''}
                                    onPress={() => {
                                        handleSpeak().catch((e) => {
                                            toast.error(e.toString(), { style: toastStyle });
                                        });
                                    }}
                                >
                                    <HiOutlineVolumeUp className='text-[16px]' />
                                </Button>
                            </Tooltip>
                            {/* copy button */}
                            <Tooltip content={t('translate.copy')}>
                                <Button
                                    isIconOnly
                                    variant='light'
                                    size='sm'
                                    isDisabled={typeof result !== 'string' || result === ''}
                                    onPress={() => {
                                        writeText(result);
                                    }}
                                >
                                    <MdContentCopy className='text-[16px]' />
                                </Button>
                            </Tooltip>
                            {/* translate back button */}
                            <Tooltip content={t('translate.translate_back')}>
                                <Button
                                    isIconOnly
                                    variant='light'
                                    size='sm'
                                    isDisabled={typeof result !== 'string' || result === ''}
                                    onPress={async () => {
                                        setError('');
                                        let newTargetLanguage = sourceLanguage;
                                        if (sourceLanguage === 'auto') {
                                            newTargetLanguage = detectLanguage;
                                        }
                                        let newSourceLanguage = targetLanguage;
                                        if (sourceLanguage === 'auto') {
                                            newSourceLanguage = 'auto';
                                        }
                                        if (whetherPluginService(currentTranslateServiceInstanceKey)) {
                                            const pluginInfo =
                                                pluginList['translate'][
                                                    getServiceName(currentTranslateServiceInstanceKey)
                                                ];
                                            if (
                                                newSourceLanguage in pluginInfo.language &&
                                                newTargetLanguage in pluginInfo.language
                                            ) {
                                                setIsLoading(true);
                                                setHide(true);
                                                const instanceConfig =
                                                    serviceInstanceConfigMap[currentTranslateServiceInstanceKey];
                                                instanceConfig['enable'] = 'true';
                                                const setHideOnce = invokeOnce(setHide);
                                                let [func, utils] = await invoke_plugin(
                                                    'translate',
                                                    getServiceName(currentTranslateServiceInstanceKey)
                                                );
                                                func(
                                                    result.trim(),
                                                    pluginInfo.language[newSourceLanguage],
                                                    pluginInfo.language[newTargetLanguage],
                                                    {
                                                        config: instanceConfig,
                                                        detect: detectLanguage,
                                                        setResult: (v) => {
                                                            setResult(v);
                                                            setHideOnce(false);
                                                        },
                                                        utils,
                                                    }
                                                ).then(
                                                    (v) => {
                                                        if (v === result) {
                                                            setResult(v + ' ');
                                                        } else {
                                                            setResult(v.trim());
                                                        }
                                                        setIsLoading(false);
                                                        if (v !== '') {
                                                            setHideOnce(false);
                                                        }
                                                    },
                                                    (e) => {
                                                        setError(e.toString());
                                                        setIsLoading(false);
                                                    }
                                                );
                                            } else {
                                                setError('Language not supported');
                                            }
                                        } else {
                                            const LanguageEnum =
                                                builtinServices[getServiceName(currentTranslateServiceInstanceKey)]
                                                    .Language;
                                            if (
                                                newSourceLanguage in LanguageEnum &&
                                                newTargetLanguage in LanguageEnum
                                            ) {
                                                setIsLoading(true);
                                                setHide(true);
                                                const instanceConfig =
                                                    serviceInstanceConfigMap[currentTranslateServiceInstanceKey];
                                                const setHideOnce = invokeOnce(setHide);
                                                builtinServices[getServiceName(currentTranslateServiceInstanceKey)]
                                                    .translate(
                                                        result.trim(),
                                                        LanguageEnum[newSourceLanguage],
                                                        LanguageEnum[newTargetLanguage],
                                                        {
                                                            config: instanceConfig,
                                                            detect: newSourceLanguage,
                                                            setResult: (v) => {
                                                                setResult(v);
                                                                setHideOnce(false);
                                                            },
                                                        }
                                                    )
                                                    .then(
                                                        (v) => {
                                                            if (v === result) {
                                                                setResult(v + ' ');
                                                            } else {
                                                                setResult(v.trim());
                                                            }
                                                            setIsLoading(false);
                                                            if (v !== '') {
                                                                setHideOnce(false);
                                                            }
                                                        },
                                                        (e) => {
                                                            setError(e.toString());
                                                            setIsLoading(false);
                                                        }
                                                    );
                                            } else {
                                                setError('Language not supported');
                                            }
                                        }
                                    }}
                                >
                                    <TbTransformFilled className='text-[16px]' />
                                </Button>
                            </Tooltip>
                            {/* error retry button */}
                            <Tooltip content={t('translate.retry')}>
                                <Button
                                    isIconOnly
                                    variant='light'
                                    size='sm'
                                    className={`${error === '' ? 'hidden' : ''}`}
                                    onPress={() => {
                                        setError('');
                                        setResult('');
                                        translate();
                                    }}
                                >
                                    <GiCycle className='text-[16px]' />
                                </Button>
                            </Tooltip>
                            {/* available collection service instance */}
                            {collectionServiceList &&
                                collectionServiceList.map((collectionServiceInstanceName) => {
                                    return (
                                        <Button
                                            key={collectionServiceInstanceName}
                                            isIconOnly
                                            variant='light'
                                            size='sm'
                                            onPress={async () => {
                                                if (
                                                    getServiceSouceType(collectionServiceInstanceName) ===
                                                    ServiceSourceType.PLUGIN
                                                ) {
                                                    const pluginConfig =
                                                        serviceInstanceConfigMap[collectionServiceInstanceName];
                                                    let [func, utils] = await invoke_plugin(
                                                        'collection',
                                                        getServiceName(collectionServiceInstanceName)
                                                    );
                                                    func(sourceText.trim(), result.toString(), {
                                                        config: pluginConfig,
                                                        utils,
                                                    }).then(
                                                        (_) => {
                                                            toast.success(t('translate.add_collection_success'), {
                                                                style: toastStyle,
                                                            });
                                                        },
                                                        (e) => {
                                                            toast.error(e.toString(), { style: toastStyle });
                                                        }
                                                    );
                                                } else {
                                                    const instanceConfig =
                                                        serviceInstanceConfigMap[collectionServiceInstanceName];
                                                    builtinCollectionServices[
                                                        getServiceName(collectionServiceInstanceName)
                                                    ]
                                                        .collection(sourceText, result, {
                                                            config: instanceConfig,
                                                        })
                                                        .then(
                                                            (_) => {
                                                                toast.success(t('translate.add_collection_success'), {
                                                                    style: toastStyle,
                                                                });
                                                            },
                                                            (e) => {
                                                                toast.error(e.toString(), { style: toastStyle });
                                                            }
                                                        );
                                                }
                                            }}
                                        >
                                            <img
                                                src={
                                                    getServiceSouceType(collectionServiceInstanceName) ===
                                                    ServiceSourceType.PLUGIN
                                                        ? pluginList['collection'][
                                                              getServiceName(collectionServiceInstanceName)
                                                          ].icon
                                                        : builtinCollectionServices[
                                                              getServiceName(collectionServiceInstanceName)
                                                          ].info.icon
                                                }
                                                className='h-[16px] w-[16px]'
                                            />
                                        </Button>
                                    );
                                })}
                        </ButtonGroup>
                    </CardFooter>
                </div>
            </motion.div>
        </Card>
    );
}
